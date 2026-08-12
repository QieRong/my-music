import test from 'node:test'
import assert from 'node:assert/strict'

import {
  SOURCE_DEFINITION_ERROR_CODES,
  parseSourceDefinition
} from './sourceDefinition.js'

const validSourceScript = `/**
 * @id qa-source
 * @name QA Source
 * @version 1.0.0
 * @author QA Team
 * @description Browser source fixture
 * @capabilities search, play, lyric, play
 * @homepage https://example.test/source
 */
module.exports = {
  async search() {},
  async getPlayUrl() {},
  async getLyric() {}
}`

test('parseSourceDefinition reads a valid manifest and keeps the script disabled', () => {
  const source = parseSourceDefinition(validSourceScript, 1710000000000)

  assert.deepEqual(source, {
    id: 'qa-source',
    name: 'QA Source',
    version: '1.0.0',
    author: 'QA Team',
    description: 'Browser source fixture',
    homepage: 'https://example.test/source',
    capabilities: ['search', 'play', 'lyric'],
    enabled: false,
    script: validSourceScript,
    importedAt: 1710000000000,
    updatedAt: 1710000000000
  })
})

test('parseSourceDefinition rejects a script without a required manifest field', () => {
  const missingAuthor = validSourceScript.replace(' * @author QA Team\n', '')

  assert.throws(
    () => parseSourceDefinition(missingAuthor),
    (error) => error?.code === SOURCE_DEFINITION_ERROR_CODES.MISSING_FIELD
      && error.field === 'author'
  )
})

test('parseSourceDefinition rejects an unsupported declared capability', () => {
  const invalidCapability = validSourceScript.replace('search, play, lyric, play', 'search, radio')

  assert.throws(
    () => parseSourceDefinition(invalidCapability),
    (error) => error?.code === SOURCE_DEFINITION_ERROR_CODES.INVALID_CAPABILITY
      && error.capability === 'radio'
  )
})

test('parseSourceDefinition rejects a manifest whose capabilities declaration contains no capability', () => {
  const emptyCapabilities = validSourceScript.replace('search, play, lyric, play', ',')

  assert.throws(
    () => parseSourceDefinition(emptyCapabilities),
    (error) => error?.code === SOURCE_DEFINITION_ERROR_CODES.MISSING_FIELD
      && error.field === 'capabilities'
  )
})

test('parseSourceDefinition rejects empty script text', () => {
  assert.throws(
    () => parseSourceDefinition('   '),
    (error) => error?.code === SOURCE_DEFINITION_ERROR_CODES.EMPTY_SCRIPT
  )
})
