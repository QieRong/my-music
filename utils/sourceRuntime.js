import {
  SOURCE_RUNTIME_ERROR_CODES,
  mapOnlineSearchResults,
  readLimitedResponse,
  validateDownloadUrl,
  validatePlayUrl,
  validateSourceRequest
} from './sourceRuntimeCore.js'

const DEFAULT_TIMEOUT_MS = 8000
const MAX_CONCURRENT_WORKERS = 3

function createResult(source, status, overrides = {}) {
  return {
    sourceId: source?.id || '',
    sourceName: source?.name || '',
    status,
    results: [],
    invalidCount: 0,
    errorCode: '',
    ...overrides
  }
}

function createPlayUrlResult(source, status, overrides = {}) {
  return {
    sourceId: source?.id || '',
    sourceName: source?.name || '',
    status,
    url: '',
    errorCode: '',
    ...overrides
  }
}

function createDownloadUrlResult(source, status, overrides = {}) {
  return {
    sourceId: source?.id || '',
    sourceName: source?.name || '',
    status,
    url: '',
    errorCode: '',
    ...overrides
  }
}

function getResponsePayload(text) {
  try {
    return { text, json: JSON.parse(text) }
  } catch (error) {
    return { text, json: null }
  }
}

export function createSourceSearchRuntime(options = {}) {
  const WorkerClass = options.WorkerClass === undefined
    ? (typeof Worker === 'undefined' ? null : Worker)
    : options.WorkerClass
  const fetchImpl = options.fetchImpl === undefined
    ? (typeof fetch === 'undefined' ? null : fetch)
    : options.fetchImpl
  const timeoutMs = Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : DEFAULT_TIMEOUT_MS
  const activeRuns = new Map()
  let requestCounter = 0
  let runGeneration = 0

  function cleanupRun(run) {
    clearTimeout(run.timer)
    activeRuns.delete(run.requestId)
    run.worker.terminate()
  }

  function finishRun(run, result) {
    if (!activeRuns.has(run.requestId)) {
      return
    }
    cleanupRun(run)
    run.resolve(result)
  }

  async function bridgeRequest(run, message) {
    try {
      const request = validateSourceRequest(message.options)
      if (typeof fetchImpl !== 'function') {
        throw Object.assign(new Error('Fetch is unavailable.'), { code: SOURCE_RUNTIME_ERROR_CODES.UNSUPPORTED_RUNTIME })
      }
      const response = await fetchImpl(request.url, {
        method: request.method,
        headers: request.headers,
        ...(request.body === undefined ? {} : { body: request.body }),
        credentials: 'omit'
      })
      const text = await readLimitedResponse(response)
      if (!activeRuns.has(run.requestId) || run.generation !== runGeneration) {
        return
      }
      run.worker.postMessage({
        type: 'request-response',
        requestId: run.requestId,
        requestToken: message.requestToken,
        ok: true,
        response: getResponsePayload(text)
      })
    } catch (error) {
      if (!activeRuns.has(run.requestId) || run.generation !== runGeneration) {
        return
      }
      const errorCode = error?.code || SOURCE_RUNTIME_ERROR_CODES.CORS_OR_NETWORK
      run.worker.postMessage({
        type: 'request-response',
        requestId: run.requestId,
        requestToken: message.requestToken,
        ok: false,
        errorCode
      })
    }
  }

  function run(source, query = {}) {
    if (typeof WorkerClass !== 'function') {
      return Promise.resolve(createResult(source, 'failed', {
        errorCode: SOURCE_RUNTIME_ERROR_CODES.UNSUPPORTED_RUNTIME
      }))
    }

    const generation = runGeneration
    const requestId = `source-search:${requestCounter += 1}`
    return new Promise((resolve) => {
      let worker
      try {
        worker = new WorkerClass(new URL('./sourceRuntimeWorker.js', import.meta.url), { type: 'module' })
      } catch (error) {
        resolve(createResult(source, 'failed', { errorCode: SOURCE_RUNTIME_ERROR_CODES.UNSUPPORTED_RUNTIME }))
        return
      }

      const run = {
        requestId,
        source,
        kind: 'search',
        worker,
        generation,
        resolve,
        timer: null
      }
      activeRuns.set(requestId, run)
      worker.onmessage = (event) => {
        const message = event?.data || {}
        if (!activeRuns.has(requestId) || run.generation !== runGeneration || message.requestId !== requestId) {
          return
        }
        if (message.type === 'request') {
          bridgeRequest(run, message)
          return
        }
        if (message.type === 'result') {
          const mapped = mapOnlineSearchResults(source, message.results)
          finishRun(run, createResult(source, mapped.results.length ? 'success' : 'empty', mapped))
          return
        }
        if (message.type === 'error') {
          finishRun(run, createResult(source, 'failed', {
            errorCode: message.errorCode || SOURCE_RUNTIME_ERROR_CODES.SOURCE_RUNTIME
          }))
        }
      }
      worker.onerror = () => {
        finishRun(run, createResult(source, 'failed', { errorCode: SOURCE_RUNTIME_ERROR_CODES.SOURCE_RUNTIME }))
      }
      run.timer = setTimeout(() => {
        finishRun(run, createResult(source, 'timeout', { errorCode: SOURCE_RUNTIME_ERROR_CODES.SOURCE_TIMEOUT }))
      }, timeoutMs)
      worker.postMessage({
        type: 'run-search',
        requestId,
        script: source?.script || '',
        keyword: String(query.keyword || '').trim(),
        page: 1,
        limit: 20
      })
    })
  }

  function runPlayUrl(source, track = {}) {
    if (typeof WorkerClass !== 'function') {
      return Promise.resolve(createPlayUrlResult(source, 'failed', {
        errorCode: SOURCE_RUNTIME_ERROR_CODES.UNSUPPORTED_RUNTIME
      }))
    }

    const generation = runGeneration
    const requestId = `source-play-url:${requestCounter += 1}`
    return new Promise((resolve) => {
      let worker
      try {
        worker = new WorkerClass(new URL('./sourceRuntimeWorker.js', import.meta.url), { type: 'module' })
      } catch (error) {
        resolve(createPlayUrlResult(source, 'failed', { errorCode: SOURCE_RUNTIME_ERROR_CODES.UNSUPPORTED_RUNTIME }))
        return
      }

      const run = {
        requestId,
        source,
        kind: 'play-url',
        worker,
        generation,
        resolve,
        timer: null
      }
      activeRuns.set(requestId, run)
      worker.onmessage = (event) => {
        const message = event?.data || {}
        if (!activeRuns.has(requestId) || run.generation !== runGeneration || message.requestId !== requestId) {
          return
        }
        if (message.type === 'request') {
          bridgeRequest(run, message)
          return
        }
        if (message.type === 'result-play-url') {
          try {
            finishRun(run, createPlayUrlResult(source, 'success', { url: validatePlayUrl(message.playUrl) }))
          } catch (error) {
            finishRun(run, createPlayUrlResult(source, 'failed', {
              errorCode: error?.code || SOURCE_RUNTIME_ERROR_CODES.PLAY_URL_INVALID
            }))
          }
          return
        }
        if (message.type === 'error') {
          finishRun(run, createPlayUrlResult(source, 'failed', {
            errorCode: message.errorCode || SOURCE_RUNTIME_ERROR_CODES.SOURCE_RUNTIME
          }))
        }
      }
      worker.onerror = () => {
        finishRun(run, createPlayUrlResult(source, 'failed', { errorCode: SOURCE_RUNTIME_ERROR_CODES.SOURCE_RUNTIME }))
      }
      run.timer = setTimeout(() => {
        finishRun(run, createPlayUrlResult(source, 'timeout', { errorCode: SOURCE_RUNTIME_ERROR_CODES.SOURCE_TIMEOUT }))
      }, timeoutMs)
      worker.postMessage({
        type: 'run-play-url',
        requestId,
        script: source?.script || '',
        track: {
          trackId: String(track?.trackId || ''),
          title: String(track?.title || ''),
          artist: String(track?.artist || ''),
          album: String(track?.album || '')
        }
      })
    })
  }

  function runDownloadUrl(source, track = {}) {
    if (typeof WorkerClass !== 'function') {
      return Promise.resolve(createDownloadUrlResult(source, 'failed', {
        errorCode: SOURCE_RUNTIME_ERROR_CODES.UNSUPPORTED_RUNTIME
      }))
    }

    const generation = runGeneration
    const requestId = `source-download-url:${requestCounter += 1}`
    return new Promise((resolve) => {
      let worker
      try {
        worker = new WorkerClass(new URL('./sourceRuntimeWorker.js', import.meta.url), { type: 'module' })
      } catch (error) {
        resolve(createDownloadUrlResult(source, 'failed', { errorCode: SOURCE_RUNTIME_ERROR_CODES.UNSUPPORTED_RUNTIME }))
        return
      }

      const run = {
        requestId,
        source,
        kind: 'download-url',
        worker,
        generation,
        resolve,
        timer: null
      }
      activeRuns.set(requestId, run)
      worker.onmessage = (event) => {
        const message = event?.data || {}
        if (!activeRuns.has(requestId) || run.generation !== runGeneration || message.requestId !== requestId) {
          return
        }
        if (message.type === 'request') {
          bridgeRequest(run, message)
          return
        }
        if (message.type === 'result-download-url') {
          try {
            finishRun(run, createDownloadUrlResult(source, 'success', { url: validateDownloadUrl(message.downloadUrl) }))
          } catch (error) {
            finishRun(run, createDownloadUrlResult(source, 'failed', {
              errorCode: error?.code || SOURCE_RUNTIME_ERROR_CODES.DOWNLOAD_URL_INVALID
            }))
          }
          return
        }
        if (message.type === 'error') {
          finishRun(run, createDownloadUrlResult(source, 'failed', {
            errorCode: message.errorCode || SOURCE_RUNTIME_ERROR_CODES.SOURCE_RUNTIME
          }))
        }
      }
      worker.onerror = () => {
        finishRun(run, createDownloadUrlResult(source, 'failed', { errorCode: SOURCE_RUNTIME_ERROR_CODES.SOURCE_RUNTIME }))
      }
      run.timer = setTimeout(() => {
        finishRun(run, createDownloadUrlResult(source, 'timeout', { errorCode: SOURCE_RUNTIME_ERROR_CODES.SOURCE_TIMEOUT }))
      }, timeoutMs)
      worker.postMessage({
        type: 'run-download-url',
        requestId,
        script: source?.script || '',
        track: {
          trackId: String(track?.trackId || ''),
          title: String(track?.title || ''),
          artist: String(track?.artist || ''),
          album: String(track?.album || '')
        }
      })
    })
  }

  async function runMany(sources, query = {}) {
    const sourceList = Array.isArray(sources) ? sources : []
    const generation = runGeneration
    const results = new Array(sourceList.length)
    let nextIndex = 0
    async function runNext() {
      while (nextIndex < sourceList.length) {
        const currentIndex = nextIndex
        nextIndex += 1
        if (generation !== runGeneration) {
          results[currentIndex] = createResult(sourceList[currentIndex], 'failed', {
            errorCode: SOURCE_RUNTIME_ERROR_CODES.SOURCE_RUNTIME
          })
          continue
        }
        results[currentIndex] = await run(sourceList[currentIndex], query)
      }
    }
    await Promise.all(Array.from({ length: Math.min(MAX_CONCURRENT_WORKERS, sourceList.length) }, runNext))
    return results
  }

  function cancelAll() {
    runGeneration += 1
    for (const run of [...activeRuns.values()]) {
      const createCancelledResult = run.kind === 'search'
        ? createResult
        : run.kind === 'play-url'
          ? createPlayUrlResult
          : createDownloadUrlResult
      finishRun(run, createCancelledResult(run.source, 'failed', {
        errorCode: SOURCE_RUNTIME_ERROR_CODES.SOURCE_RUNTIME
      }))
    }
  }

  return { run, runMany, runPlayUrl, runDownloadUrl, cancelAll }
}
