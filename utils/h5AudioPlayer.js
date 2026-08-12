export const H5_AUDIO_ERROR_CODES = {
  UNSUPPORTED_RUNTIME: 'UNSUPPORTED_RUNTIME',
  PLAY_REJECTED: 'PLAY_REJECTED',
  MEDIA_ERROR: 'MEDIA_ERROR'
}

function toFiniteSeconds(value) {
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0
}

export function createH5AudioPlayer(options = {}) {
  const createAudio = options.createAudio || (() => {
    return typeof Audio === 'function' ? new Audio() : null
  })
  const listeners = new Set()
  let audio = null
  let stopping = false

  function emit(event) {
    for (const listener of listeners) {
      listener(event)
    }
  }

  function clearSource() {
    if (!audio || !audio.src) {
      return
    }
    stopping = true
    audio.pause()
    audio.removeAttribute('src')
    audio.load()
    stopping = false
  }

  function ensureAudio() {
    if (audio) {
      return audio
    }
    audio = createAudio()
    if (!audio || typeof audio.addEventListener !== 'function') {
      audio = null
      return null
    }
    audio.preload = 'none'
    audio.controls = false
    audio.addEventListener('playing', () => emit({ type: 'playing' }))
    audio.addEventListener('pause', () => {
      if (!stopping && audio?.src) {
        emit({ type: 'paused' })
      }
    })
    audio.addEventListener('timeupdate', () => {
      emit({
        type: 'progress',
        currentTime: toFiniteSeconds(audio.currentTime),
        duration: toFiniteSeconds(audio.duration)
      })
    })
    audio.addEventListener('loadedmetadata', () => {
      emit({ type: 'metadata', duration: toFiniteSeconds(audio.duration) })
    })
    audio.addEventListener('waiting', () => emit({ type: 'buffering' }))
    audio.addEventListener('stalled', () => emit({ type: 'buffering' }))
    audio.addEventListener('ended', () => {
      clearSource()
      emit({ type: 'ended' })
    })
    audio.addEventListener('error', () => {
      clearSource()
      emit({ type: 'error', errorCode: H5_AUDIO_ERROR_CODES.MEDIA_ERROR })
    })
    return audio
  }

  async function play(url) {
    const instance = ensureAudio()
    if (!instance || typeof url !== 'string' || !url) {
      emit({ type: 'error', errorCode: H5_AUDIO_ERROR_CODES.UNSUPPORTED_RUNTIME })
      return false
    }
    clearSource()
    instance.src = url
    try {
      await instance.play()
      return true
    } catch (error) {
      clearSource()
      emit({ type: 'error', errorCode: H5_AUDIO_ERROR_CODES.PLAY_REJECTED })
      return false
    }
  }

  async function resume() {
    if (!audio?.src) {
      return false
    }
    try {
      await audio.play()
      return true
    } catch (error) {
      emit({ type: 'error', errorCode: H5_AUDIO_ERROR_CODES.PLAY_REJECTED })
      return false
    }
  }

  function pause() {
    if (!audio?.src) {
      return false
    }
    audio.pause()
    return true
  }

  function stop() {
    if (!audio?.src) {
      return false
    }
    clearSource()
    emit({ type: 'stopped' })
    return true
  }

  function subscribe(listener) {
    if (typeof listener !== 'function') {
      return () => {}
    }
    listeners.add(listener)
    return () => listeners.delete(listener)
  }

  return { play, resume, pause, stop, subscribe }
}

let sharedPlayer = null

export function getH5AudioPlayer() {
  if (!sharedPlayer) {
    sharedPlayer = createH5AudioPlayer()
  }
  return sharedPlayer
}
