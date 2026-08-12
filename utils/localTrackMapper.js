export const AUDIO_EXTENSIONS = ['mp3', 'm4a', 'wav', 'flac', 'aac', 'ogg']
export const H5_CHOOSE_FILE_SCAN_SOURCE = 'h5-choose-file'
export const ANDROID_MEDIA_STORE_SCAN_SOURCE = 'android-media-store'
export const ANDROID_MEDIA_STORE_ID_PREFIX = 'android-media-store:'

const COVER_COLORS = [
  '#1db954',
  '#2f80ed',
  '#bb6bd9',
  '#27ae60',
  '#f2994a',
  '#56ccf2',
  '#eb5757',
  '#9b51e0',
  '#00b894',
  '#6c5ce7'
]

function normalizeFileName(file) {
  const rawName = file?.name || file?.file?.name || file?.fileName || ''
  if (rawName) {
    return String(rawName).split(/[\\/]/).pop()
  }

  const rawPath = file?.path || file?.tempFilePath || file?.url || ''
  const pathName = String(rawPath).split(/[\\/]/).pop()
  return pathName || '未命名音频'
}

function getExtension(fileName) {
  const match = String(fileName).toLowerCase().match(/\.([^.]+)$/)
  return match ? match[1] : ''
}

function slugify(value) {
  const slug = String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'track'
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

function normalizeFileIdentity(fileName) {
  const value = String(fileName).trim()
  return typeof value.normalize === 'function' ? value.normalize('NFC') : value
}

function buildLocalTrackId(fileName, fileSize, lastModified) {
  const fileNameHash = stableHash(normalizeFileIdentity(fileName))
  return `local-${slugify(fileName)}-${fileNameHash}-${fileSize}-${lastModified}`
}

function buildLegacyLocalTrackId(fileName, fileSize, lastModified) {
  return `local-${slugify(fileName)}-${fileSize}-${lastModified}`
}

function buildPreviousCaseFoldedLocalTrackId(fileName, fileSize, lastModified) {
  const value = String(fileName).trim().toLowerCase()
  const normalizedValue = typeof value.normalize === 'function' ? value.normalize('NFC') : value
  return `local-${slugify(fileName)}-${stableHash(normalizedValue)}-${fileSize}-${lastModified}`
}

function normalizeTitle(fileName) {
  return String(fileName)
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || '未命名音频'
}

function getFileSize(file) {
  const size = Number(file?.size ?? file?.file?.size ?? 0)
  return Number.isFinite(size) && size > 0 ? size : 0
}

function getFileType(file, extension) {
  const type = file?.type || file?.file?.type || ''
  return type ? String(type) : `audio/${extension || 'unknown'}`
}

function getLastModified(file) {
  const modified = Number(file?.lastModified ?? file?.file?.lastModified ?? file?.lastModifiedDate ?? 0)
  return Number.isFinite(modified) && modified > 0 ? modified : 0
}

export function getLocalTrackCoverColor(seed) {
  let hash = 0
  const text = String(seed)
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0
  }
  return COVER_COLORS[hash % COVER_COLORS.length]
}

export function isSupportedAudioFile(fileName) {
  return AUDIO_EXTENSIONS.includes(getExtension(fileName))
}

export function buildLocalTrack(file, importedAt = Date.now()) {
  const fileName = normalizeFileName(file)
  const extension = getExtension(fileName)

  if (!AUDIO_EXTENSIONS.includes(extension)) {
    return null
  }

  const fileSize = getFileSize(file)
  const lastModified = getLastModified(file)
  const id = buildLocalTrackId(fileName, fileSize, lastModified)

  return {
    id,
    title: normalizeTitle(fileName),
    fileName,
    fileSize,
    fileType: getFileType(file, extension),
    lastModified,
    importedAt,
    coverColor: getLocalTrackCoverColor(id),
    sourceType: 'local',
    scanSource: H5_CHOOSE_FILE_SCAN_SOURCE
  }
}

function cleanOptionalText(value) {
  return String(value || '').trim()
}

function sanitizeAndroidMediaStoreTrack(track) {
  const id = String(track?.id || '')
  if (!/^android-media-store:[a-z0-9]+$/.test(id)) {
    return null
  }

  const fileName = cleanOptionalText(track.fileName)
  const fileSize = Number(track.fileSize)
  const duration = Number(track.duration)
  const lastModified = Number(track.lastModified)
  const importedAt = Number(track.importedAt) || Date.now()

  if (!fileName || !Number.isFinite(fileSize) || fileSize < 0) {
    return null
  }

  if (!Number.isFinite(duration) || duration < 0) {
    return null
  }

  return {
    id,
    title: cleanOptionalText(track.title) || normalizeTitle(fileName),
    artist: cleanOptionalText(track.artist),
    album: cleanOptionalText(track.album),
    duration,
    fileName,
    fileSize,
    fileType: cleanOptionalText(track.fileType) || 'audio/unknown',
    lastModified: Number.isFinite(lastModified) && lastModified > 0 ? lastModified : 0,
    importedAt,
    coverColor: cleanOptionalText(track.coverColor) || getLocalTrackCoverColor(track.id),
    sourceType: 'local',
    scanSource: ANDROID_MEDIA_STORE_SCAN_SOURCE
  }
}

export function sanitizeLocalTrack(track) {
  if (!track || track.sourceType !== 'local') {
    return null
  }

  if (track.scanSource === ANDROID_MEDIA_STORE_SCAN_SOURCE
    || String(track.id || '').startsWith(ANDROID_MEDIA_STORE_ID_PREFIX)) {
    return sanitizeAndroidMediaStoreTrack(track)
  }

  const sanitized = buildLocalTrack({
    name: track.fileName,
    size: track.fileSize,
    type: track.fileType,
    lastModified: track.lastModified
  }, Number(track.importedAt) || Date.now())

  const legacyId = sanitized
    ? buildLegacyLocalTrackId(sanitized.fileName, sanitized.fileSize, sanitized.lastModified)
    : ''
  const previousCaseFoldedId = sanitized
    ? buildPreviousCaseFoldedLocalTrackId(sanitized.fileName, sanitized.fileSize, sanitized.lastModified)
    : ''
  if (!sanitized || ![sanitized.id, legacyId, previousCaseFoldedId].includes(track.id)) {
    return null
  }

  return {
    ...sanitized,
    title: String(track.title || sanitized.title),
    coverColor: track.coverColor || sanitized.coverColor,
    scanSource: track.scanSource || H5_CHOOSE_FILE_SCAN_SOURCE
  }
}

export function normalizeLocalLibraryTracks(tracks) {
  const sourceTracks = Array.isArray(tracks) ? tracks : []
  return sourceTracks.map((track) => sanitizeLocalTrack(track)).filter(Boolean)
}

export function mergeLocalTracks(existingTracks, pickedFiles, options = {}) {
  const now = Number(options.now) || Date.now()
  const existing = normalizeLocalLibraryTracks(existingTracks)
  const files = Array.isArray(pickedFiles) ? pickedFiles : []
  const seenIds = new Set(existing.map((track) => track.id))
  const tracks = [...existing]
  let addedCount = 0
  let duplicateCount = 0
  let unsupportedCount = 0

  files.forEach((file) => {
    const track = buildLocalTrack(file, now)
    if (!track) {
      unsupportedCount += 1
      return
    }

    if (seenIds.has(track.id)) {
      duplicateCount += 1
      return
    }

    seenIds.add(track.id)
    tracks.push(track)
    addedCount += 1
  })

  return {
    tracks,
    addedCount,
    duplicateCount,
    unsupportedCount
  }
}

export function replaceAndroidMediaStoreTracks(existingTracks, androidTracks) {
  const existing = normalizeLocalLibraryTracks(existingTracks)
  const keptTracks = existing.filter((track) => track.scanSource !== ANDROID_MEDIA_STORE_SCAN_SOURCE)
  const replacedCount = existing.length - keptTracks.length
  const seenIds = new Set(keptTracks.map((track) => track.id))
  const tracks = [...keptTracks]
  let addedCount = 0
  let duplicateCount = 0

  const incoming = Array.isArray(androidTracks) ? androidTracks : []
  incoming.forEach((track) => {
    const sanitized = sanitizeAndroidMediaStoreTrack(track)
    if (!sanitized) {
      return
    }

    if (seenIds.has(sanitized.id)) {
      duplicateCount += 1
      return
    }

    seenIds.add(sanitized.id)
    tracks.push(sanitized)
    addedCount += 1
  })

  return {
    tracks,
    replacedCount,
    addedCount,
    duplicateCount
  }
}
