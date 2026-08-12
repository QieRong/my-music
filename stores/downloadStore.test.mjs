import test from 'node:test'
import assert from 'node:assert/strict'
import { register } from 'node:module'

register(new URL('../utils/testVueLoader.mjs', import.meta.url), import.meta.url)

let moduleVersion = 0

function source(overrides = {}) {
  return {
    id: 'qa-source',
    name: 'QA Source',
    enabled: true,
    capabilities: ['search', 'download'],
    script: 'module.exports = {}',
    ...overrides
  }
}

function result(overrides = {}) {
  return {
    id: 'online:qa-source:track-1',
    sourceId: 'qa-source',
    sourceName: 'QA Source',
    trackId: 'track-1',
    title: 'Track 1',
    artist: 'Artist',
    album: 'Album',
    duration: 120,
    ...overrides
  }
}

function createCache() {
  const entries = []
  const blobs = new Map()
  return {
    entries,
    blobs,
    async getQuota() {
      return { limitBytes: 1024, usedBytes: 0, availableBytes: 1024, estimateAvailable: true }
    },
    async listEntries() {
      return [...entries]
    },
    async putComplete(entry, blob) {
      const saved = { ...entry, byteSize: blob.size, createdAt: 1700000000000 }
      entries.push(saved)
      blobs.set(entry.cacheId, blob)
      return saved
    },
    async remove(cacheId) {
      const index = entries.findIndex((entry) => entry.cacheId === cacheId)
      if (index < 0) return false
      entries.splice(index, 1)
      blobs.delete(cacheId)
      return true
    },
    async clear() {
      const count = entries.length
      entries.length = 0
      blobs.clear()
      return count
    },
    async removeBySource(sourceId) {
      const matching = entries.filter((entry) => entry.sourceId === sourceId)
      for (const entry of matching) {
        await this.remove(entry.cacheId)
      }
      return matching.length
    }
  }
}

function createResponse(chunks, options = {}) {
  let index = 0
  return {
    ok: options.ok !== false,
    headers: { get: (name) => name === 'content-length' ? String(options.totalBytes || 0) : 'audio/mpeg' },
    body: {
      getReader() {
        return {
          async read() {
            if (index >= chunks.length) return { done: true }
            return { done: false, value: chunks[index++] }
          },
          async cancel() {}
        }
      }
    }
  }
}

async function loadStore(options = {}) {
  const store = await import(`./downloadStore.js?test=${moduleVersion += 1}`)
  store.configureDownloadRuntime({
    runtime: options.runtime || {
      cancelAll() {},
      async runDownloadUrl() { return { status: 'success', url: 'https://media.example.test/track.mp3' } }
    },
    cache: options.cache || createCache(),
    fetchImpl: options.fetchImpl || (async () => createResponse([new Uint8Array([1, 2, 3])], { totalBytes: 3 })),
    hasConsent: options.hasConsent || (async () => true),
    fingerprint: options.fingerprint || (async () => 'fingerprint-1'),
    now: () => 1700000000000
  })
  return store
}

test('未启用、未声明 download 或尚未取得音源执行许可时，不调用 Worker 或网络', async () => {
  let workerCalls = 0
  let fetchCalls = 0
  const store = await loadStore({
    runtime: { cancelAll() {}, async runDownloadUrl() { workerCalls += 1; return { status: 'success', url: 'https://media.example.test/a.mp3' } } },
    fetchImpl: async () => { fetchCalls += 1; return createResponse([]) },
    hasConsent: async () => false
  })

  assert.equal((await store.prepareDownload(result(), [source()])).status, 'failed')
  assert.equal((await store.prepareDownload(result(), [source({ capabilities: ['search'] })])).errorCode, 'DOWNLOAD_UNAVAILABLE')
  assert.equal(workerCalls, 0)
  assert.equal(fetchCalls, 0)
})

test('版权确认前零下载；确认后显示真实字节进度并只保存脱敏缓存条目', async () => {
  const cache = createCache()
  let workerCalls = 0
  let fetchOptions = null
  const store = await loadStore({
    cache,
    runtime: { cancelAll() {}, async runDownloadUrl() { workerCalls += 1; return { status: 'success', url: 'https://media.example.test/track.mp3' } } },
    fetchImpl: async (url, options) => {
      fetchOptions = options
      return createResponse([new Uint8Array([1, 2]), new Uint8Array([3])], { totalBytes: 3 })
    }
  })

  assert.equal((await store.prepareDownload(result(), [source()])).status, 'requires_copyright_confirmation')
  assert.equal(workerCalls, 0)
  const completed = await store.approveAndDownload()

  assert.equal(completed.status, 'completed')
  assert.equal(workerCalls, 1)
  assert.equal(fetchOptions.credentials, 'omit')
  assert.equal(store.downloadState.tasks[0].receivedBytes, 3)
  assert.equal(store.downloadState.tasks[0].totalBytes, 3)
  assert.equal(JSON.stringify(store.downloadState).includes('media.example.test'), false)
  assert.deepEqual(cache.entries[0], {
    cacheId: cache.entries[0].cacheId,
    sourceId: 'qa-source',
    sourceFingerprint: 'fingerprint-1',
    trackId: 'track-1',
    title: 'Track 1',
    artist: 'Artist',
    album: 'Album',
    duration: 120,
    byteSize: 3,
    createdAt: 1700000000000
  })
})

test('取消或网络失败不落盘；禁用或删除音源可按来源清理缓存', async () => {
  const cache = createCache()
  let releaseRead
  let fetchCalls = 0
  const store = await loadStore({
    cache,
    fetchImpl: async () => {
      fetchCalls += 1
      if (fetchCalls > 1) {
        return createResponse([new Uint8Array([1, 2, 3])], { totalBytes: 3 })
      }
      return {
        ok: true,
        headers: { get: () => null },
        body: { getReader: () => ({ read: () => new Promise((resolve) => { releaseRead = resolve }), cancel: async () => {} }) }
      }
    }
  })

  await store.prepareDownload(result(), [source()])
  const pending = store.approveAndDownload()
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.equal(store.cancelDownload(result().id), true)
  releaseRead({ done: true })
  assert.equal((await pending).status, 'cancelled')
  assert.equal(cache.entries.length, 0)

  await store.prepareDownload(result(), [source()])
  await store.approveAndDownload()
  assert.equal(cache.entries.length, 1)
  assert.equal(await store.removeCachedDownloadsForSource('qa-source'), 1)
  assert.equal(cache.entries.length, 0)
})

test('同一结果进行中或已缓存时拒绝重复确认，不重复请求或写入缓存', async () => {
  const cache = createCache()
  let releaseDownload
  let runtimeCalls = 0
  const store = await loadStore({
    cache,
    runtime: {
      cancelAll() {},
      async runDownloadUrl() {
        runtimeCalls += 1
        await new Promise((resolve) => { releaseDownload = resolve })
        return { status: 'success', url: 'https://media.example.test/track.mp3' }
      }
    }
  })

  assert.equal((await store.prepareDownload(result(), [source()])).status, 'requires_copyright_confirmation')
  const firstDownload = store.approveAndDownload()
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.equal((await store.prepareDownload(result(), [source()])).errorCode, 'DOWNLOAD_IN_PROGRESS')
  releaseDownload()
  assert.equal((await firstDownload).status, 'completed')
  assert.equal((await store.prepareDownload(result(), [source()])).errorCode, 'DOWNLOAD_ALREADY_CACHED')
  assert.equal(runtimeCalls, 1)
  assert.equal(cache.entries.length, 1)
})
