export const SOURCE_EXECUTION_CONSENT_STORAGE_KEY = 'MUSIC_SHELL_SOURCE_EXECUTION_CONSENTS'

let consentRecords = []
let hydrated = false

function canUseUniStorage() {
  return typeof uni !== 'undefined'
    && typeof uni.getStorageSync === 'function'
    && typeof uni.setStorageSync === 'function'
}

function normalizeSourceId(sourceId) {
  return typeof sourceId === 'string' ? sourceId.trim() : ''
}

function normalizeConsentRecord(record) {
  const sourceId = normalizeSourceId(record?.sourceId)
  const scriptFingerprint = typeof record?.scriptFingerprint === 'string'
    ? record.scriptFingerprint.trim()
    : ''
  const approvedAt = Number(record?.approvedAt)

  if (!sourceId || !scriptFingerprint || !Number.isFinite(approvedAt) || approvedAt <= 0) {
    return null
  }

  return { sourceId, scriptFingerprint, approvedAt }
}

function persistConsentRecords() {
  if (!canUseUniStorage()) {
    return false
  }

  try {
    uni.setStorageSync(SOURCE_EXECUTION_CONSENT_STORAGE_KEY, consentRecords)
    return false
  } catch (error) {
    return true
  }
}

export async function fingerprintSourceScript(script) {
  const value = typeof script === 'string' ? script : ''
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export async function hydrateSourceExecutionConsents(sources = []) {
  if (hydrated) {
    return { persistenceFailed: false }
  }

  let storedRecords = []
  if (canUseUniStorage()) {
    try {
      const storedValue = uni.getStorageSync(SOURCE_EXECUTION_CONSENT_STORAGE_KEY)
      storedRecords = Array.isArray(storedValue) ? storedValue : []
    } catch (error) {
      storedRecords = []
    }
  }

  const currentSources = Array.isArray(sources) ? sources : []
  const fingerprintBySourceId = new Map()
  for (const source of currentSources) {
    const sourceId = normalizeSourceId(source?.id)
    if (!sourceId || typeof source?.script !== 'string') {
      continue
    }
    fingerprintBySourceId.set(sourceId, await fingerprintSourceScript(source.script))
  }

  const latestRecordBySourceId = new Map()
  for (const record of storedRecords) {
    const normalizedRecord = normalizeConsentRecord(record)
    if (!normalizedRecord || fingerprintBySourceId.get(normalizedRecord.sourceId) !== normalizedRecord.scriptFingerprint) {
      continue
    }

    const current = latestRecordBySourceId.get(normalizedRecord.sourceId)
    if (!current || normalizedRecord.approvedAt > current.approvedAt) {
      latestRecordBySourceId.set(normalizedRecord.sourceId, normalizedRecord)
    }
  }

  consentRecords = [...latestRecordBySourceId.values()]
  hydrated = true
  return { persistenceFailed: persistConsentRecords() }
}

export async function hasSourceExecutionConsent(source) {
  const sourceId = normalizeSourceId(source?.id)
  if (!sourceId || typeof source?.script !== 'string') {
    return false
  }

  const scriptFingerprint = await fingerprintSourceScript(source.script)
  return consentRecords.some((record) => record.sourceId === sourceId && record.scriptFingerprint === scriptFingerprint)
}

export async function approveSourceExecution(source, now = Date.now()) {
  const sourceId = normalizeSourceId(source?.id)
  if (!sourceId || typeof source?.script !== 'string') {
    throw new Error('Source execution consent requires a source id and script.')
  }

  const scriptFingerprint = await fingerprintSourceScript(source.script)
  consentRecords = consentRecords.filter((record) => record.sourceId !== sourceId)
  consentRecords.push({
    sourceId,
    scriptFingerprint,
    approvedAt: Number(now) || Date.now()
  })
  hydrated = true
  return { persistenceFailed: persistConsentRecords() }
}

export function removeSourceExecutionConsent(sourceId) {
  const normalizedSourceId = normalizeSourceId(sourceId)
  if (!normalizedSourceId) {
    return { removed: false, persistenceFailed: false }
  }

  const beforeCount = consentRecords.length
  consentRecords = consentRecords.filter((record) => record.sourceId !== normalizedSourceId)
  const removed = consentRecords.length !== beforeCount
  return {
    removed,
    persistenceFailed: removed ? persistConsentRecords() : false
  }
}
