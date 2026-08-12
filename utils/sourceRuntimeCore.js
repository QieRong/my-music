export const SOURCE_RUNTIME_ERROR_CODES = {
  UNSUPPORTED_RUNTIME: 'UNSUPPORTED_RUNTIME',
  REQUEST_PROTOCOL: 'REQUEST_PROTOCOL',
  REQUEST_METHOD: 'REQUEST_METHOD',
  REQUEST_CREDENTIALS: 'REQUEST_CREDENTIALS',
  REQUEST_BODY_TOO_LARGE: 'REQUEST_BODY_TOO_LARGE',
  RESPONSE_TOO_LARGE: 'RESPONSE_TOO_LARGE',
  SOURCE_TIMEOUT: 'SOURCE_TIMEOUT',
  SOURCE_RUNTIME: 'SOURCE_RUNTIME',
  INVALID_RESULT: 'INVALID_RESULT',
  PLAY_URL_INVALID: 'PLAY_URL_INVALID',
  DOWNLOAD_URL_INVALID: 'DOWNLOAD_URL_INVALID',
  DOWNLOAD_UNAVAILABLE: 'DOWNLOAD_UNAVAILABLE',
  CORS_OR_NETWORK: 'CORS_OR_NETWORK'
}

const MAX_REQUEST_BODY_BYTES = 65536
const MAX_RESPONSE_BYTES = 1048576
const MAX_RESULTS_PER_SOURCE = 20

function createRuntimeError(code, message) {
  const error = new Error(message)
  error.code = code
  return error
}

function byteLength(value) {
  return new TextEncoder().encode(value).byteLength
}

function normalizeHeaders(headers) {
  if (!headers || typeof headers !== 'object' || Array.isArray(headers)) {
    return {}
  }

  return Object.entries(headers).reduce((result, [key, value]) => {
    if (typeof key === 'string' && key.trim() && typeof value === 'string') {
      result[key] = value
    }
    return result
  }, {})
}

function normalizeRequestBody(body) {
  if (typeof body === 'undefined' || body === null) {
    return undefined
  }

  if (typeof body === 'string') {
    return body
  }

  try {
    return JSON.stringify(body)
  } catch (error) {
    throw createRuntimeError(SOURCE_RUNTIME_ERROR_CODES.REQUEST_BODY_TOO_LARGE, 'Request body cannot be serialized.')
  }
}

export function validateSourceRequest(options) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw createRuntimeError(SOURCE_RUNTIME_ERROR_CODES.REQUEST_PROTOCOL, 'Source request options must be an object.')
  }
  if (Object.prototype.hasOwnProperty.call(options, 'credentials')) {
    throw createRuntimeError(SOURCE_RUNTIME_ERROR_CODES.REQUEST_CREDENTIALS, 'Source requests cannot include credentials.')
  }

  let parsedUrl
  try {
    parsedUrl = new URL(options.url)
  } catch (error) {
    throw createRuntimeError(SOURCE_RUNTIME_ERROR_CODES.REQUEST_PROTOCOL, 'Source request URL must be HTTPS.')
  }
  if (parsedUrl.protocol !== 'https:') {
    throw createRuntimeError(SOURCE_RUNTIME_ERROR_CODES.REQUEST_PROTOCOL, 'Source request URL must be HTTPS.')
  }

  const method = String(options.method || 'GET').toUpperCase()
  if (!['GET', 'POST'].includes(method)) {
    throw createRuntimeError(SOURCE_RUNTIME_ERROR_CODES.REQUEST_METHOD, 'Source request method must be GET or POST.')
  }

  const body = normalizeRequestBody(options.body)
  if (typeof body === 'string' && byteLength(body) > MAX_REQUEST_BODY_BYTES) {
    throw createRuntimeError(SOURCE_RUNTIME_ERROR_CODES.REQUEST_BODY_TOO_LARGE, 'Source request body is too large.')
  }

  const request = {
    url: parsedUrl.href,
    method,
    headers: normalizeHeaders(options.headers)
  }
  if (typeof body === 'string') {
    request.body = body
  }
  return request
}

export async function readLimitedResponse(response) {
  const text = await response?.text?.()
  if (typeof text !== 'string') {
    throw createRuntimeError(SOURCE_RUNTIME_ERROR_CODES.CORS_OR_NETWORK, 'Source response text is unavailable.')
  }
  if (byteLength(text) > MAX_RESPONSE_BYTES) {
    throw createRuntimeError(SOURCE_RUNTIME_ERROR_CODES.RESPONSE_TOO_LARGE, 'Source response is too large.')
  }
  return text
}

function validateTemporaryMediaUrl(value, errorCode, label) {
  const rawUrl = typeof value === 'string' ? value : value?.url
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) {
    throw createRuntimeError(errorCode, `${label} URL must be a non-empty HTTPS URL.`)
  }

  let parsedUrl
  try {
    parsedUrl = new URL(rawUrl.trim())
  } catch (error) {
    throw createRuntimeError(errorCode, `${label} URL must be HTTPS.`)
  }
  if (parsedUrl.protocol !== 'https:' || !parsedUrl.hostname || parsedUrl.username || parsedUrl.password || parsedUrl.href.length > 2048) {
    throw createRuntimeError(errorCode, `${label} URL is not allowed.`)
  }
  return parsedUrl.href
}

export function validatePlayUrl(value) {
  return validateTemporaryMediaUrl(value, SOURCE_RUNTIME_ERROR_CODES.PLAY_URL_INVALID, 'Play')
}

export function validateDownloadUrl(value) {
  return validateTemporaryMediaUrl(value, SOURCE_RUNTIME_ERROR_CODES.DOWNLOAD_URL_INVALID, 'Download')
}

function normalizeRequiredText(value, maxLength) {
  if (typeof value !== 'string') {
    return null
  }
  const normalized = value.trim()
  return normalized && normalized.length <= maxLength ? normalized : null
}

function normalizeOptionalText(value, maxLength) {
  if (typeof value === 'undefined' || value === null || value === '') {
    return ''
  }
  if (typeof value !== 'string') {
    return null
  }
  const normalized = value.trim()
  return normalized.length <= maxLength ? normalized : null
}

function normalizeDuration(value) {
  if (typeof value === 'undefined' || value === null || value === '') {
    return null
  }
  return Number.isInteger(value) && value >= 0 && value <= 86400 ? value : null
}

export function mapOnlineSearchResults(source, rawResults) {
  const sourceId = normalizeRequiredText(source?.id, 160)
  const sourceName = normalizeRequiredText(source?.name, 200)
  if (!sourceId || !sourceName || !Array.isArray(rawResults)) {
    return { results: [], invalidCount: Array.isArray(rawResults) ? rawResults.length : 0 }
  }

  const results = []
  let invalidCount = 0
  for (const rawResult of rawResults.slice(0, MAX_RESULTS_PER_SOURCE)) {
    const trackId = normalizeRequiredText(rawResult?.trackId, 160)
    const title = normalizeRequiredText(rawResult?.title, 200)
    const artist = normalizeOptionalText(rawResult?.artist, 200)
    const album = normalizeOptionalText(rawResult?.album, 200)
    const duration = normalizeDuration(rawResult?.duration)
    const durationInvalid = rawResult?.duration !== undefined
      && rawResult?.duration !== null
      && rawResult?.duration !== ''
      && duration === null

    if (!trackId || !title || artist === null || album === null || durationInvalid) {
      invalidCount += 1
      continue
    }

    results.push({
      id: `online:${sourceId}:${trackId}`,
      sourceId,
      sourceName,
      trackId,
      title,
      artist,
      album,
      duration
    })
  }
  return { results, invalidCount }
}
