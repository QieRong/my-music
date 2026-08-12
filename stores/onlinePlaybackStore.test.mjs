import test from 'node:test'
import assert from 'node:assert/strict'
import { register } from 'node:module'

register(new URL('../utils/testVueLoader.mjs', import.meta.url), import.meta.url)

let moduleVersion = 0

function source() {
  return {
    id: 'qa-source',
    name: 'QA Source',
    enabled: true,
    capabilities: ['search', 'play'],
    script: 'module.exports = {}'
  }
}

function result() {
  return {
    id: 'online:qa-source:track-1',
    sourceId: 'qa-source',
    sourceName: 'QA Source',
    trackId: 'track-1',
    title: 'Track 1',
    artist: 'Artist',
    album: 'Album',
    duration: 120
  }
}

test('仅已启用、声明 play 且已有同意记录的音源可以发起在线播放', async () => {
  const store = await import(`./onlinePlaybackStore.js?test=${moduleVersion += 1}`)
  const calls = []
  let listener = null
  store.configureOnlinePlaybackRuntime({
    runtime: {
      runPlayUrl: async () => ({ status: 'success', url: 'https://media.example.test/track.mp3' }),
      cancelAll: () => {}
    },
    player: {
      subscribe(callback) {
        listener = callback
        return () => {}
      },
      stop() {},
      async play(url) {
        calls.push(url)
        listener?.({ type: 'playing' })
        return true
      },
      pause() { return true },
      resume: async () => true
    },
    hasConsent: async () => true
  })

  const response = await store.playOnlineResult(result(), [source()])

  assert.equal(response.status, 'playing')
  assert.deepEqual(calls, ['https://media.example.test/track.mp3'])
  assert.equal(store.onlinePlaybackState.activeTrackId, result().id)
  assert.equal(store.onlinePlaybackState.status, 'playing')
  assert.equal(JSON.stringify(store.onlinePlaybackState).includes('media.example.test'), false)
})

test('缺少播放能力、同意记录或播放地址时不调用原生音频', async () => {
  const store = await import(`./onlinePlaybackStore.js?test=${moduleVersion += 1}`)
  let playCalls = 0
  store.configureOnlinePlaybackRuntime({
    runtime: {
      runPlayUrl: async () => ({ status: 'failed', errorCode: 'PLAY_URL_INVALID' }),
      cancelAll: () => {}
    },
    player: {
      subscribe() { return () => {} },
      stop() {},
      async play() { playCalls += 1; return true },
      pause() { return true },
      resume: async () => true
    },
    hasConsent: async () => false
  })

  const noConsent = await store.playOnlineResult(result(), [source()])
  const noCapability = await store.playOnlineResult(result(), [{ ...source(), capabilities: ['search'] }])

  assert.equal(noConsent.errorCode, 'CONSENT_REQUIRED')
  assert.equal(noCapability.errorCode, 'PLAY_UNAVAILABLE')
  assert.equal(playCalls, 0)
})

test('停止在线播放会取消运行、释放会话并不把地址留在状态中', async () => {
  const store = await import(`./onlinePlaybackStore.js?test=${moduleVersion += 1}`)
  let stopped = 0
  let cancelled = 0
  store.configureOnlinePlaybackRuntime({
    runtime: { runPlayUrl: async () => ({ status: 'failed' }), cancelAll: () => { cancelled += 1 } },
    player: { subscribe() { return () => {} }, stop() { stopped += 1 }, pause() { return true }, resume: async () => true },
    hasConsent: async () => true
  })
  store.onlinePlaybackState.activeTrackId = result().id
  store.onlinePlaybackState.status = 'playing'

  store.stopOnlinePlayback()

  assert.equal(cancelled, 1)
  assert.equal(stopped, 1)
  assert.equal(store.onlinePlaybackState.status, 'stopped')
  assert.equal(store.onlinePlaybackState.activeTrackId, result().id)
  assert.equal(JSON.stringify(store.onlinePlaybackState).includes('http'), false)
})
