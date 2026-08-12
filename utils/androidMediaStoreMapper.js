import {
  ANDROID_MEDIA_STORE_ID_PREFIX,
  ANDROID_MEDIA_STORE_SCAN_SOURCE,
  getLocalTrackCoverColor
} from './localTrackMapper.js'

export { ANDROID_MEDIA_STORE_SCAN_SOURCE }

const CLASSIFICATION_SYSTEM_MUSIC = 'system_music'
const CLASSIFICATION_NON_MUSIC = 'non_music'
const CLASSIFICATION_FALLBACK = 'fallback'

const MEDIA_FIELD_ALIASES = {
  _ID: ['_ID', '_id', 'id'],
  TITLE: ['TITLE', 'title'],
  ARTIST: ['ARTIST', 'artist'],
  ALBUM: ['ALBUM', 'album'],
  DISPLAY_NAME: ['DISPLAY_NAME', '_display_name', 'displayName', 'fileName'],
  SIZE: ['SIZE', '_size', 'size', 'fileSize'],
  MIME_TYPE: ['MIME_TYPE', 'mime_type', 'mimeType', 'fileType', 'type'],
  DURATION: ['DURATION', 'duration'],
  DATE_MODIFIED: ['DATE_MODIFIED', 'date_modified', 'dateModified', 'lastModified'],
  IS_MUSIC: ['IS_MUSIC', 'is_music', 'isMusic'],
  IS_NOTIFICATION: ['IS_NOTIFICATION', 'is_notification', 'isNotification'],
  IS_RINGTONE: ['IS_RINGTONE', 'is_ringtone', 'isRingtone'],
  IS_ALARM: ['IS_ALARM', 'is_alarm', 'isAlarm'],
  IS_RECORDING: ['IS_RECORDING', 'is_recording', 'isRecording'],
  IS_PODCAST: ['IS_PODCAST', 'is_podcast', 'isPodcast'],
  IS_AUDIOBOOK: ['IS_AUDIOBOOK', 'is_audiobook', 'isAudiobook']
}

const NON_MUSIC_FIELDS = [
  'IS_NOTIFICATION',
  'IS_RINGTONE',
  'IS_ALARM',
  'IS_RECORDING',
  'IS_PODCAST',
  'IS_AUDIOBOOK'
]

export function createAndroidScanStats(overrides = {}) {
  return {
    queriedCount: 0,
    systemMusicCount: 0,
    otherAudioCount: 0,
    fallbackAudioCount: 0,
    indexedCount: 0,
    shortSkippedCount: 0,
    smallSkippedCount: 0,
    missingMetadataSkippedCount: 0,
    nonMusicSkippedCount: 0,
    duplicateSkippedCount: 0,
    failedCount: 0,
    classificationMode: 'system',
    ...overrides
  }
}

function readField(row, fieldName) {
  const aliases = MEDIA_FIELD_ALIASES[fieldName] || [fieldName]
  for (const alias of aliases) {
    if (Object.prototype.hasOwnProperty.call(row || {}, alias)) {
      return row[alias]
    }
  }
  return undefined
}

function normalizeText(value) {
  return String(value || '').trim()
}

function normalizeNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.max(0, number) : 0
}

function normalizeFlag(value) {
  if (value === undefined || value === null || value === '') {
    return null
  }
  if (value === true || value === 'true') {
    return true
  }
  if (value === false || value === 'false') {
    return false
  }
  return Number(value) === 1
}

function normalizeDateModified(value) {
  const number = normalizeNumber(value)
  if (number <= 0) {
    return 0
  }
  return number < 1000000000000 ? number * 1000 : number
}

function normalizeTitle(title, fileName) {
  const cleanTitle = normalizeText(title)
  if (cleanTitle) {
    return cleanTitle
  }
  return fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || fileName
}

function stableHash(value) {
  let hash = 2166136261
  const text = String(value)
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619) >>> 0
  }
  return hash.toString(36)
}

export function classifyAndroidMediaStoreRow(row) {
  const isMusic = normalizeFlag(readField(row, 'IS_MUSIC'))
  const hasNonMusicCategory = NON_MUSIC_FIELDS.some((field) => (
    normalizeFlag(readField(row, field)) === true
  ))

  if (hasNonMusicCategory || isMusic === false) {
    return CLASSIFICATION_NON_MUSIC
  }
  if (isMusic === true) {
    return CLASSIFICATION_SYSTEM_MUSIC
  }
  return CLASSIFICATION_FALLBACK
}

function hasRequiredFallbackMetadata(row) {
  return normalizeNumber(readField(row, 'SIZE')) > 0
    && normalizeNumber(readField(row, 'DURATION')) > 0
}

export function buildAndroidMediaStoreTrack(row, importedAt = Date.now()) {
  const classification = classifyAndroidMediaStoreRow(row)
  if (classification === CLASSIFICATION_NON_MUSIC) {
    return null
  }

  const fileName = normalizeText(readField(row, 'DISPLAY_NAME'))
  const fileSize = normalizeNumber(readField(row, 'SIZE'))
  const duration = normalizeNumber(readField(row, 'DURATION'))
  const fileType = normalizeText(readField(row, 'MIME_TYPE')) || 'audio/unknown'
  const lastModified = normalizeDateModified(readField(row, 'DATE_MODIFIED'))

  if (!fileName) {
    return null
  }
  if (classification === CLASSIFICATION_FALLBACK && !hasRequiredFallbackMetadata(row)) {
    return null
  }

  const title = normalizeTitle(readField(row, 'TITLE'), fileName)
  const artist = normalizeText(readField(row, 'ARTIST'))
  const album = normalizeText(readField(row, 'ALBUM'))
  const mediaStoreId = normalizeText(readField(row, '_ID'))
  const hashSeed = [
    mediaStoreId,
    title,
    artist,
    album,
    fileName,
    fileSize,
    duration,
    lastModified,
    fileType
  ].join('|')
  const id = `${ANDROID_MEDIA_STORE_ID_PREFIX}${stableHash(hashSeed)}`

  return {
    id,
    title,
    artist,
    album,
    duration,
    fileName,
    fileSize,
    fileType,
    lastModified,
    importedAt,
    coverColor: getLocalTrackCoverColor(id),
    sourceType: 'local',
    scanSource: ANDROID_MEDIA_STORE_SCAN_SOURCE
  }
}

function updateClassificationStats(classification, stats) {
  if (classification === CLASSIFICATION_SYSTEM_MUSIC) {
    stats.systemMusicCount += 1
    return
  }
  if (classification === CLASSIFICATION_NON_MUSIC) {
    stats.otherAudioCount += 1
    return
  }
  stats.fallbackAudioCount += 1
}

function countSkippedRow(row, classification, stats) {
  if (classification === CLASSIFICATION_NON_MUSIC) {
    stats.nonMusicSkippedCount += 1
    return
  }

  const fileName = normalizeText(readField(row, 'DISPLAY_NAME'))
  if (!fileName || (classification === CLASSIFICATION_FALLBACK && !hasRequiredFallbackMetadata(row))) {
    stats.missingMetadataSkippedCount += 1
    return
  }

  stats.failedCount += 1
}

function resolveClassificationMode(stats) {
  if (!stats.fallbackAudioCount) {
    return 'system'
  }
  return stats.fallbackAudioCount === stats.queriedCount ? 'fallback' : 'mixed'
}

export function mapAndroidMediaStoreRows(rows, options = {}) {
  const stats = createAndroidScanStats()
  const importedAt = Number(options.now) || Date.now()
  const existingTracks = Array.isArray(options.existingTracks) ? options.existingTracks : []
  const seenIds = new Set(existingTracks.map((track) => String(track?.id || '')).filter(Boolean))
  const tracks = []
  const sourceRows = Array.isArray(rows) ? rows : []

  stats.queriedCount = sourceRows.length

  sourceRows.forEach((row) => {
    const classification = classifyAndroidMediaStoreRow(row)
    updateClassificationStats(classification, stats)

    try {
      const track = buildAndroidMediaStoreTrack(row, importedAt)
      if (!track) {
        countSkippedRow(row, classification, stats)
        return
      }

      if (seenIds.has(track.id)) {
        stats.duplicateSkippedCount += 1
        return
      }

      seenIds.add(track.id)
      tracks.push(track)
      stats.indexedCount += 1
    } catch (error) {
      stats.failedCount += 1
    }
  })

  stats.classificationMode = resolveClassificationMode(stats)
  return { tracks, stats }
}
