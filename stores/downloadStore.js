import { reactive } from 'vue'
import { fingerprintSourceScript, hasSourceExecutionConsent } from '../utils/sourceExecutionConsent.js'
import { createOfflineCache } from '../utils/offlineCache.js'
import { createSourceSearchRuntime } from '../utils/sourceRuntime.js'

export const downloadState = reactive({
  pending: null,
  tasks: [],
  cachedTracks: [],
  quota: {
    limitBytes: 0,
    usedBytes: 0,
    availableBytes: 0,
    estimateAvailable: false
  }
})

let runtime = createSourceSearchRuntime()
let cache = createOfflineCache()
let fetchImpl = typeof fetch === 'function' ? fetch : null
let hasConsent = hasSourceExecutionConsent
let fingerprint = fingerprintSourceScript
let now = () => Date.now()
let cacheIdCounter = 0
const activeDownloads = new Map()

function createCacheId() {
  cacheIdCounter += 1
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `cache:${crypto.randomUUID()}`
  }
  return `cache:${now()}:${cacheIdCounter}`
}

function createTask(result, source) {
  return {
    id: String(result?.id || ''),
    sourceId: source.id,
    sourceName: source.name,
    trackId: String(result?.trackId || ''),
    title: String(result?.title || ''),
    status: 'preparing',
    receivedBytes: 0,
    totalBytes: 0,
    errorCode: ''
  }
}

function getTask(resultId) {
  return downloadState.tasks.find((task) => task.id === resultId) || null
}

function matchesCachedResult(entry, result) {
  return String(entry?.sourceId || '') === String(result?.sourceId || '')
    && String(entry?.trackId || '') === String(result?.trackId || '')
}

async function getDuplicateDownloadError(result) {
  const resultId = String(result?.id || '')
  if (resultId && activeDownloads.has(resultId)) {
    return 'DOWNLOAD_IN_PROGRESS'
  }
  const entries = await cache.listEntries()
  return entries.some((entry) => matchesCachedResult(entry, result))
    ? 'DOWNLOAD_ALREADY_CACHED'
    : ''
}

function updateQuota(quota) {
  if (!quota || typeof quota !== 'object') {
    return
  }
  downloadState.quota = {
    limitBytes: Number(quota.limitBytes) || 0,
    usedBytes: Number(quota.usedBytes) || 0,
    availableBytes: Number(quota.availableBytes) || 0,
    estimateAvailable: quota.estimateAvailable === true
  }
}

function syncCachedTracks(entries) {
  downloadState.cachedTracks = (Array.isArray(entries) ? entries : []).map((entry) => ({
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
}

async function refreshCacheState() {
  const [entries, quota] = await Promise.all([cache.listEntries(), cache.getQuota()])
  syncCachedTracks(entries)
  updateQuota(quota)
}

export function configureDownloadRuntime(options = {}) {
  runtime = options.runtime || createSourceSearchRuntime()
  cache = options.cache || createOfflineCache()
  fetchImpl = options.fetchImpl === undefined ? (typeof fetch === 'function' ? fetch : null) : options.fetchImpl
  hasConsent = options.hasConsent || hasSourceExecutionConsent
  fingerprint = options.fingerprint || fingerprintSourceScript
  now = options.now || (() => Date.now())
  activeDownloads.clear()
  downloadState.pending = null
  downloadState.tasks = []
  downloadState.cachedTracks = []
  updateQuota({})
}

export function getEligibleDownloadSource(result, sources) {
  const sourceId = String(result?.sourceId || '')
  return (Array.isArray(sources) ? sources : []).find((source) => {
    return source?.id === sourceId
      && source.enabled === true
      && Array.isArray(source.capabilities)
      && source.capabilities.includes('download')
  }) || null
}

export async function prepareDownload(result, sources) {
  const source = getEligibleDownloadSource(result, sources)
  if (!source) {
    return { status: 'failed', errorCode: 'DOWNLOAD_UNAVAILABLE' }
  }
  if (!await hasConsent(source)) {
    return { status: 'failed', errorCode: 'CONSENT_REQUIRED' }
  }
  const duplicateError = await getDuplicateDownloadError(result)
  if (duplicateError) {
    return { status: 'failed', errorCode: duplicateError }
  }
  downloadState.pending = { result, source }
  return { status: 'requires_copyright_confirmation', sourceId: source.id }
}

function readContentLength(response) {
  const value = Number(response?.headers?.get?.('content-length'))
  return Number.isFinite(value) && value >= 0 ? value : 0
}

async function readCompleteBlob(response, task, job) {
  const totalBytes = readContentLength(response)
  const quota = await cache.getQuota()
  updateQuota(quota)
  if (totalBytes && totalBytes > quota.availableBytes) {
    const error = new Error('Download exceeds the available cache quota.')
    error.code = 'CACHE_QUOTA_EXCEEDED'
    throw error
  }
  task.totalBytes = totalBytes

  const reader = response?.body?.getReader?.()
  if (!reader) {
    const blob = await response?.blob?.()
    if (!blob || blob.size > quota.availableBytes) {
      const error = new Error('Download body is unavailable or exceeds quota.')
      error.code = blob ? 'CACHE_QUOTA_EXCEEDED' : 'DOWNLOAD_RESPONSE_INVALID'
      throw error
    }
    task.receivedBytes = blob.size
    task.totalBytes = blob.size
    return blob
  }

  job.reader = reader
  const chunks = []
  let receivedBytes = 0
  while (true) {
    const part = await reader.read()
    if (job.cancelled) {
      return null
    }
    if (part?.done) {
      break
    }
    if (!(part?.value instanceof Uint8Array)) {
      const error = new Error('Download stream chunk is invalid.')
      error.code = 'DOWNLOAD_RESPONSE_INVALID'
      throw error
    }
    receivedBytes += part.value.byteLength
    if (receivedBytes > quota.availableBytes) {
      const error = new Error('Download exceeds the available cache quota.')
      error.code = 'CACHE_QUOTA_EXCEEDED'
      throw error
    }
    chunks.push(part.value)
    task.receivedBytes = receivedBytes
    if (!task.totalBytes) {
      task.totalBytes = receivedBytes
    }
  }

  if (!receivedBytes || (totalBytes && receivedBytes !== totalBytes)) {
    const error = new Error('Download body size is invalid.')
    error.code = 'DOWNLOAD_SIZE_INVALID'
    throw error
  }
  task.receivedBytes = receivedBytes
  task.totalBytes = totalBytes || receivedBytes
  return new Blob(chunks, { type: response?.headers?.get?.('content-type') || 'application/octet-stream' })
}

export async function approveAndDownload() {
  const pending = downloadState.pending
  downloadState.pending = null
  if (!pending) {
    return { status: 'failed', errorCode: 'DOWNLOAD_CONFIRMATION_REQUIRED' }
  }
  const { result, source } = pending
  if (!getEligibleDownloadSource(result, [source]) || !await hasConsent(source)) {
    return { status: 'failed', errorCode: 'DOWNLOAD_UNAVAILABLE' }
  }
  const duplicateError = await getDuplicateDownloadError(result)
  if (duplicateError) {
    return { status: 'failed', errorCode: duplicateError }
  }
  if (typeof fetchImpl !== 'function') {
    return { status: 'failed', errorCode: 'UNSUPPORTED_RUNTIME' }
  }

  const task = createTask(result, source)
  downloadState.tasks = [...downloadState.tasks.filter((item) => item.id !== task.id), task]
  const controller = typeof AbortController === 'function' ? new AbortController() : null
  const job = { cancelled: false, controller, reader: null }
  activeDownloads.set(task.id, job)

  try {
    task.status = 'resolving'
    const urlResult = await runtime.runDownloadUrl(source, result)
    if (job.cancelled) {
      task.status = 'cancelled'
      return { status: 'cancelled' }
    }
    if (urlResult.status !== 'success' || !urlResult.url) {
      task.status = urlResult.status === 'timeout' ? 'timeout' : 'failed'
      task.errorCode = String(urlResult.errorCode || 'DOWNLOAD_URL_UNAVAILABLE')
      return { status: task.status, errorCode: task.errorCode }
    }

    task.status = 'downloading'
    const response = await fetchImpl(urlResult.url, {
      method: 'GET',
      credentials: 'omit',
      ...(controller ? { signal: controller.signal } : {})
    })
    if (!response?.ok) {
      const error = new Error('Download request failed.')
      error.code = 'DOWNLOAD_NETWORK'
      throw error
    }
    const blob = await readCompleteBlob(response, task, job)
    if (job.cancelled || !blob) {
      task.status = 'cancelled'
      return { status: 'cancelled' }
    }

    task.status = 'saving'
    const sourceFingerprint = await fingerprint(source.script)
    const cachedTrack = await cache.putComplete({
      cacheId: createCacheId(),
      sourceId: source.id,
      sourceFingerprint,
      trackId: result.trackId,
      title: result.title,
      artist: result.artist,
      album: result.album,
      duration: result.duration
    }, blob)
    if (job.cancelled) {
      await cache.remove(cachedTrack.cacheId)
      task.status = 'cancelled'
      return { status: 'cancelled' }
    }
    task.status = 'completed'
    await refreshCacheState()
    return { status: 'completed', cacheId: cachedTrack.cacheId }
  } catch (error) {
    if (job.cancelled || error?.name === 'AbortError') {
      task.status = 'cancelled'
      return { status: 'cancelled' }
    }
    task.status = 'failed'
    task.errorCode = String(error?.code || 'DOWNLOAD_NETWORK')
    return { status: 'failed', errorCode: task.errorCode }
  } finally {
    activeDownloads.delete(task.id)
  }
}

export function cancelDownload(resultId) {
  const taskId = String(resultId || '')
  const job = activeDownloads.get(taskId)
  if (!job) {
    return false
  }
  job.cancelled = true
  job.controller?.abort?.()
  job.reader?.cancel?.()
  const task = getTask(taskId)
  if (task) {
    task.status = 'cancelled'
    task.errorCode = ''
  }
  return true
}

export async function hydrateDownloads() {
  try {
    await refreshCacheState()
    return { status: 'success' }
  } catch (error) {
    updateQuota({})
    return { status: 'failed', errorCode: String(error?.code || 'CACHE_UNAVAILABLE') }
  }
}

export async function removeCachedTrack(cacheId) {
  const removed = await cache.remove(cacheId)
  await refreshCacheState()
  return removed
}

export async function clearCachedTracks() {
  const count = await cache.clear()
  await refreshCacheState()
  return count
}

export async function removeCachedDownloadsForSource(sourceId) {
  try {
    const count = await cache.removeBySource(sourceId)
    await refreshCacheState()
    return count
  } catch (error) {
    return 0
  }
}
