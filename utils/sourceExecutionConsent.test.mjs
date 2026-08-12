import test from 'node:test'
import assert from 'node:assert/strict'

const source = {
  id: 'qa-source',
  script: 'module.exports = { async search() { return [] } }'
}

let moduleVersion = 0

async function loadConsentStore(storageValue, options = {}) {
  const storage = { value: storageValue }
  globalThis.uni = {
    getStorageSync() {
      if (options.failRead) {
        throw new Error('storage unavailable')
      }
      return storage.value
    },
    setStorageSync(key, value) {
      if (options.failWrite) {
        throw new Error('storage full')
      }
      storage.value = value
    },
    removeStorageSync() {
      storage.value = undefined
    }
  }
  return {
    module: await import(`./sourceExecutionConsent.js?test=${moduleVersion += 1}`),
    storage
  }
}

test.afterEach(() => {
  delete globalThis.uni
})

test('同一脚本文本被确认后命中许可，替换脚本文本后必须重新确认', async () => {
  const { module, storage } = await loadConsentStore(undefined)

  const approved = await module.approveSourceExecution(source)

  assert.equal(approved.persistenceFailed, false)
  assert.equal(await module.hasSourceExecutionConsent(source), true)
  assert.equal(await module.hasSourceExecutionConsent({ ...source, script: `${source.script}\n// changed` }), false)
  assert.equal(storage.value.length, 1)
  assert.deepEqual(Object.keys(storage.value[0]).sort(), ['approvedAt', 'scriptFingerprint', 'sourceId'])
})

test('水合时移除不存在音源、脚本变更和损坏的许可记录', async () => {
  const { module, storage } = await loadConsentStore([
    { sourceId: 'qa-source', scriptFingerprint: await moduleFingerprint(source.script), approvedAt: 1 },
    { sourceId: 'missing', scriptFingerprint: 'unused', approvedAt: 2 },
    { sourceId: 'qa-source', scriptFingerprint: 'incorrect', approvedAt: 3 },
    null
  ])

  const result = await module.hydrateSourceExecutionConsents([source])

  assert.equal(result.persistenceFailed, false)
  assert.equal(await module.hasSourceExecutionConsent(source), true)
  assert.deepEqual(storage.value, [{ sourceId: 'qa-source', scriptFingerprint: await moduleFingerprint(source.script), approvedAt: 1 }])
})

test('存储写入失败时确认仍在当前会话有效并报告持久化失败', async () => {
  const { module } = await loadConsentStore(undefined, { failWrite: true })

  const result = await module.approveSourceExecution(source)

  assert.equal(result.persistenceFailed, true)
  assert.equal(await module.hasSourceExecutionConsent(source), true)
})

test('按音源删除许可不会影响其他音源', async () => {
  const otherSource = { id: 'other-source', script: 'module.exports = { async search() { return [] } }' }
  const { module } = await loadConsentStore(undefined)

  await module.approveSourceExecution(source)
  await module.approveSourceExecution(otherSource)
  module.removeSourceExecutionConsent(source.id)

  assert.equal(await module.hasSourceExecutionConsent(source), false)
  assert.equal(await module.hasSourceExecutionConsent(otherSource), true)
})

async function moduleFingerprint(script) {
  const bytes = new TextEncoder().encode(script)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}
