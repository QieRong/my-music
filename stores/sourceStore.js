import { computed, reactive } from 'vue'
import { parseSourceDefinition } from '../utils/sourceDefinition.js'
import { removeSourceExecutionConsent } from '../utils/sourceExecutionConsent.js'
import { stopOnlinePlaybackForSource } from './onlinePlaybackStore.js'
import { removeCachedDownloadsForSource } from './downloadStore.js'

export const SOURCE_STORAGE_KEY = 'MUSIC_SHELL_SOURCES'

export const sourceState = reactive({
  hydrated: false,
  items: []
})

export const sourceCount = computed(() => sourceState.items.length)
export const enabledSourceCount = computed(() => sourceState.items.filter((source) => source.enabled).length)

function canUseUniStorage() {
  return typeof uni !== 'undefined'
    && typeof uni.getStorageSync === 'function'
    && typeof uni.setStorageSync === 'function'
    && typeof uni.removeStorageSync === 'function'
}

function normalizeStoredSource(source) {
  if (!source || typeof source !== 'object' || typeof source.script !== 'string') {
    return null
  }

  try {
    const importedAt = Number(source.importedAt) || Date.now()
    const parsed = parseSourceDefinition(source.script, importedAt)
    return {
      ...parsed,
      enabled: Boolean(source.enabled),
      importedAt,
      updatedAt: Number(source.updatedAt) || importedAt
    }
  } catch (error) {
    return null
  }
}

function persistSources() {
  if (!canUseUniStorage()) {
    return true
  }

  try {
    uni.setStorageSync(SOURCE_STORAGE_KEY, sourceState.items)
    return true
  } catch (error) {
    return false
  }
}

export function hydrateSources() {
  if (sourceState.hydrated) {
    return
  }

  let storedSources = []
  if (canUseUniStorage()) {
    try {
      const storedValue = uni.getStorageSync(SOURCE_STORAGE_KEY)
      storedSources = Array.isArray(storedValue) ? storedValue : []
    } catch (error) {
      storedSources = []
    }
  }

  sourceState.items = storedSources.map(normalizeStoredSource).filter(Boolean)
  sourceState.hydrated = true
}

export function prepareSourceImport(script, now = Date.now()) {
  return parseSourceDefinition(script, now)
}

export function savePreparedSource(preparedSource, options = {}) {
  hydrateSources()
  const source = normalizeStoredSource(preparedSource)
  if (!source) {
    throw new Error('Prepared source is invalid.')
  }

  const existingIndex = sourceState.items.findIndex((item) => item.id === source.id)
  if (existingIndex >= 0 && !options.replace) {
    return {
      status: 'requires_replace',
      source: sourceState.items[existingIndex],
      persistenceFailed: false
    }
  }

  if (existingIndex >= 0) {
    const consentResult = removeSourceExecutionConsent(source.id)
    stopOnlinePlaybackForSource(source.id)
    void removeCachedDownloadsForSource(source.id)
    sourceState.items.splice(existingIndex, 1, source)
    const persistenceFailed = !persistSources()
    return {
      status: 'updated',
      source,
      persistenceFailed,
      consentPersistenceFailed: consentResult.persistenceFailed
    }
  } else {
    sourceState.items.push(source)
  }

  return {
    status: 'added',
    source,
    persistenceFailed: !persistSources(),
    consentPersistenceFailed: false
  }
}

export function setSourceEnabled(sourceId, enabled) {
  hydrateSources()
  const source = sourceState.items.find((item) => item.id === sourceId)
  if (!source) {
    return null
  }

  source.enabled = Boolean(enabled)
  source.updatedAt = Date.now()
  if (!source.enabled) {
    stopOnlinePlaybackForSource(source.id)
    void removeCachedDownloadsForSource(source.id)
  }
  return {
    ...source,
    persistenceFailed: !persistSources()
  }
}

export function removeSource(sourceId) {
  hydrateSources()
  const beforeCount = sourceState.items.length
  sourceState.items = sourceState.items.filter((item) => item.id !== sourceId)
  const removed = sourceState.items.length !== beforeCount
  if (removed) {
    stopOnlinePlaybackForSource(sourceId)
    void removeCachedDownloadsForSource(sourceId)
  }
  const consentResult = removed
    ? removeSourceExecutionConsent(sourceId)
    : { persistenceFailed: false }
  return {
    removed,
    persistenceFailed: removed && !persistSources(),
    consentPersistenceFailed: consentResult.persistenceFailed
  }
}
