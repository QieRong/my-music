import test from 'node:test'
import assert from 'node:assert/strict'

import { createH5AudioPlayer } from './h5AudioPlayer.js'

class FakeAudio {
  constructor() {
    this.listeners = new Map()
    this.preload = ''
    this.controls = true
    this.src = ''
    this.currentTime = 0
    this.duration = 120
    this.paused = true
    this.loadCalls = 0
    this.pauseCalls = 0
  }

  addEventListener(type, listener) {
    this.listeners.set(type, listener)
  }

  emit(type) {
    this.listeners.get(type)?.()
  }

  play() {
    this.paused = false
    return Promise.resolve()
  }

  pause() {
    this.paused = true
    this.pauseCalls += 1
  }

  removeAttribute(name) {
    if (name === 'src') {
      this.src = ''
    }
  }

  load() {
    this.loadCalls += 1
  }
}

test('H5 音频会话使用无预加载的原生 Audio，并只广播非敏感状态', async () => {
  const audio = new FakeAudio()
  const player = createH5AudioPlayer({ createAudio: () => audio })
  const events = []
  player.subscribe((event) => events.push(event))

  const started = await player.play('https://media.example.test/track.mp3')
  audio.emit('playing')
  audio.currentTime = 12
  audio.emit('timeupdate')

  assert.equal(started, true)
  assert.equal(audio.preload, 'none')
  assert.equal(audio.controls, false)
  assert.deepEqual(events, [
    { type: 'playing' },
    { type: 'progress', currentTime: 12, duration: 120 }
  ])
  assert.equal(JSON.stringify(events).includes('media.example.test'), false)
})

test('停止播放立即清除 Audio src 并释放当前会话地址', async () => {
  const audio = new FakeAudio()
  const player = createH5AudioPlayer({ createAudio: () => audio })
  const events = []
  player.subscribe((event) => events.push(event))

  await player.play('https://media.example.test/track.mp3')
  player.stop()

  assert.equal(audio.src, '')
  assert.equal(audio.pauseCalls, 1)
  assert.equal(audio.loadCalls, 1)
  assert.deepEqual(events, [{ type: 'stopped' }])
})

test('浏览器拒绝播放时映射为可处理错误，且不保留地址', async () => {
  const audio = new FakeAudio()
  audio.play = () => Promise.reject(new Error('Autoplay blocked'))
  const player = createH5AudioPlayer({ createAudio: () => audio })
  const events = []
  player.subscribe((event) => events.push(event))

  const started = await player.play('https://media.example.test/track.mp3')

  assert.equal(started, false)
  assert.deepEqual(events, [{ type: 'error', errorCode: 'PLAY_REJECTED' }])
  assert.equal(audio.src, '')
})
