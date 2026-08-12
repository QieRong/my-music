import test from 'node:test'
import assert from 'node:assert/strict'

import {
  LOCAL_SCAN_ERROR_CODES,
  LOCAL_SCAN_MODE_H5_PICKER,
  requestLocalMusicScan
} from './localMusicScanner.js'

const originalUni = globalThis.uni

test.afterEach(() => {
  if (typeof originalUni === 'undefined') {
    delete globalThis.uni
    return
  }
  globalThis.uni = originalUni
})

test('requestLocalMusicScan asks H5 for every file the browser can return', async () => {
  let pickerOptions
  globalThis.uni = {
    chooseFile(options) {
      pickerOptions = options
      options.success({
        tempFiles: [
          { name: 'QA Alpha.mp3', size: 1024, lastModified: 1710000000000 }
        ]
      })
    }
  }

  const result = await requestLocalMusicScan({ count: 2, extensions: ['mp3', 'wav'] })

  assert.equal(pickerOptions.count, Number.MAX_SAFE_INTEGER)
  assert.equal(pickerOptions.type, 'file')
  assert.deepEqual(pickerOptions.extension, ['.mp3', '.wav'])
  assert.equal(result.cancelled, false)
  assert.equal(result.mode, LOCAL_SCAN_MODE_H5_PICKER)
  assert.equal(result.files.length, 1)
  assert.equal(result.files[0].name, 'QA Alpha.mp3')
})

test('requestLocalMusicScan treats picker cancellation as a no-op', async () => {
  globalThis.uni = {
    chooseFile(options) {
      options.fail({ errMsg: 'chooseFile:fail cancel' })
    }
  }

  const result = await requestLocalMusicScan()

  assert.equal(result.cancelled, true)
  assert.deepEqual(result.files, [])
  assert.equal(result.mode, LOCAL_SCAN_MODE_H5_PICKER)
})

test('requestLocalMusicScan reports unsupported runtimes', async () => {
  delete globalThis.uni

  await assert.rejects(
    () => requestLocalMusicScan(),
    (error) => error.code === LOCAL_SCAN_ERROR_CODES.UNSUPPORTED
  )
})
