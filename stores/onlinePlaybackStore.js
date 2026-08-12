import { reactive } from 'vue'
import { hasSourceExecutionConsent } from '../utils/sourceExecutionConsent.js'
import { getH5AudioPlayer } from '../utils/h5AudioPlayer.js'
import { createSourceSearchRuntime } from '../utils/sourceRuntime.js'
import { setCurrentTrackPlaying, setOnlinePlaybackTrack } from './playerStore.js'

export const onlinePlaybackState = reactive({
  activeTrackId: '',
  sourceId: '',
  status: 'idle',
  errorCode: '',
  currentTime: 0,
  duration: 0
})

let runtime = createSourceSearchRuntime()
let audioPlayer = getH5AudioPlayer()
let hasConsent = hasSourceExecutionConsent
let unsubscribeAudio = null
let requestVersion = 0

function bindAudioPlayer() {
  unsubscribeAudio?.()
  unsubscribeAudio = audioPlayer?.subscribe?.((event) => {
    if (event.type === 'playing') {
      onlinePlaybackState.status = 'playing'
      onlinePlaybackState.errorCode = ''
      setCurrentTrackPlaying(true)
    } else if (event.type === 'paused') {
      onlinePlaybackState.status = 'paused'
      setCurrentTrackPlaying(false)
    } else if (event.type === 'buffering') {
      onlinePlaybackState.status = 'buffering'
    } else if (event.type === 'metadata') {
      onlinePlaybackState.duration = Number(event.duration) || 0
    } else if (event.type === 'progress') {
      onlinePlaybackState.currentTime = Number(event.currentTime) || 0
      onlinePlaybackState.duration = Number(event.duration) || onlinePlaybackState.duration
    } else if (event.type === 'ended' || event.type === 'stopped') {
      onlinePlaybackState.status = event.type === 'ended' ? 'ended' : 'stopped'
      onlinePlaybackState.currentTime = 0
      setCurrentTrackPlaying(false)
    } else if (event.type === 'error') {
      onlinePlaybackState.status = 'failed'
      onlinePlaybackState.errorCode = String(event.errorCode || 'MEDIA_ERROR')
      setCurrentTrackPlaying(false)
    }
  }) || null
}

bindAudioPlayer()

export function configureOnlinePlaybackRuntime(options = {}) {
  runtime = options.runtime || createSourceSearchRuntime()
  audioPlayer = options.player || getH5AudioPlayer()
  hasConsent = options.hasConsent || hasSourceExecutionConsent
  bindAudioPlayer()
}

export function getEligiblePlaybackSource(result, sources) {
  const sourceId = String(result?.sourceId || '')
  return (Array.isArray(sources) ? sources : []).find((source) => {
    return source?.id === sourceId
      && source.enabled === true
      && Array.isArray(source.capabilities)
      && source.capabilities.includes('play')
  }) || null
}

function resetProgress() {
  onlinePlaybackState.currentTime = 0
  onlinePlaybackState.duration = 0
}

export async function playOnlineResult(result, sources) {
  const source = getEligiblePlaybackSource(result, sources)
  if (!source) {
    onlinePlaybackState.status = 'failed'
    onlinePlaybackState.errorCode = 'PLAY_UNAVAILABLE'
    return { status: 'failed', errorCode: 'PLAY_UNAVAILABLE' }
  }
  if (!await hasConsent(source)) {
    onlinePlaybackState.status = 'failed'
    onlinePlaybackState.errorCode = 'CONSENT_REQUIRED'
    return { status: 'failed', errorCode: 'CONSENT_REQUIRED' }
  }

  const currentRequestVersion = requestVersion += 1
  runtime.cancelAll()
  audioPlayer.stop()
  resetProgress()
  onlinePlaybackState.activeTrackId = result.id
  onlinePlaybackState.status = 'resolving'
  onlinePlaybackState.errorCode = ''
  onlinePlaybackState.sourceId = source.id

  const playUrlResult = await runtime.runPlayUrl(source, result)
  if (currentRequestVersion !== requestVersion) {
    return { status: 'cancelled' }
  }
  if (playUrlResult.status !== 'success' || !playUrlResult.url) {
    onlinePlaybackState.status = playUrlResult.status === 'timeout' ? 'timeout' : 'failed'
    onlinePlaybackState.errorCode = String(playUrlResult.errorCode || 'PLAY_URL_UNAVAILABLE')
    return { status: onlinePlaybackState.status, errorCode: onlinePlaybackState.errorCode }
  }

  setOnlinePlaybackTrack(result)
  onlinePlaybackState.activeTrackId = result.id
  const started = await audioPlayer.play(playUrlResult.url)
  if (currentRequestVersion !== requestVersion) {
    return { status: 'cancelled' }
  }
  if (!started) {
    onlinePlaybackState.status = 'failed'
    onlinePlaybackState.errorCode = onlinePlaybackState.errorCode || 'PLAY_REJECTED'
    return { status: 'failed', errorCode: onlinePlaybackState.errorCode }
  }
  onlinePlaybackState.status = 'playing'
  setCurrentTrackPlaying(true)
  return { status: 'playing' }
}

export async function toggleOnlinePlayback() {
  if (onlinePlaybackState.status === 'playing' || onlinePlaybackState.status === 'buffering') {
    if (audioPlayer.pause()) {
      onlinePlaybackState.status = 'paused'
      setCurrentTrackPlaying(false)
      return { status: 'paused' }
    }
  }
  if (onlinePlaybackState.status === 'paused') {
    const resumed = await audioPlayer.resume()
    if (resumed) {
      onlinePlaybackState.status = 'playing'
      setCurrentTrackPlaying(true)
      return { status: 'playing' }
    }
  }
  return { status: 'unavailable' }
}

export function stopOnlinePlayback() {
  requestVersion += 1
  runtime.cancelAll()
  audioPlayer.stop()
  onlinePlaybackState.status = 'stopped'
  onlinePlaybackState.errorCode = ''
  resetProgress()
  setCurrentTrackPlaying(false)
}

export function stopOnlinePlaybackForSource(sourceId) {
  if (onlinePlaybackState.sourceId === sourceId) {
    stopOnlinePlayback()
  }
}
