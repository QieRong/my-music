import test from 'node:test'
import assert from 'node:assert/strict'
import { register } from 'node:module'

register(new URL('../utils/testVueLoader.mjs', import.meta.url), import.meta.url)

const validSourceScript = `/**
 * @id qa-source
 * @name QA Source
 * @version 1.0.0
 * @author QA Team
 * @description Browser source fixture
 * @capabilities search, play
 */
module.exports = { async search() {}, async getPlayUrl() {} }`

let moduleVersion = 0

async function loadSourceStore(storageValue, options = {}) {
  const storage = { value: storageValue }
  globalThis.uni = {
    getStorageSync() {
      return storage.value
    },
    setStorageSync(key, value) {
      if (options.failPersist) {
        throw new Error('storage full')
      }
      storage.value = value
    },
    removeStorageSync() {
      storage.value = undefined
    }
  }
  const store = await import(`./sourceStore.js?test=${moduleVersion += 1}`)
  return { store, storage }
}

test.afterEach(() => {
  delete globalThis.uni
})

test('savePreparedSource adds a disabled source and persists it under its own key', async () => {
  const { store, storage } = await loadSourceStore(undefined)
  const prepared = store.prepareSourceImport(validSourceScript, 1710000000000)

  const result = store.savePreparedSource(prepared)

  assert.equal(result.status, 'added')
  assert.equal(result.persistenceFailed, false)
  assert.equal(store.sourceCount.value, 1)
  assert.equal(store.enabledSourceCount.value, 0)
  assert.equal(store.sourceState.items[0].enabled, false)
  assert.equal(storage.value[0].id, 'qa-source')
})

test('savePreparedSource requires confirmation before replacing an existing id', async () => {
  const { store } = await loadSourceStore(undefined)
  const first = store.prepareSourceImport(validSourceScript, 1710000000000)
  const updated = store.prepareSourceImport(validSourceScript.replace('@version 1.0.0', '@version 1.0.1'), 1710000001000)

  store.savePreparedSource(first)
  assert.equal(store.savePreparedSource(updated).status, 'requires_replace')
  assert.equal(store.sourceState.items[0].version, '1.0.0')
  assert.equal(store.savePreparedSource(updated, { replace: true }).status, 'updated')
  assert.equal(store.sourceState.items[0].version, '1.0.1')
})

test('source store hydrates valid records and can toggle then remove them', async () => {
  const { store: seedStore } = await loadSourceStore(undefined)
  const source = seedStore.prepareSourceImport(validSourceScript, 1710000000000)
  source.enabled = true
  const { store } = await loadSourceStore([source])

  store.hydrateSources()
  assert.equal(store.sourceCount.value, 1)
  assert.equal(store.enabledSourceCount.value, 1)
  assert.equal(store.setSourceEnabled('qa-source', false).enabled, false)
  assert.deepEqual(store.removeSource('qa-source'), {
    removed: true,
    persistenceFailed: false,
    consentPersistenceFailed: false
  })
  assert.equal(store.sourceCount.value, 0)
})

test('source store keeps current-session changes when persistence fails', async () => {
  const { store } = await loadSourceStore(undefined, { failPersist: true })
  const result = store.savePreparedSource(store.prepareSourceImport(validSourceScript, 1710000000000))

  assert.equal(result.status, 'added')
  assert.equal(result.persistenceFailed, true)
  assert.equal(store.sourceCount.value, 1)
})

test('禁用或删除音源会请求清理该音源的私有离线缓存', async () => {
  const downloadStore = await import('./downloadStore.js')
  const cleanedSourceIds = []
  downloadStore.configureDownloadRuntime({
    runtime: { cancelAll() {}, async runDownloadUrl() { return { status: 'failed' } } },
    cache: {
      async listEntries() { return [] },
      async getQuota() { return { limitBytes: 0, usedBytes: 0, availableBytes: 0, estimateAvailable: true } },
      async removeBySource(sourceId) { cleanedSourceIds.push(sourceId); return 0 }
    },
    hasConsent: async () => false
  })
  const { store: seedStore } = await loadSourceStore(undefined)
  const source = seedStore.prepareSourceImport(validSourceScript, 1710000000000)
  source.enabled = true
  const { store } = await loadSourceStore([source])

  store.hydrateSources()
  store.setSourceEnabled('qa-source', false)
  await new Promise((resolve) => setTimeout(resolve, 0))
  store.setSourceEnabled('qa-source', true)
  store.removeSource('qa-source')
  await new Promise((resolve) => setTimeout(resolve, 0))

  assert.deepEqual(cleanedSourceIds, ['qa-source', 'qa-source'])
})
