import { reactive } from 'vue'
import {
  approveSourceExecution,
  hasSourceExecutionConsent
} from '../utils/sourceExecutionConsent.js'
import { createSourceSearchRuntime } from '../utils/sourceRuntime.js'

export const onlineSearchState = reactive({
  scope: 'local',
  keyword: '',
  requestVersion: 0,
  sourceGroups: [],
  status: 'idle',
  pendingConsentSources: []
})

let runtime = createSourceSearchRuntime()
let hasConsent = hasSourceExecutionConsent
let approveConsent = approveSourceExecution
let latestSources = []

export function configureOnlineSearchRuntime(options = {}) {
  runtime = options.runtime || createSourceSearchRuntime()
  hasConsent = options.hasConsent || hasSourceExecutionConsent
  approveConsent = options.approveConsent || approveSourceExecution
}

export function getEligibleSearchSources(sources) {
  return (Array.isArray(sources) ? sources : []).filter((source) => {
    return source?.enabled === true && Array.isArray(source.capabilities) && source.capabilities.includes('search')
  })
}

function getOverallStatus(groups) {
  if (!groups.length) {
    return 'empty'
  }
  const completedGroups = groups.filter((group) => ['success', 'empty'].includes(group.status))
  const failedGroups = groups.filter((group) => ['failed', 'timeout'].includes(group.status))
  if (completedGroups.length && failedGroups.length) {
    return 'partial'
  }
  if (failedGroups.length === groups.length) {
    return 'failed'
  }
  if (groups.some((group) => group.status === 'success')) {
    return 'success'
  }
  return 'empty'
}

function normalizeGroups(groups) {
  return (Array.isArray(groups) ? groups : []).map((group) => ({
    sourceId: String(group?.sourceId || ''),
    sourceName: String(group?.sourceName || ''),
    status: group?.status || 'failed',
    results: Array.isArray(group?.results) ? group.results : [],
    invalidCount: Number(group?.invalidCount) || 0,
    errorCode: String(group?.errorCode || '')
  }))
}

function invalidateRunningSearch() {
  onlineSearchState.requestVersion += 1
  runtime.cancelAll()
  return onlineSearchState.requestVersion
}

async function executeSources(sources, keyword, requestVersion = onlineSearchState.requestVersion) {
  onlineSearchState.status = 'running'
  onlineSearchState.sourceGroups = []
  const groups = normalizeGroups(await runtime.runMany(sources, { keyword, page: 1, limit: 20 }))
  if (requestVersion !== onlineSearchState.requestVersion) {
    return { status: 'cancelled' }
  }

  onlineSearchState.sourceGroups = groups
  onlineSearchState.status = getOverallStatus(groups)
  return { status: onlineSearchState.status, groups }
}

export async function prepareOnlineSearch(keyword, sources) {
  const normalizedKeyword = String(keyword || '').trim()
  const requestVersion = invalidateRunningSearch()
  onlineSearchState.keyword = normalizedKeyword
  onlineSearchState.sourceGroups = []
  onlineSearchState.pendingConsentSources = []
  onlineSearchState.status = 'idle'
  latestSources = getEligibleSearchSources(sources)

  if (!normalizedKeyword) {
    return { status: 'empty_keyword' }
  }
  if (!latestSources.length) {
    return { status: 'no_sources' }
  }

  const pendingConsentSources = []
  for (const source of latestSources) {
    if (!await hasConsent(source)) {
      pendingConsentSources.push(source)
    }
  }
  if (pendingConsentSources.length) {
    onlineSearchState.pendingConsentSources = pendingConsentSources
    onlineSearchState.status = 'requires_consent'
    return { status: 'requires_consent', sources: pendingConsentSources }
  }

  return executeSources(latestSources, normalizedKeyword, requestVersion)
}

export async function approveAndSearch() {
  const pendingConsentSources = [...onlineSearchState.pendingConsentSources]
  if (!pendingConsentSources.length) {
    return { status: 'no_pending_consent' }
  }

  let persistenceFailed = false
  for (const source of pendingConsentSources) {
    const result = await approveConsent(source)
    persistenceFailed = persistenceFailed || Boolean(result?.persistenceFailed)
  }
  onlineSearchState.pendingConsentSources = []
  const result = await executeSources(latestSources, onlineSearchState.keyword, onlineSearchState.requestVersion)
  return { ...result, persistenceFailed }
}

export function cancelOnlineSearch() {
  invalidateRunningSearch()
  onlineSearchState.sourceGroups = []
  onlineSearchState.pendingConsentSources = []
  onlineSearchState.status = 'idle'
}

export function clearOnlineSearchResults() {
  cancelOnlineSearch()
  onlineSearchState.keyword = ''
  latestSources = []
}

export async function retryOnlineSearch() {
  return prepareOnlineSearch(onlineSearchState.keyword, latestSources)
}
