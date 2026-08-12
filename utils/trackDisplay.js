import { formatTime } from './formatTime'

export function getTrackArtist(track, fallback) {
  return track?.artist || fallback
}

export function getTrackAlbum(track, fallback) {
  return track?.album || fallback
}

export function getTrackMeta(track, fallbacks) {
  return `${getTrackArtist(track, fallbacks.artist)} / ${getTrackAlbum(track, fallbacks.album)}`
}

export function getTrackDurationLabel(track, fallback) {
  if (!Number.isFinite(track?.duration) || track.duration <= 0) {
    return fallback
  }

  const seconds = track.scanSource === 'android-media-store'
    ? Math.floor(track.duration / 1000)
    : track.duration
  return formatTime(seconds)
}

export function getTrackCoverLabel(track) {
  const title = track?.title || track?.fileName || ''
  return title ? title.slice(0, 1).toUpperCase() : 'MS'
}

export function getTrackSourceLabel(track, translate) {
  const scanSource = track?.scanSource || ''
  if (scanSource === 'android-media-store') {
    return translate('track.sourceAndroidMediaStore')
  }
  if (scanSource === 'h5-choose-file') {
    return translate('track.sourceH5Picker')
  }
  if (scanSource === 'mock') {
    return translate('track.sourceMock')
  }
  if (track?.sourceType === 'local') {
    return translate('track.sourceLocalIndex')
  }
  return translate('track.sourceUnknown')
}
