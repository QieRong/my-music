import test from 'node:test'
import assert from 'node:assert/strict'

import { createSourceSearchRuntime } from './sourceRuntime.js'

function makeSource(id, script = 'success', capabilities = ['search']) {
  return {
    id,
    name: `Source ${id}`,
    script,
    capabilities,
    enabled: true
  }
}

class FakeWorker {
  static instances = []
  static activeRuns = 0
  static maximumActiveRuns = 0

  constructor() {
    this.terminated = false
    FakeWorker.instances.push(this)
  }

  postMessage(message) {
    if (message.type === 'run-search') {
      if (message.script === 'timeout') {
        return
      }
      if (message.script === 'request') {
        queueMicrotask(() => this.onmessage?.({
          data: {
            type: 'request',
            requestId: message.requestId,
            requestToken: 'request-1',
            options: { url: 'https://example.test/search', method: 'POST', body: { keyword: message.keyword } }
          }
        }))
        return
      }
      if (message.script === 'failure') {
        queueMicrotask(() => this.onmessage?.({
          data: { type: 'error', requestId: message.requestId, errorCode: 'SOURCE_RUNTIME' }
        }))
        return
      }

      FakeWorker.activeRuns += 1
      FakeWorker.maximumActiveRuns = Math.max(FakeWorker.maximumActiveRuns, FakeWorker.activeRuns)
      setTimeout(() => {
        FakeWorker.activeRuns -= 1
        this.onmessage?.({
          data: {
            type: 'result',
            requestId: message.requestId,
            results: [{ trackId: `track-${message.keyword}`, title: `Title ${message.keyword}`, duration: 120 }]
          }
        })
      }, 4)
      return
    }

    if (message.type === 'run-play-url') {
      if (message.script === 'play-invalid') {
        queueMicrotask(() => this.onmessage?.({
          data: { type: 'result-play-url', requestId: message.requestId, playUrl: 'http://example.test/track.mp3' }
        }))
        return
      }
      if (message.script === 'play-timeout') {
        return
      }
      queueMicrotask(() => this.onmessage?.({
        data: { type: 'result-play-url', requestId: message.requestId, playUrl: 'https://media.example.test/track.mp3' }
      }))
      return
    }

    if (message.type === 'run-download-url') {
      if (message.script === 'download-invalid') {
        queueMicrotask(() => this.onmessage?.({
          data: { type: 'result-download-url', requestId: message.requestId, downloadUrl: 'http://example.test/track.mp3' }
        }))
        return
      }
      if (message.script === 'download-unavailable') {
        queueMicrotask(() => this.onmessage?.({
          data: { type: 'error', requestId: message.requestId, errorCode: 'DOWNLOAD_UNAVAILABLE' }
        }))
        return
      }
      if (message.script === 'download-timeout') {
        return
      }
      queueMicrotask(() => this.onmessage?.({
        data: { type: 'result-download-url', requestId: message.requestId, downloadUrl: 'https://media.example.test/track.mp3' }
      }))
      return
    }

    if (message.type === 'request-response') {
      queueMicrotask(() => this.onmessage?.({
        data: {
          type: 'result',
          requestId: message.requestId,
          results: [{ trackId: 'request-track', title: message.ok ? 'From request' : 'Request failed' }]
        }
      }))
    }
  }

  terminate() {
    this.terminated = true
  }
}

test.beforeEach(() => {
  FakeWorker.instances = []
  FakeWorker.activeRuns = 0
  FakeWorker.maximumActiveRuns = 0
})

test('Worker 搜索把结果映射为白名单字段，并以 omit 发起受控请求', async () => {
  const requests = []
  const runtime = createSourceSearchRuntime({
    WorkerClass: FakeWorker,
    fetchImpl: async (url, options) => {
      requests.push({ url, options })
      return { text: async () => '{"ok":true}' }
    }
  })

  const result = await runtime.run(makeSource('qa', 'request'), { keyword: 'alpha', page: 1, limit: 20 })

  assert.equal(result.status, 'success')
  assert.deepEqual(result.results, [{
    id: 'online:qa:request-track',
    sourceId: 'qa',
    sourceName: 'Source qa',
    trackId: 'request-track',
    title: 'From request',
    artist: '',
    album: '',
    duration: null
  }])
  assert.deepEqual(requests, [{
    url: 'https://example.test/search',
    options: {
      method: 'POST',
      headers: {},
      body: '{"keyword":"alpha"}',
      credentials: 'omit'
    }
  }])
})

test('同时搜索四个音源时最多运行三个 Worker，结果仍按音源顺序返回', async () => {
  const runtime = createSourceSearchRuntime({ WorkerClass: FakeWorker, fetchImpl: async () => ({ text: async () => '' }) })
  const sources = ['a', 'b', 'c', 'd'].map((id) => makeSource(id))

  const results = await runtime.runMany(sources, { keyword: 'alpha', page: 1, limit: 20 })

  assert.equal(FakeWorker.maximumActiveRuns, 3)
  assert.deepEqual(results.map((result) => result.sourceId), ['a', 'b', 'c', 'd'])
  assert.ok(results.every((result) => result.status === 'success'))
})

test('超时或取消时终止 Worker，且不支持 Worker 不退回主线程执行脚本文本', async () => {
  const timeoutRuntime = createSourceSearchRuntime({
    WorkerClass: FakeWorker,
    fetchImpl: async () => ({ text: async () => '' }),
    timeoutMs: 1
  })
  const timeoutResult = await timeoutRuntime.run(makeSource('timeout', 'timeout'), { keyword: 'alpha', page: 1, limit: 20 })

  assert.equal(timeoutResult.status, 'timeout')
  assert.equal(FakeWorker.instances[0].terminated, true)

  const cancelRuntime = createSourceSearchRuntime({ WorkerClass: FakeWorker, fetchImpl: async () => ({ text: async () => '' }) })
  const pending = cancelRuntime.run(makeSource('cancel'), { keyword: 'alpha', page: 1, limit: 20 })
  cancelRuntime.cancelAll()
  const cancelled = await pending
  assert.equal(cancelled.status, 'failed')
  assert.equal(FakeWorker.instances.at(-1).terminated, true)

  const unsupported = createSourceSearchRuntime({ WorkerClass: null })
  const unsupportedResult = await unsupported.run(makeSource('unsupported'), { keyword: 'alpha', page: 1, limit: 20 })
  assert.equal(unsupportedResult.errorCode, 'UNSUPPORTED_RUNTIME')
})

test('播放地址在 Worker 返回后校验，运行时只将其交给调用方', async () => {
  const runtime = createSourceSearchRuntime({ WorkerClass: FakeWorker, fetchImpl: async () => ({ text: async () => '' }) })
  const result = await runtime.runPlayUrl(makeSource('playable', 'play-success', ['play']), {
    trackId: 'track-1',
    title: 'Track 1'
  })

  assert.deepEqual(result, {
    sourceId: 'playable',
    sourceName: 'Source playable',
    status: 'success',
    url: 'https://media.example.test/track.mp3',
    errorCode: ''
  })

  const invalid = await runtime.runPlayUrl(makeSource('invalid', 'play-invalid', ['play']), { trackId: 'track-1' })
  assert.equal(invalid.status, 'failed')
  assert.equal(invalid.errorCode, 'PLAY_URL_INVALID')
})

test('播放地址获取超时会终止 Worker', async () => {
  const runtime = createSourceSearchRuntime({
    WorkerClass: FakeWorker,
    fetchImpl: async () => ({ text: async () => '' }),
    timeoutMs: 1
  })
  const result = await runtime.runPlayUrl(makeSource('timeout-play', 'play-timeout', ['play']), { trackId: 'track-1' })

  assert.equal(result.status, 'timeout')
  assert.equal(result.errorCode, 'SOURCE_TIMEOUT')
  assert.equal(FakeWorker.instances[0].terminated, true)
})

test('下载地址在 Worker 返回后校验，缺失能力、无效地址和超时均不返回地址', async () => {
  const runtime = createSourceSearchRuntime({ WorkerClass: FakeWorker, fetchImpl: async () => ({ text: async () => '' }), timeoutMs: 1 })
  const track = { trackId: 'track-1', title: 'Track 1' }

  const success = await runtime.runDownloadUrl(makeSource('downloadable', 'download-success', ['download']), track)
  assert.deepEqual(success, {
    sourceId: 'downloadable',
    sourceName: 'Source downloadable',
    status: 'success',
    url: 'https://media.example.test/track.mp3',
    errorCode: ''
  })

  const unavailable = await runtime.runDownloadUrl(makeSource('unavailable', 'download-unavailable', ['download']), track)
  assert.equal(unavailable.status, 'failed')
  assert.equal(unavailable.errorCode, 'DOWNLOAD_UNAVAILABLE')

  const invalid = await runtime.runDownloadUrl(makeSource('invalid-download', 'download-invalid', ['download']), track)
  assert.equal(invalid.status, 'failed')
  assert.equal(invalid.errorCode, 'DOWNLOAD_URL_INVALID')

  const timeout = await runtime.runDownloadUrl(makeSource('timeout-download', 'download-timeout', ['download']), track)
  assert.equal(timeout.status, 'timeout')
  assert.equal(timeout.errorCode, 'SOURCE_TIMEOUT')
})
