import { computed, reactive } from 'vue'
import {
  ANDROID_MEDIA_STORE_SCAN_SOURCE,
  mergeLocalTracks,
  normalizeLocalLibraryTracks,
  replaceAndroidMediaStoreTracks,
} from '../utils/localTrackMapper'
import { setPlaylist } from './playerStore'

export const LOCAL_LIBRARY_STORAGE_KEY = 'MUSIC_SHELL_LOCAL_LIBRARY'

export const DEFAULT_SCAN_META = {
  status: 'idle',
  source: '',
  lastScanAt: 0,
  stats: null
}

export const libraryState = reactive({
  hydrated: false,
  tracks: [],
  scanMeta: { ...DEFAULT_SCAN_META }
})

export const localTrackCount = computed(() => libraryState.tracks.length)

function canUseUniStorage() {
  return typeof uni !== 'undefined'
    && typeof uni.getStorageSync === 'function'
    && typeof uni.setStorageSync === 'function'
    && typeof uni.removeStorageSync === 'function'
}

function syncPlayerPlaylist() {
  setPlaylist(libraryState.tracks)
}

function normalizeScanMeta(scanMeta) {
  if (!scanMeta || typeof scanMeta !== 'object') {
    return { ...DEFAULT_SCAN_META }
  }

  return {
    status: String(scanMeta.status || DEFAULT_SCAN_META.status),
    source: String(scanMeta.source || ''),
    lastScanAt: Number(scanMeta.lastScanAt) || 0,
    stats: scanMeta.stats && typeof scanMeta.stats === 'object'
      ? { ...scanMeta.stats }
      : null
  }
}

function serializeLibrary() {
  return {
    tracks: libraryState.tracks,
    scanMeta: libraryState.scanMeta
  }
}

function persistLibrary() {
  if (!canUseUniStorage()) {
    return true
  }

  try {
    uni.setStorageSync(LOCAL_LIBRARY_STORAGE_KEY, serializeLibrary())
    return true
  } catch (error) {
    // H5 隐私模式或浏览器配额可能拒绝写入；当前会话仍保留索引。
    return false
  }
}

function readStoredLibrary() {
  const storedValue = uni.getStorageSync(LOCAL_LIBRARY_STORAGE_KEY)
  if (Array.isArray(storedValue)) {
    return {
      tracks: storedValue,
      scanMeta: { ...DEFAULT_SCAN_META }
    }
  }

  if (storedValue && typeof storedValue === 'object') {
    return {
      tracks: Array.isArray(storedValue.tracks) ? storedValue.tracks : [],
      scanMeta: normalizeScanMeta(storedValue.scanMeta)
    }
  }

  return {
    tracks: [],
    scanMeta: { ...DEFAULT_SCAN_META }
  }
}

export function hydrateLibrary() {
  if (libraryState.hydrated) {
    syncPlayerPlaylist()
    return
  }

  let storedLibrary = {
    tracks: [],
    scanMeta: { ...DEFAULT_SCAN_META }
  }
  if (canUseUniStorage()) {
    try {
      storedLibrary = readStoredLibrary()
    } catch (error) {
      storedLibrary = {
        tracks: [],
        scanMeta: { ...DEFAULT_SCAN_META }
      }
    }
  }

  libraryState.tracks = normalizeLocalLibraryTracks(storedLibrary.tracks)
  libraryState.scanMeta = normalizeScanMeta(storedLibrary.scanMeta)
  libraryState.hydrated = true
  syncPlayerPlaylist()
}

export function updateScanMeta(scanMeta) {
  libraryState.scanMeta = normalizeScanMeta({
    ...libraryState.scanMeta,
    ...scanMeta
  })
  persistLibrary()
}

export function importLocalFiles(files, options = {}) {
  hydrateLibrary()
  const result = mergeLocalTracks(libraryState.tracks, files)
  libraryState.tracks = result.tracks
  libraryState.scanMeta = normalizeScanMeta({
    status: result.addedCount > 0 || result.duplicateCount > 0 ? 'has_results' : 'empty',
    source: options.source || 'h5-choose-file',
    lastScanAt: Number(options.now) || Date.now(),
    stats: {
      queriedCount: Array.isArray(files) ? files.length : 0,
      indexedCount: result.addedCount,
      duplicateSkippedCount: result.duplicateCount,
      failedCount: result.unsupportedCount
    }
  })
  const persisted = persistLibrary()
  syncPlayerPlaylist()
  return {
    ...result,
    persistenceFailed: !persisted
  }
}

export function importLocalScanResult(scanResult) {
  hydrateLibrary()

  if (scanResult?.mode === ANDROID_MEDIA_STORE_SCAN_SOURCE) {
    const result = replaceAndroidMediaStoreTracks(
      libraryState.tracks,
      scanResult.tracks || scanResult.files
    )
    const stats = {
      ...(scanResult.stats || {}),
      indexedCount: result.addedCount,
      duplicateSkippedCount: (scanResult.stats?.duplicateSkippedCount || 0) + result.duplicateCount
    }
    libraryState.tracks = result.tracks
    libraryState.scanMeta = normalizeScanMeta({
      status: scanResult.status || (result.addedCount > 0 ? 'has_results' : 'empty'),
      source: ANDROID_MEDIA_STORE_SCAN_SOURCE,
      lastScanAt: Date.now(),
      stats
    })
    const persisted = persistLibrary()
    syncPlayerPlaylist()
    return {
      ...result,
      unsupportedCount: 0,
      persistenceFailed: !persisted,
      stats
    }
  }

  return importLocalFiles(scanResult?.files || [], {
    source: scanResult?.mode || 'h5-choose-file'
  })
}

export function removeLocalTrack(trackId) {
  hydrateLibrary()
  const beforeCount = libraryState.tracks.length
  libraryState.tracks = libraryState.tracks.filter((track) => track.id !== trackId)
  const removed = libraryState.tracks.length !== beforeCount
  let persisted = true
  if (removed) {
    persisted = persistLibrary()
    syncPlayerPlaylist()
  }
  return {
    removed,
    persistenceFailed: removed && !persisted
  }
}

export function clearLocalLibrary() {
  libraryState.tracks = []
  libraryState.scanMeta = { ...DEFAULT_SCAN_META }
  libraryState.hydrated = true

  let persisted = true
  if (canUseUniStorage()) {
    try {
      uni.removeStorageSync(LOCAL_LIBRARY_STORAGE_KEY)
    } catch (error) {
      // 清理失败只影响持久化；当前会话仍会清空。
      persisted = false
    }
  }

  syncPlayerPlaylist()
  return {
    persistenceFailed: !persisted
  }
}
