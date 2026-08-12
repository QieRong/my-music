export const OFFLINE_CACHE_ERROR_CODES = {
  CACHE_UNAVAILABLE: 'CACHE_UNAVAILABLE',
  CACHE_BLOB_INVALID: 'CACHE_BLOB_INVALID',
  CACHE_ENTRY_INVALID: 'CACHE_ENTRY_INVALID',
  CACHE_DUPLICATE: 'CACHE_DUPLICATE',
  CACHE_QUOTA_EXCEEDED: 'CACHE_QUOTA_EXCEEDED'
}

const DATABASE_NAME = 'my-music-offline-cache'
const DATABASE_VERSION = 1
const ENTRY_STORE = 'entries'
const BLOB_STORE = 'blobs'
const MAX_CACHE_BYTES = 256 * 1024 * 1024

function createCacheError(code, message) {
  const error = new Error(message)
  error.code = code
  return error
}

function normalizeText(value, maxLength, required = false) {
  if (typeof value === 'undefined' || value === null) {
    return required ? null : ''
  }
  if (typeof value !== 'string') {
    return null
  }
  const normalized = value.trim()
  if ((required && !normalized) || normalized.length > maxLength) {
    return null
  }
  return normalized
}

function normalizeDuration(value) {
  if (typeof value === 'undefined' || value === null || value === '') {
    return null
  }
  return Number.isInteger(value) && value >= 0 && value <= 86400 ? value : null
}

function normalizeEntry(entry, blob, now) {
  if (!blob || typeof blob.size !== 'number' || !Number.isFinite(blob.size) || blob.size <= 0) {
    throw createCacheError(OFFLINE_CACHE_ERROR_CODES.CACHE_BLOB_INVALID, 'A complete non-empty Blob is required.')
  }

  const cacheId = normalizeText(entry?.cacheId, 160, true)
  const sourceId = normalizeText(entry?.sourceId, 160, true)
  const sourceFingerprint = normalizeText(entry?.sourceFingerprint, 160, true)
  const trackId = normalizeText(entry?.trackId, 160, true)
  const title = normalizeText(entry?.title, 200, true)
  const artist = normalizeText(entry?.artist, 200)
  const album = normalizeText(entry?.album, 200)
  const duration = normalizeDuration(entry?.duration)
  if (!cacheId || !sourceId || !sourceFingerprint || !trackId || !title || artist === null || album === null) {
    throw createCacheError(OFFLINE_CACHE_ERROR_CODES.CACHE_ENTRY_INVALID, 'Offline cache metadata is invalid.')
  }

  return {
    cacheId,
    sourceId,
    sourceFingerprint,
    trackId,
    title,
    artist,
    album,
    duration,
    byteSize: Math.floor(blob.size),
    createdAt: Number(now()) || Date.now()
  }
}

function requestAsPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('IndexedDB request failed.'))
  })
}

function transactionAsPromise(transaction, action) {
  return new Promise((resolve, reject) => {
    let result
    transaction.oncomplete = () => resolve(result)
    transaction.onerror = () => reject(transaction.error || new Error('IndexedDB transaction failed.'))
    transaction.onabort = () => reject(transaction.error || new Error('IndexedDB transaction aborted.'))
    try {
      result = action()
    } catch (error) {
      transaction.abort()
      reject(error)
    }
  })
}

async function createIndexedDbDatabase(indexedDB) {
  if (!indexedDB || typeof indexedDB.open !== 'function') {
    throw createCacheError(OFFLINE_CACHE_ERROR_CODES.CACHE_UNAVAILABLE, 'IndexedDB is unavailable.')
  }

  const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
  request.onupgradeneeded = () => {
    const database = request.result
    if (!database.objectStoreNames.contains(ENTRY_STORE)) {
      database.createObjectStore(ENTRY_STORE, { keyPath: 'cacheId' })
    }
    if (!database.objectStoreNames.contains(BLOB_STORE)) {
      database.createObjectStore(BLOB_STORE)
    }
  }
  const database = await requestAsPromise(request)

  return {
    async listEntries() {
      const transaction = database.transaction(ENTRY_STORE, 'readonly')
      const request = transaction.objectStore(ENTRY_STORE).getAll()
      const result = await requestAsPromise(request)
      return Array.isArray(result) ? result : []
    },
    async getBlob(cacheId) {
      const transaction = database.transaction(BLOB_STORE, 'readonly')
      return requestAsPromise(transaction.objectStore(BLOB_STORE).get(cacheId))
    },
    async putComplete(entry, blob) {
      const transaction = database.transaction([BLOB_STORE, ENTRY_STORE], 'readwrite')
      return transactionAsPromise(transaction, () => {
        transaction.objectStore(BLOB_STORE).put(blob, entry.cacheId)
        transaction.objectStore(ENTRY_STORE).put(entry)
      })
    },
    async remove(cacheId) {
      const transaction = database.transaction([BLOB_STORE, ENTRY_STORE], 'readwrite')
      return transactionAsPromise(transaction, () => {
        transaction.objectStore(BLOB_STORE).delete(cacheId)
        transaction.objectStore(ENTRY_STORE).delete(cacheId)
      })
    },
    async clear() {
      const transaction = database.transaction([BLOB_STORE, ENTRY_STORE], 'readwrite')
      return transactionAsPromise(transaction, () => {
        transaction.objectStore(BLOB_STORE).clear()
        transaction.objectStore(ENTRY_STORE).clear()
      })
    }
  }
}

export function createOfflineCache(options = {}) {
  const now = typeof options.now === 'function' ? options.now : () => Date.now()
  const storageManager = options.storageManager === undefined
    ? globalThis.navigator?.storage
    : options.storageManager
  let databasePromise = options.database ? Promise.resolve(options.database) : null

  function getDatabase() {
    if (!databasePromise) {
      databasePromise = createIndexedDbDatabase(options.indexedDB === undefined ? globalThis.indexedDB : options.indexedDB)
    }
    return databasePromise
  }

  async function listEntries() {
    const database = await getDatabase()
    const entries = await database.listEntries()
    return entries
      .filter((entry) => entry && typeof entry.cacheId === 'string')
      .map((entry) => ({
        cacheId: entry.cacheId,
        sourceId: entry.sourceId,
        sourceFingerprint: entry.sourceFingerprint,
        trackId: entry.trackId,
        title: entry.title,
        artist: entry.artist,
        album: entry.album,
        duration: entry.duration,
        byteSize: entry.byteSize,
        createdAt: entry.createdAt
      }))
      .sort((left, right) => Number(right.createdAt) - Number(left.createdAt))
  }

  async function getQuota() {
    const entries = await listEntries()
    const usedBytes = entries.reduce((sum, entry) => sum + (Number(entry.byteSize) || 0), 0)
    try {
      const estimate = await storageManager?.estimate?.()
      const quota = Number(estimate?.quota)
      const usage = Number(estimate?.usage)
      if (Number.isFinite(quota) && Number.isFinite(usage) && quota >= usage) {
        const limitBytes = Math.min(MAX_CACHE_BYTES, Math.floor((quota - usage) * 0.2))
        return {
          limitBytes,
          usedBytes,
          availableBytes: Math.max(0, limitBytes - usedBytes),
          estimateAvailable: true
        }
      }
    } catch (error) {
      // 浏览器未提供存储估算时使用固定上限，并由 UI 标记为估算不可用。
    }
    return {
      limitBytes: MAX_CACHE_BYTES,
      usedBytes,
      availableBytes: Math.max(0, MAX_CACHE_BYTES - usedBytes),
      estimateAvailable: false
    }
  }

  async function putComplete(entry, blob) {
    const normalizedEntry = normalizeEntry(entry, blob, now)
    const database = await getDatabase()
    const entries = await listEntries()
    if (entries.some((item) => item.cacheId === normalizedEntry.cacheId)) {
      throw createCacheError(OFFLINE_CACHE_ERROR_CODES.CACHE_DUPLICATE, 'Offline cache entry already exists.')
    }
    const quota = await getQuota()
    if (normalizedEntry.byteSize > quota.availableBytes) {
      throw createCacheError(OFFLINE_CACHE_ERROR_CODES.CACHE_QUOTA_EXCEEDED, 'Offline cache quota would be exceeded.')
    }
    await database.putComplete(normalizedEntry, blob)
    return normalizedEntry
  }

  async function getBlob(cacheId) {
    const normalizedCacheId = normalizeText(cacheId, 160, true)
    if (!normalizedCacheId) {
      return null
    }
    const database = await getDatabase()
    return (await database.getBlob(normalizedCacheId)) || null
  }

  async function remove(cacheId) {
    const normalizedCacheId = normalizeText(cacheId, 160, true)
    if (!normalizedCacheId) {
      return false
    }
    const entries = await listEntries()
    if (!entries.some((entry) => entry.cacheId === normalizedCacheId)) {
      return false
    }
    const database = await getDatabase()
    await database.remove(normalizedCacheId)
    return true
  }

  async function clear() {
    const entries = await listEntries()
    if (!entries.length) {
      return 0
    }
    const database = await getDatabase()
    await database.clear()
    return entries.length
  }

  async function removeBySource(sourceId) {
    const normalizedSourceId = normalizeText(sourceId, 160, true)
    if (!normalizedSourceId) {
      return 0
    }
    const entries = await listEntries()
    const matchingEntries = entries.filter((entry) => entry.sourceId === normalizedSourceId)
    const database = await getDatabase()
    for (const entry of matchingEntries) {
      await database.remove(entry.cacheId)
    }
    return matchingEntries.length
  }

  return { getQuota, listEntries, putComplete, getBlob, remove, clear, removeBySource }
}
