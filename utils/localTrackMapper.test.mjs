import test from 'node:test'
import assert from 'node:assert/strict'

import {
  AUDIO_EXTENSIONS,
  buildLocalTrack,
  mergeLocalTracks,
  normalizeLocalLibraryTracks,
  replaceAndroidMediaStoreTracks
} from './localTrackMapper.js'

test('buildLocalTrack accepts common audio extensions and stores metadata only', () => {
  const track = buildLocalTrack({
    name: 'Late Window.mp3',
    size: 1024,
    type: 'audio/mpeg',
    lastModified: 1710000000000,
    path: 'blob:should-not-be-saved'
  }, 1710000001000)

  assert.match(track.id, /^local-late-window-mp3-[a-z0-9]+-1024-1710000000000$/)
  assert.equal(track.id, buildLocalTrack({
    name: 'Late Window.mp3',
    size: 1024,
    type: 'audio/mpeg',
    lastModified: 1710000000000
  }, 1710000001000).id)
  assert.equal(track.title, 'Late Window')
  assert.equal(track.fileName, 'Late Window.mp3')
  assert.equal(track.fileSize, 1024)
  assert.equal(track.fileType, 'audio/mpeg')
  assert.equal(track.lastModified, 1710000000000)
  assert.equal(track.importedAt, 1710000001000)
  assert.equal(track.sourceType, 'local')
  assert.equal(track.scanSource, 'h5-choose-file')
  assert.ok(track.coverColor.startsWith('#'))
  assert.equal(Object.prototype.hasOwnProperty.call(track, 'path'), false)
  assert.equal(Object.prototype.hasOwnProperty.call(track, 'url'), false)
  assert.equal(Object.prototype.hasOwnProperty.call(track, 'duration'), false)
})

test('buildLocalTrack rejects unsupported extensions', () => {
  assert.equal(buildLocalTrack({ name: 'notes.txt', size: 12 }), null)
  assert.equal(buildLocalTrack({ name: 'cover.jpg', size: 12 }), null)
})

test('buildLocalTrack handles file name boundaries and case-insensitive extensions', () => {
  const chineseTrack = buildLocalTrack({
    name: '星 空 Demo.MP3',
    size: 2048,
    lastModified: 1710000003000
  }, 1710000004000)
  const spacedTrack = buildLocalTrack({
    name: 'Deep Focus Mix .WAV',
    size: 4096,
    lastModified: 1710000005000
  }, 1710000006000)
  const pathTrack = buildLocalTrack({
    path: 'C:\\Users\\me\\Local Folder\\Road Trip.FLAC',
    size: 8192,
    lastModified: 1710000007000
  }, 1710000008000)

  assert.equal(chineseTrack.fileName, '星 空 Demo.MP3')
  assert.equal(chineseTrack.title, '星 空 Demo')
  assert.equal(chineseTrack.fileType, 'audio/mp3')
  assert.equal(spacedTrack.fileName, 'Deep Focus Mix .WAV')
  assert.equal(spacedTrack.title, 'Deep Focus Mix')
  assert.equal(spacedTrack.fileType, 'audio/wav')
  assert.equal(pathTrack.fileName, 'Road Trip.FLAC')
  assert.equal(pathTrack.title, 'Road Trip')
  assert.equal(pathTrack.fileType, 'audio/flac')
  assert.equal(Object.prototype.hasOwnProperty.call(pathTrack, 'path'), false)
  assert.equal(buildLocalTrack({ name: 'bad-song.mp3.exe', size: 1 }), null)
  assert.equal(buildLocalTrack({ name: 'no-extension', size: 1 }), null)
})

test('buildLocalTrack falls back when browser file metadata is missing', () => {
  const track = buildLocalTrack({
    name: 'No Meta.m4a'
  }, 1710000002000)

  assert.match(track.id, /^local-no-meta-m4a-[a-z0-9]+-0-0$/)
  assert.equal(track.title, 'No Meta')
  assert.equal(track.fileName, 'No Meta.m4a')
  assert.equal(track.fileSize, 0)
  assert.equal(track.fileType, 'audio/m4a')
  assert.equal(track.lastModified, 0)
  assert.equal(track.importedAt, 1710000002000)
  assert.equal(track.sourceType, 'local')
  assert.equal(track.scanSource, 'h5-choose-file')
  assert.equal(Object.prototype.hasOwnProperty.call(track, 'path'), false)
  assert.equal(Object.prototype.hasOwnProperty.call(track, 'tempFilePath'), false)
})

test('mergeLocalTracks imports valid files and skips duplicates or unsupported files', () => {
  const existing = [
    buildLocalTrack({ name: 'A.mp3', size: 1, lastModified: 10 }, 100)
  ]

  const result = mergeLocalTracks(existing, [
    { name: 'A.mp3', size: 1, lastModified: 10 },
    { name: 'B.wav', size: 2, lastModified: 20 },
    { name: 'bad.txt', size: 3, lastModified: 30 }
  ], { now: 200 })

  assert.equal(result.tracks.length, 2)
  assert.equal(result.addedCount, 1)
  assert.equal(result.duplicateCount, 1)
  assert.equal(result.unsupportedCount, 1)
})

test('mergeLocalTracks treats empty or cancelled picks as a no-op', () => {
  const existing = [
    buildLocalTrack({ name: 'Kept.flac', size: 32, lastModified: 50 }, 100)
  ]

  const emptyResult = mergeLocalTracks(existing, [], { now: 200 })
  const missingResult = mergeLocalTracks(existing, null, { now: 200 })

  assert.deepEqual(emptyResult.tracks, existing)
  assert.equal(emptyResult.addedCount, 0)
  assert.equal(emptyResult.duplicateCount, 0)
  assert.equal(emptyResult.unsupportedCount, 0)
  assert.deepEqual(missingResult.tracks, existing)
  assert.equal(missingResult.addedCount, 0)
})

test('mergeLocalTracks keeps every supported file returned by the H5 picker', () => {
  const picked = Array.from({ length: 1205 }, (_, index) => ({
    name: `New ${index}.mp3`,
    size: 5000 + index,
    lastModified: 8000 + index
  }))

  const result = mergeLocalTracks([], picked, { now: 200 })

  assert.equal(AUDIO_EXTENSIONS.includes('mp3'), true)
  assert.equal(result.tracks.length, 1205)
  assert.equal(result.addedCount, 1205)
})

test('mergeLocalTracks does not collapse different Unicode file names with equal metadata', () => {
  const result = mergeLocalTracks([], [
    { name: 'あ.mp3', size: 1000, lastModified: 1000 },
    { name: 'い.mp3', size: 1000, lastModified: 1000 },
    { name: '가.mp3', size: 1000, lastModified: 1000 }
  ], { now: 200 })

  assert.equal(result.tracks.length, 3)
  assert.equal(result.addedCount, 3)
  assert.equal(result.duplicateCount, 0)
  assert.equal(new Set(result.tracks.map((track) => track.id)).size, 3)
})

test('mergeLocalTracks keeps case-distinct file names with equal metadata', () => {
  const result = mergeLocalTracks([], [
    { name: 'A.mp3', size: 1000, lastModified: 1000 },
    { name: 'a.mp3', size: 1000, lastModified: 1000 }
  ], { now: 200 })

  assert.equal(result.tracks.length, 2)
  assert.equal(result.addedCount, 2)
  assert.equal(result.duplicateCount, 0)
  assert.equal(new Set(result.tracks.map((track) => track.id)).size, 2)
})

test('normalizeLocalLibraryTracks migrates legacy H5 ids to the collision-safe format', () => {
  const normalized = normalizeLocalLibraryTracks([{
    id: 'local-no-meta-m4a-0-0',
    title: 'No Meta',
    fileName: 'No Meta.m4a',
    fileSize: 0,
    fileType: 'audio/m4a',
    lastModified: 0,
    importedAt: 1710000002000,
    sourceType: 'local',
    scanSource: 'h5-choose-file'
  }])

  assert.equal(normalized.length, 1)
  assert.notEqual(normalized[0].id, 'local-no-meta-m4a-0-0')
  assert.match(normalized[0].id, /^local-no-meta-m4a-[a-z0-9]+-0-0$/)
})

test('normalizeLocalLibraryTracks migrates the prior case-folded H5 hash id', () => {
  const hashLegacyIdentity = (value) => {
    let hash = 2166136261
    for (const character of String(value).trim().toLowerCase().normalize('NFC')) {
      hash ^= character.charCodeAt(0)
      hash = Math.imul(hash, 16777619) >>> 0
    }
    return hash.toString(36)
  }
  const currentTrack = buildLocalTrack({
    name: 'A.mp3',
    size: 1000,
    type: 'audio/mpeg',
    lastModified: 1000
  }, 200)
  const previousId = `local-a-mp3-${hashLegacyIdentity('A.mp3')}-1000-1000`

  assert.notEqual(previousId, currentTrack.id)

  const normalized = normalizeLocalLibraryTracks([{
    ...currentTrack,
    id: previousId
  }])

  assert.equal(normalized.length, 1)
  assert.equal(normalized[0].id, currentTrack.id)
})

test('replaceAndroidMediaStoreTracks replaces only Android scan entries', () => {
  const h5Track = buildLocalTrack({ name: 'Kept.mp3', size: 3000, lastModified: 20 }, 100)
  const oldAndroidTrack = {
    id: 'android-media-store:old',
    title: 'Old Android',
    fileName: 'old.mp3',
    fileSize: 120000,
    fileType: 'audio/mpeg',
    duration: 40000,
    lastModified: 1710000000000,
    importedAt: 1710000001000,
    coverColor: '#1db954',
    sourceType: 'local',
    scanSource: 'android-media-store'
  }
  const nextAndroidTrack = {
    id: 'android-media-store:new',
    title: 'New Android',
    artist: 'QA',
    album: 'Device',
    fileName: 'new.mp3',
    fileSize: 130000,
    fileType: 'audio/mpeg',
    duration: 45000,
    lastModified: 1710000002000,
    importedAt: 1710000003000,
    coverColor: '#2f80ed',
    sourceType: 'local',
    scanSource: 'android-media-store',
    path: '/storage/emulated/0/Music/new.mp3',
    contentUri: 'content://media/external/audio/media/2'
  }

  const result = replaceAndroidMediaStoreTracks([h5Track, oldAndroidTrack], [nextAndroidTrack])

  assert.equal(result.tracks.length, 2)
  assert.equal(result.replacedCount, 1)
  assert.equal(result.addedCount, 1)
  assert.equal(result.duplicateCount, 0)
  assert.equal(result.tracks.some((track) => track.id === h5Track.id), true)
  assert.equal(result.tracks.some((track) => track.id === oldAndroidTrack.id), false)
  const savedAndroidTrack = result.tracks.find((track) => track.id === nextAndroidTrack.id)
  assert.equal(savedAndroidTrack.scanSource, 'android-media-store')
  assert.equal(Object.prototype.hasOwnProperty.call(savedAndroidTrack, 'path'), false)
  assert.equal(Object.prototype.hasOwnProperty.call(savedAndroidTrack, 'contentUri'), false)
})

test('replaceAndroidMediaStoreTracks keeps every Android result without a project cap', () => {
  const androidTracks = Array.from({ length: 1205 }, (_, index) => ({
    id: `android-media-store:device${index.toString(36)}`,
    title: `Device Track ${index}`,
    artist: 'QA Artist',
    album: 'Device Library',
    fileName: `device-track-${index}.mp3`,
    fileSize: 200000 + index,
    fileType: 'audio/mpeg',
    duration: 60000 + index,
    lastModified: 1710000000000 + index,
    importedAt: 1710001000000 + index,
    coverColor: '#1db954',
    sourceType: 'local',
    scanSource: 'android-media-store'
  }))

  const result = replaceAndroidMediaStoreTracks([], androidTracks)

  assert.equal(result.tracks.length, 1205)
  assert.equal(result.addedCount, 1205)
})

test('normalizeLocalLibraryTracks keeps complete H5 and Android indexes', () => {
  const h5Tracks = Array.from({ length: 1205 }, (_, index) => (
    buildLocalTrack({
      name: `H5 Track ${index}.mp3`,
      size: 1000 + index,
      lastModified: 1711000000000 + index
    }, 1712000000000 + index)
  ))
  const androidTracks = Array.from({ length: 1205 }, (_, index) => ({
    id: `android-media-store:hydrated${index.toString(36)}`,
    title: `Hydrated Track ${index}`,
    fileName: `hydrated-track-${index}.mp3`,
    fileSize: 200000 + index,
    fileType: 'audio/mpeg',
    duration: 60000 + index,
    lastModified: 1713000000000 + index,
    importedAt: 1714000000000 + index,
    coverColor: '#2f80ed',
    sourceType: 'local',
    scanSource: 'android-media-store'
  }))

  const normalized = normalizeLocalLibraryTracks([...h5Tracks, ...androidTracks])

  assert.equal(normalized.filter((track) => track.scanSource === 'h5-choose-file').length, 1205)
  assert.equal(normalized.filter((track) => track.scanSource === 'android-media-store').length, 1205)
  assert.equal(normalized.length, 2410)
})

test('normalizeLocalLibraryTracks rejects unsafe Android ids that could persist a URI', () => {
  const unsafeTrack = {
    id: 'android-media-store:content://media/external/audio/media/42',
    title: 'Unsafe',
    fileName: 'unsafe.mp3',
    fileSize: 200000,
    fileType: 'audio/mpeg',
    duration: 60000,
    lastModified: 1710000000000,
    importedAt: 1710000001000,
    sourceType: 'local',
    scanSource: 'android-media-store'
  }

  assert.deepEqual(normalizeLocalLibraryTracks([unsafeTrack]), [])
})
