import test from 'node:test'
import assert from 'node:assert/strict'

import {
  assertMediaStoreCursor,
  readAndroidCursorValue,
  requestAndroidLocalMusicScan
} from './androidLocalMusicScanner.js'

const originalPlus = globalThis.plus

test.afterEach(() => {
  if (typeof originalPlus === 'undefined') {
    delete globalThis.plus
    return
  }
  globalThis.plus = originalPlus
})

test('a null MediaStore cursor is treated as a scan failure instead of an empty library', () => {
  assert.throws(
    () => assertMediaStoreCursor(null),
    /MediaStore query returned no cursor/
  )
})

test('a real zero-row MediaStore cursor remains a valid cursor', () => {
  const cursor = { moveToNext: () => false }
  assert.equal(assertMediaStoreCursor(cursor), cursor)
})

test('SQL NULL cursor fields stay unavailable instead of becoming zero classifications', () => {
  let getLongCalls = 0
  const cursor = {
    isNull: (columnIndex) => columnIndex === 3,
    getLong: () => {
      getLongCalls += 1
      return 0
    },
    getString: () => ''
  }

  assert.equal(readAndroidCursorValue(cursor, 'is_music', 3), undefined)
  assert.equal(getLongCalls, 0)
  assert.equal(readAndroidCursorValue(cursor, 'is_music', 4), 0)
  assert.equal(getLongCalls, 1)
})

test('a null full MediaStore cursor fails without retrying as an empty base query', async () => {
  let queryCalls = 0
  const emptyCursor = {
    getColumnIndex: () => 0,
    moveToNext: () => false,
    close: () => {}
  }
  const resolver = {
    query: () => {
      queryCalls += 1
      return queryCalls === 1 ? null : emptyCursor
    }
  }

  globalThis.plus = {
    os: { name: 'Android' },
    android: {
      checkPermission: () => 'authorized',
      importClass: (target) => {
        if (target === 'android.os.Build$VERSION') {
          return { SDK_INT: 36 }
        }
        if (target === 'android.provider.MediaStore$Audio$Media') {
          return { EXTERNAL_CONTENT_URI: 'content://media/external/audio/media' }
        }
        return target
      },
      runtimeMainActivity: () => ({ getContentResolver: () => resolver })
    }
  }

  const result = await requestAndroidLocalMusicScan()

  assert.equal(queryCalls, 1)
  assert.equal(result.status, 'scan_failed')
  assert.equal(result.stats.failedCount, 1)
})
