import test from 'node:test'
import assert from 'node:assert/strict'

import { createOfflineCache } from './offlineCache.js'

function createMemoryDatabase(options = {}) {
  const entries = new Map()
  const blobs = new Map()
  return {
    entries,
    blobs,
    async listEntries() {
      return [...entries.values()]
    },
    async getBlob(cacheId) {
      return blobs.get(cacheId) || null
    },
    async putComplete(entry, blob) {
      if (options.failPut) {
        throw new Error('write failed')
      }
      blobs.set(entry.cacheId, blob)
      entries.set(entry.cacheId, entry)
    },
    async remove(cacheId) {
      blobs.delete(cacheId)
      entries.delete(cacheId)
    },
    async clear() {
      blobs.clear()
      entries.clear()
    }
  }
}

function createEntry(overrides = {}) {
  return {
    cacheId: 'cache-1',
    sourceId: 'qa-source',
    sourceFingerprint: 'fingerprint-1',
    trackId: 'track-1',
    title: 'QA Track',
    artist: 'QA Artist',
    album: 'QA Album',
    duration: 120,
    ...overrides
  }
}

test('缓存配额取 256 MiB 与可用空间 20% 的较小值，并拒绝超限完整 Blob', async () => {
  const database = createMemoryDatabase()
  const cache = createOfflineCache({
    database,
    storageManager: { estimate: async () => ({ usage: 600, quota: 1600 }) },
    now: () => 1700000000000
  })

  assert.deepEqual(await cache.getQuota(), {
    limitBytes: 200,
    usedBytes: 0,
    availableBytes: 200,
    estimateAvailable: true
  })

  await assert.rejects(
    () => cache.putComplete(createEntry(), new Blob(['a'.repeat(201)])),
    (error) => error?.code === 'CACHE_QUOTA_EXCEEDED'
  )
  assert.equal(database.entries.size, 0)
  assert.equal(database.blobs.size, 0)
})

test('仅接受完整 Blob 与脱敏白名单元数据；重复 cacheId 不会覆盖已有缓存', async () => {
  const database = createMemoryDatabase()
  const cache = createOfflineCache({ database, now: () => 1700000000000 })

  await assert.rejects(
    () => cache.putComplete(createEntry(), null),
    (error) => error?.code === 'CACHE_BLOB_INVALID'
  )

  const saved = await cache.putComplete(createEntry({ url: 'https://must-not-persist.test/a.mp3' }), new Blob(['audio']))
  assert.deepEqual(saved, {
    cacheId: 'cache-1',
    sourceId: 'qa-source',
    sourceFingerprint: 'fingerprint-1',
    trackId: 'track-1',
    title: 'QA Track',
    artist: 'QA Artist',
    album: 'QA Album',
    duration: 120,
    byteSize: 5,
    createdAt: 1700000000000
  })
  assert.equal('url' in saved, false)

  await assert.rejects(
    () => cache.putComplete(createEntry(), new Blob(['other'])),
    (error) => error?.code === 'CACHE_DUPLICATE'
  )
  assert.equal((await cache.getBlob('cache-1')).size, 5)
})

test('按音源删除、清空缓存与写入失败均不留下孤立 Blob 或元数据', async () => {
  const database = createMemoryDatabase()
  const cache = createOfflineCache({ database, now: () => 1700000000000 })
  await cache.putComplete(createEntry(), new Blob(['first']))
  await cache.putComplete(createEntry({ cacheId: 'cache-2', sourceId: 'other-source' }), new Blob(['second']))

  assert.equal(await cache.removeBySource('qa-source'), 1)
  assert.equal(await cache.getBlob('cache-1'), null)
  assert.deepEqual((await cache.listEntries()).map((entry) => entry.cacheId), ['cache-2'])

  assert.equal(await cache.clear(), 1)
  assert.deepEqual(await cache.listEntries(), [])
  assert.equal(database.blobs.size, 0)

  const failingDatabase = createMemoryDatabase({ failPut: true })
  const failingCache = createOfflineCache({ database: failingDatabase })
  await assert.rejects(() => failingCache.putComplete(createEntry(), new Blob(['audio'])))
  assert.equal(failingDatabase.entries.size, 0)
  assert.equal(failingDatabase.blobs.size, 0)
})
