const pendingRequests = new Map()

function postError(requestId, errorCode) {
  self.postMessage({ type: 'error', requestId, errorCode })
}

function createSourceApi(requestId) {
  let requestCounter = 0
  return {
    request(options) {
      const requestToken = `${requestId}:request:${requestCounter += 1}`
      return new Promise((resolve, reject) => {
        pendingRequests.set(requestToken, { resolve, reject })
        self.postMessage({ type: 'request', requestId, requestToken, options })
      })
    }
  }
}

async function runSearch(message) {
  const { requestId, script, keyword, page, limit } = message
  try {
    const module = { exports: {} }
    const sourceApi = createSourceApi(requestId)
    const executeSource = new Function('module', 'sourceApi', `'use strict';\n${script}`)
    executeSource(module, sourceApi)
    const search = module.exports?.search
    if (typeof search !== 'function') {
      postError(requestId, 'SOURCE_RUNTIME')
      return
    }

    const results = await search(keyword, page, limit, sourceApi)
    if (!Array.isArray(results)) {
      postError(requestId, 'INVALID_RESULT')
      return
    }
    self.postMessage({ type: 'result', requestId, results })
  } catch (error) {
    postError(requestId, error?.code || 'SOURCE_RUNTIME')
  }
}

async function runPlayUrl(message) {
  const { requestId, script, track } = message
  try {
    const module = { exports: {} }
    const sourceApi = createSourceApi(requestId)
    const executeSource = new Function('module', 'sourceApi', `'use strict';\n${script}`)
    executeSource(module, sourceApi)
    const getPlayUrl = module.exports?.getPlayUrl
    if (typeof getPlayUrl !== 'function') {
      postError(requestId, 'SOURCE_RUNTIME')
      return
    }

    const playUrl = await getPlayUrl(track, sourceApi)
    self.postMessage({ type: 'result-play-url', requestId, playUrl })
  } catch (error) {
    postError(requestId, error?.code || 'SOURCE_RUNTIME')
  }
}

async function runDownloadUrl(message) {
  const { requestId, script, track } = message
  try {
    const module = { exports: {} }
    const sourceApi = createSourceApi(requestId)
    const executeSource = new Function('module', 'sourceApi', `'use strict';\n${script}`)
    executeSource(module, sourceApi)
    const download = module.exports?.download
    if (typeof download !== 'function') {
      postError(requestId, 'DOWNLOAD_UNAVAILABLE')
      return
    }

    const downloadUrl = await download(track, sourceApi)
    self.postMessage({ type: 'result-download-url', requestId, downloadUrl })
  } catch (error) {
    postError(requestId, error?.code || 'SOURCE_RUNTIME')
  }
}

self.onmessage = (event) => {
  const message = event?.data || {}
  if (message.type === 'run-search') {
    runSearch(message)
    return
  }
  if (message.type === 'run-play-url') {
    runPlayUrl(message)
    return
  }
  if (message.type === 'run-download-url') {
    runDownloadUrl(message)
    return
  }
  if (message.type === 'request-response') {
    const pending = pendingRequests.get(message.requestToken)
    if (!pending) {
      return
    }
    pendingRequests.delete(message.requestToken)
    if (message.ok) {
      pending.resolve(message.response)
    } else {
      const error = new Error('Source request failed.')
      error.code = message.errorCode || 'CORS_OR_NETWORK'
      pending.reject(error)
    }
  }
}
