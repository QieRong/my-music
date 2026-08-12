import test from 'node:test'
import assert from 'node:assert/strict'
import { register } from 'node:module'

register(new URL('../utils/testVueLoader.mjs', import.meta.url), import.meta.url)

let moduleVersion = 0

async function loadStore(dependencies) {
  const store = await import(`./onlineSearchStore.js?test=${moduleVersion += 1}`)
  store.configureOnlineSearchRuntime(dependencies)
  return store
}

function makeSource(id, options = {}) {
  return {
    id,
    name: `Source ${id}`,
    version: '1.0.0',
    enabled: options.enabled ?? true,
    capabilities: options.capabilities ?? ['search'],
    script: `module.exports = { async search() { return [] } }`
  }
}

test('未获得运行确认时只返回待确认音源，绝不启动 Worker', async () => {
  const runtime = { calls: 0, async runMany() { this.calls += 1; return [] }, cancelAll() {} }
  const store = await loadStore({
    runtime,
    hasConsent: async () => false,
    approveConsent: async () => ({ persistenceFailed: false })
  })

  const prepared = await store.prepareOnlineSearch('alpha', [makeSource('a'), makeSource('off', { enabled: false })])

  assert.equal(prepared.status, 'requires_consent')
  assert.equal(runtime.calls, 0)
  assert.deepEqual(store.onlineSearchState.pendingConsentSources.map((source) => source.id), ['a'])
})

test('同意后只执行启用且声明 search 的音源，并保留部分失败分组', async () => {
  const runtime = {
    calls: [],
    async runMany(sources, query) {
      this.calls.push({ sources, query })
      return [
        { sourceId: 'a', sourceName: 'Source a', status: 'success', results: [{ id: 'online:a:1', title: 'Alpha' }], invalidCount: 0, errorCode: '' },
        { sourceId: 'b', sourceName: 'Source b', status: 'failed', results: [], invalidCount: 0, errorCode: 'SOURCE_RUNTIME' }
      ]
    },
    cancelAll() {}
  }
  const approved = []
  const store = await loadStore({
    runtime,
    hasConsent: async () => false,
    approveConsent: async (source) => { approved.push(source.id); return { persistenceFailed: false } }
  })
  const sources = [makeSource('a'), makeSource('b'), makeSource('no-search', { capabilities: ['play'] })]

  await store.prepareOnlineSearch('alpha', sources)
  const result = await store.approveAndSearch()

  assert.equal(result.status, 'partial')
  assert.deepEqual(approved, ['a', 'b'])
  assert.deepEqual(runtime.calls[0].sources.map((source) => source.id), ['a', 'b'])
  assert.equal(store.onlineSearchState.status, 'partial')
  assert.equal(store.onlineSearchState.sourceGroups[0].results[0].title, 'Alpha')
})

test('取消确认不执行，空关键词和无合格音源不显示在线结果', async () => {
  const runtime = { calls: 0, async runMany() { this.calls += 1; return [] }, cancelAll() {} }
  const store = await loadStore({ runtime, hasConsent: async () => false, approveConsent: async () => ({ persistenceFailed: false }) })

  assert.deepEqual(await store.prepareOnlineSearch('  ', [makeSource('a')]), { status: 'empty_keyword' })
  assert.deepEqual(await store.prepareOnlineSearch('alpha', [makeSource('a', { enabled: false })]), { status: 'no_sources' })
  await store.prepareOnlineSearch('alpha', [makeSource('a')])
  store.cancelOnlineSearch()

  assert.equal(runtime.calls, 0)
  assert.equal(store.onlineSearchState.pendingConsentSources.length, 0)
  assert.equal(store.onlineSearchState.sourceGroups.length, 0)
})

test('新搜索会取消旧任务，旧结果不回填页面状态', async () => {
  let resolveFirst
  const runtime = {
    cancelCount: 0,
    runMany(sources, query) {
      if (query.keyword === 'first') {
        return new Promise((resolve) => { resolveFirst = resolve })
      }
      return Promise.resolve([{ sourceId: 'a', sourceName: 'Source a', status: 'empty', results: [], invalidCount: 0, errorCode: '' }])
    },
    cancelAll() { this.cancelCount += 1 }
  }
  const store = await loadStore({ runtime, hasConsent: async () => true, approveConsent: async () => ({ persistenceFailed: false }) })
  const sources = [makeSource('a')]

  const first = store.prepareOnlineSearch('first', sources)
  await store.prepareOnlineSearch('second', sources)
  resolveFirst([{ sourceId: 'a', sourceName: 'Source a', status: 'success', results: [{ id: 'online:a:old', title: 'Old' }], invalidCount: 0, errorCode: '' }])
  await first

  assert.ok(runtime.cancelCount >= 1)
  assert.equal(store.onlineSearchState.keyword, 'second')
  assert.equal(store.onlineSearchState.sourceGroups.some((group) => group.results.some((result) => result.title === 'Old')), false)
})
