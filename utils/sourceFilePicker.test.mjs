import test from 'node:test'
import assert from 'node:assert/strict'

import {
  SOURCE_FILE_ERROR_CODES,
  readSourceScriptText,
  requestSourceScriptFile
} from './sourceFilePicker.js'

const originalUni = globalThis.uni

test.afterEach(() => {
  if (typeof originalUni === 'undefined') {
    delete globalThis.uni
    return
  }
  globalThis.uni = originalUni
})

test('requestSourceScriptFile selects one local JavaScript file', async () => {
  const fixtureFile = {
    name: 'qa-source.js',
    size: 120,
    type: 'text/javascript',
    text: async () => '/** @id qa */'
  }

  globalThis.uni = {
    chooseFile(options) {
      assert.equal(options.count, 1)
      assert.equal(options.type, 'file')
      assert.deepEqual(options.extension, ['.js'])
      options.success({ tempFiles: [fixtureFile] })
    }
  }

  const result = await requestSourceScriptFile()

  assert.deepEqual(result, { cancelled: false, file: fixtureFile })
})

test('requestSourceScriptFile treats user cancellation as a no-op', async () => {
  globalThis.uni = {
    chooseFile(options) {
      options.fail({ errMsg: 'chooseFile:fail cancel' })
    }
  }

  assert.deepEqual(await requestSourceScriptFile(), { cancelled: true, file: null })
})

test('requestSourceScriptFile rejects unavailable runtimes', async () => {
  delete globalThis.uni

  await assert.rejects(
    () => requestSourceScriptFile(),
    (error) => error?.code === SOURCE_FILE_ERROR_CODES.PICK_UNSUPPORTED
  )
})

test('readSourceScriptText returns the selected File text', async () => {
  const text = await readSourceScriptText({
    text: async () => '/**\n * @id qa-source\n */'
  })

  assert.equal(text, '/**\n * @id qa-source\n */')
})

test('readSourceScriptText rejects values without readable text', async () => {
  await assert.rejects(
    () => readSourceScriptText(null),
    (error) => error?.code === SOURCE_FILE_ERROR_CODES.READ_FAILED
  )
})
