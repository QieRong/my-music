import test from 'node:test'
import assert from 'node:assert/strict'
import { register } from 'node:module'

register(new URL('../utils/testVueLoader.mjs', import.meta.url), import.meta.url)

let moduleVersion = 0

test('在线曲目只保留展示元数据，不把播放地址放入播放器状态', async () => {
  const store = await import(`./playerStore.js?test=${moduleVersion += 1}`)
  store.setOnlinePlaybackTrack({
    id: 'online:source:track',
    sourceId: 'source',
    sourceName: 'QA Source',
    trackId: 'track',
    title: 'Track',
    artist: 'Artist',
    album: 'Album',
    duration: 120,
    url: 'https://must-not-persist.example.test/track.mp3'
  })

  assert.equal(store.playerState.playbackKind, 'online')
  assert.equal(store.getCurrentTrack().sourceName, 'QA Source')
  assert.equal(JSON.stringify(store.playerState).includes('must-not-persist.example.test'), false)
})

test('选择本地曲目时回到原有本地模拟播放状态', async () => {
  const store = await import(`./playerStore.js?test=${moduleVersion += 1}`)
  store.setPlaylist([{ id: 'local-1', title: 'Local Track' }])
  store.playTrack('local-1')

  assert.equal(store.playerState.playbackKind, 'local')
  assert.equal(store.playerState.onlineTrack, null)
  assert.equal(store.playerState.isPlaying, true)
})
