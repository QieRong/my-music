import { computed, reactive } from 'vue'

export const PLAYBACK_MODES = {
  SEQUENCE: 'sequence',
  REPEAT_ONE: 'repeat-one',
  SHUFFLE: 'shuffle'
}

const PLAYBACK_MODE_ORDER = [
  PLAYBACK_MODES.SEQUENCE,
  PLAYBACK_MODES.REPEAT_ONE,
  PLAYBACK_MODES.SHUFFLE
]

export const playerState = reactive({
  playlist: [],
  currentTrackId: '',
  onlineTrack: null,
  playbackKind: 'none',
  isPlaying: false,
  recentTrackIds: [],
  playbackMode: PLAYBACK_MODES.SEQUENCE
})

export const currentIndex = computed(() => {
  return playerState.playlist.findIndex((track) => track.id === playerState.currentTrackId)
})

export function setPlaylist(tracks) {
  playerState.playlist = Array.isArray(tracks) ? tracks : []
  if (playerState.playbackKind !== 'online' && !playerState.playlist.some((track) => track.id === playerState.currentTrackId)) {
    playerState.currentTrackId = ''
    playerState.playbackKind = 'none'
    playerState.isPlaying = false
  }
  playerState.recentTrackIds = playerState.recentTrackIds
    .filter((id) => playerState.playlist.some((track) => track.id === id))
}

export function getCurrentTrack() {
  if (playerState.playbackKind === 'online' && playerState.onlineTrack?.id === playerState.currentTrackId) {
    return playerState.onlineTrack
  }
  return playerState.playlist.find((track) => track.id === playerState.currentTrackId) || null
}

export function getRecentTracks(limit = 4) {
  return playerState.recentTrackIds
    .map((id) => playerState.playlist.find((track) => track.id === id))
    .filter(Boolean)
    .slice(0, limit)
}

export function playTrack(trackId) {
  const target = playerState.playlist.find((track) => track.id === trackId)
  if (!target) {
    return
  }
  playerState.onlineTrack = null
  playerState.playbackKind = 'local'
  playerState.currentTrackId = target.id
  playerState.isPlaying = true
  playerState.recentTrackIds = [
    target.id,
    ...playerState.recentTrackIds.filter((id) => id !== target.id)
  ].slice(0, 6)
}

export function setOnlinePlaybackTrack(track) {
  if (!track || typeof track.id !== 'string' || !track.id) {
    return false
  }
  playerState.onlineTrack = {
    id: track.id,
    sourceId: String(track.sourceId || ''),
    sourceName: String(track.sourceName || ''),
    trackId: String(track.trackId || ''),
    title: String(track.title || ''),
    artist: String(track.artist || ''),
    album: String(track.album || ''),
    duration: Number.isInteger(track.duration) ? track.duration : null,
    source: 'online'
  }
  playerState.playbackKind = 'online'
  playerState.currentTrackId = playerState.onlineTrack.id
  playerState.isPlaying = false
  return true
}

export function setCurrentTrackPlaying(isPlaying) {
  if (getCurrentTrack()) {
    playerState.isPlaying = Boolean(isPlaying)
  }
}

export function togglePlay() {
  if (!getCurrentTrack()) {
    return
  }
  playerState.isPlaying = !playerState.isPlaying
}

export function cyclePlaybackMode() {
  const currentModeIndex = PLAYBACK_MODE_ORDER.indexOf(playerState.playbackMode)
  const nextModeIndex = currentModeIndex < 0
    ? 0
    : (currentModeIndex + 1) % PLAYBACK_MODE_ORDER.length
  playerState.playbackMode = PLAYBACK_MODE_ORDER[nextModeIndex]
  return playerState.playbackMode
}

export function playNext() {
  if (!playerState.playlist.length) {
    return
  }
  const nextIndex = currentIndex.value < 0
    ? 0
    : (currentIndex.value + 1) % playerState.playlist.length
  playTrack(playerState.playlist[nextIndex].id)
}

export function playPrevious() {
  if (!playerState.playlist.length) {
    return
  }
  const previousIndex = currentIndex.value <= 0
    ? playerState.playlist.length - 1
    : currentIndex.value - 1
  playTrack(playerState.playlist[previousIndex].id)
}
