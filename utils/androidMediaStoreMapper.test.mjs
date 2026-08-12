import test from 'node:test'
import assert from 'node:assert/strict'

import {
  ANDROID_MEDIA_STORE_SCAN_SOURCE,
  mapAndroidMediaStoreRows
} from './androidMediaStoreMapper.js'

function createSystemMusicRow(index, overrides = {}) {
  return {
    _ID: index,
    TITLE: `Track ${index}`,
    ARTIST: 'QA Artist',
    ALBUM: 'QA Album',
    DISPLAY_NAME: `track-${index}.mp3`,
    SIZE: 200000 + index,
    MIME_TYPE: 'audio/mpeg',
    DURATION: 60000 + index,
    DATE_MODIFIED: 1710000000 + index,
    IS_MUSIC: 1,
    IS_RINGTONE: 0,
    IS_NOTIFICATION: 0,
    IS_ALARM: 0,
    IS_RECORDING: 0,
    IS_PODCAST: 0,
    IS_AUDIOBOOK: 0,
    ...overrides
  }
}

test('mapAndroidMediaStoreRows builds metadata-only Android tracks', () => {
  const result = mapAndroidMediaStoreRows([
    createSystemMusicRow(42, {
      TITLE: 'Alpha',
      DISPLAY_NAME: 'alpha.mp3',
      SIZE: 200001,
      DURATION: 61000,
      DATE_MODIFIED: 1710000000,
      _data: '/storage/emulated/0/Music/alpha.mp3',
      path: '/storage/emulated/0/Music/alpha.mp3',
      contentUri: 'content://media/external/audio/media/42',
      url: 'file:///storage/emulated/0/Music/alpha.mp3'
    })
  ], { now: 1710000009000 })

  assert.equal(result.stats.queriedCount, 1)
  assert.equal(result.stats.systemMusicCount, 1)
  assert.equal(result.stats.indexedCount, 1)
  assert.equal(result.stats.classificationMode, 'system')
  assert.equal(result.tracks.length, 1)

  const track = result.tracks[0]
  assert.match(track.id, /^android-media-store:/)
  assert.equal(track.scanSource, ANDROID_MEDIA_STORE_SCAN_SOURCE)
  assert.equal(track.sourceType, 'local')
  assert.equal(track.title, 'Alpha')
  assert.equal(track.artist, 'QA Artist')
  assert.equal(track.album, 'QA Album')
  assert.equal(track.fileName, 'alpha.mp3')
  assert.equal(track.fileSize, 200001)
  assert.equal(track.fileType, 'audio/mpeg')
  assert.equal(track.duration, 61000)
  assert.equal(track.lastModified, 1710000000000)
  assert.equal(track.importedAt, 1710000009000)
  assert.equal(Object.prototype.hasOwnProperty.call(track, '_ID'), false)
  assert.equal(Object.prototype.hasOwnProperty.call(track, '_data'), false)
  assert.equal(Object.prototype.hasOwnProperty.call(track, 'path'), false)
  assert.equal(Object.prototype.hasOwnProperty.call(track, 'contentUri'), false)
  assert.equal(Object.prototype.hasOwnProperty.call(track, 'url'), false)
  assert.equal(track.id.includes('/storage'), false)
  assert.equal(track.id.includes('content://'), false)
})

test('system music classification is primary and does not reject a valid short track', () => {
  const result = mapAndroidMediaStoreRows([
    createSystemMusicRow(1, {
      TITLE: 'Short Music',
      DISPLAY_NAME: 'short-music.mp3',
      SIZE: 64000,
      DURATION: 12000
    })
  ])

  assert.equal(result.stats.systemMusicCount, 1)
  assert.equal(result.stats.indexedCount, 1)
  assert.equal(result.stats.shortSkippedCount, 0)
  assert.equal(result.stats.smallSkippedCount, 0)
  assert.equal(result.tracks[0].title, 'Short Music')
})

test('system non-music categories are excluded even when files are long and large', () => {
  const result = mapAndroidMediaStoreRows([
    createSystemMusicRow(1, {
      TITLE: 'Long Ringtone',
      IS_MUSIC: 0,
      IS_RINGTONE: 1,
      DURATION: 375980,
      SIZE: 15075349
    }),
    createSystemMusicRow(2, {
      TITLE: 'Alarm',
      IS_MUSIC: 0,
      IS_ALARM: 1,
      DURATION: 0,
      SIZE: 36
    }),
    createSystemMusicRow(3, {
      TITLE: 'Recording',
      IS_MUSIC: 0,
      IS_RECORDING: 1
    }),
    createSystemMusicRow(4, {
      TITLE: 'Podcast',
      IS_MUSIC: 0,
      IS_PODCAST: 1
    }),
    createSystemMusicRow(5, {
      TITLE: 'Audiobook',
      IS_MUSIC: 0,
      IS_AUDIOBOOK: 1
    })
  ])

  assert.deepEqual(result.tracks, [])
  assert.equal(result.stats.queriedCount, 5)
  assert.equal(result.stats.otherAudioCount, 5)
  assert.equal(result.stats.nonMusicSkippedCount, 5)
  assert.equal(result.stats.indexedCount, 0)
})

test('classification fallback is explicit when IS_MUSIC is unavailable', () => {
  const result = mapAndroidMediaStoreRows([
    {
      TITLE: 'Fallback Song',
      DISPLAY_NAME: 'fallback-song.mp3',
      SIZE: 180000,
      MIME_TYPE: 'audio/mpeg',
      DURATION: 45000,
      DATE_MODIFIED: 1710000004
    },
    {
      TITLE: 'Incomplete Fallback Audio',
      DISPLAY_NAME: 'incomplete.mp3',
      SIZE: 0,
      MIME_TYPE: 'audio/mpeg',
      DURATION: 0,
      DATE_MODIFIED: 1710000005
    }
  ])

  assert.equal(result.stats.queriedCount, 2)
  assert.equal(result.stats.fallbackAudioCount, 2)
  assert.equal(result.stats.missingMetadataSkippedCount, 1)
  assert.equal(result.stats.indexedCount, 1)
  assert.equal(result.stats.classificationMode, 'fallback')
  assert.equal(result.tracks[0].title, 'Fallback Song')
})

test('system-recognized music may keep unknown duration and size as metadata', () => {
  const result = mapAndroidMediaStoreRows([
    createSystemMusicRow(1, {
      TITLE: 'Pending Metadata',
      DISPLAY_NAME: 'pending-metadata.mp3',
      SIZE: 0,
      DURATION: 0
    })
  ])

  assert.equal(result.stats.systemMusicCount, 1)
  assert.equal(result.stats.indexedCount, 1)
  assert.equal(result.tracks[0].fileSize, 0)
  assert.equal(result.tracks[0].duration, 0)
})

test('device-scale classification reconciles 325 audio rows to 321 songs', () => {
  const musicRows = Array.from({ length: 321 }, (_, index) => createSystemMusicRow(index + 1))
  const otherRows = [
    createSystemMusicRow(322, { IS_MUSIC: 0, IS_RINGTONE: 1, DURATION: 375980, SIZE: 15075349 }),
    createSystemMusicRow(323, { IS_MUSIC: 0, IS_RINGTONE: 1, DURATION: 318224, SIZE: 12954302 }),
    createSystemMusicRow(324, { IS_MUSIC: 0, IS_ALARM: 1, DURATION: 0, SIZE: 36 }),
    createSystemMusicRow(325, { IS_MUSIC: 0, IS_ALARM: 1, DURATION: 0, SIZE: 36 })
  ]

  const result = mapAndroidMediaStoreRows([...musicRows, ...otherRows])

  assert.equal(result.stats.queriedCount, 325)
  assert.equal(result.stats.systemMusicCount, 321)
  assert.equal(result.stats.otherAudioCount, 4)
  assert.equal(result.stats.nonMusicSkippedCount, 4)
  assert.equal(result.stats.indexedCount, 321)
  assert.equal(result.tracks.length, 321)
})

test('Android mapping has no fixed item cap and still skips duplicates', () => {
  const existing = mapAndroidMediaStoreRows([createSystemMusicRow(1)]).tracks
  const incoming = [
    createSystemMusicRow(1),
    ...Array.from({ length: 1205 }, (_, index) => createSystemMusicRow(index + 2))
  ]

  const result = mapAndroidMediaStoreRows(incoming, { existingTracks: existing })

  assert.equal(result.stats.queriedCount, 1206)
  assert.equal(result.stats.duplicateSkippedCount, 1)
  assert.equal(result.stats.indexedCount, 1205)
  assert.equal(result.tracks.length, 1205)
})

test('distinct MediaStore rows with identical metadata keep distinct internal ids', () => {
  const sharedMetadata = {
    TITLE: 'Same Metadata',
    ARTIST: 'Same Artist',
    ALBUM: 'Same Album',
    DISPLAY_NAME: 'same.mp3',
    SIZE: 200000,
    MIME_TYPE: 'audio/mpeg',
    DURATION: 60000,
    DATE_MODIFIED: 1710000000
  }
  const result = mapAndroidMediaStoreRows([
    createSystemMusicRow(9001, sharedMetadata),
    createSystemMusicRow(9002, sharedMetadata)
  ])

  assert.equal(result.stats.queriedCount, 2)
  assert.equal(result.stats.duplicateSkippedCount, 0)
  assert.equal(result.stats.indexedCount, 2)
  assert.equal(result.tracks.length, 2)
  assert.notEqual(result.tracks[0].id, result.tracks[1].id)
  assert.match(result.tracks[0].id, /^android-media-store:[a-z0-9]+$/)
  assert.match(result.tracks[1].id, /^android-media-store:[a-z0-9]+$/)
  assert.equal(Object.prototype.hasOwnProperty.call(result.tracks[0], '_ID'), false)
  assert.equal(Object.prototype.hasOwnProperty.call(result.tracks[1], '_ID'), false)
})
