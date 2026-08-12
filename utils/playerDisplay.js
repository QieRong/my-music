import { PLAYBACK_MODES } from '../stores/playerStore'
import {
  getTrackAlbum,
  getTrackArtist,
  getTrackSourceLabel
} from './trackDisplay'

const PLAYBACK_MODE_ICON = {
  [PLAYBACK_MODES.SEQUENCE]: 'sequence',
  [PLAYBACK_MODES.REPEAT_ONE]: 'repeatOne',
  [PLAYBACK_MODES.SHUFFLE]: 'shuffle'
}

const PLAYBACK_MODE_LABEL_KEY = {
  [PLAYBACK_MODES.SEQUENCE]: 'player.modeSequence',
  [PLAYBACK_MODES.REPEAT_ONE]: 'player.modeRepeatOne',
  [PLAYBACK_MODES.SHUFFLE]: 'player.modeShuffle'
}

export function getPlaybackModeIcon(mode) {
  return PLAYBACK_MODE_ICON[mode] || PLAYBACK_MODE_ICON[PLAYBACK_MODES.SEQUENCE]
}

export function getPlaybackModeLabelKey(mode) {
  return PLAYBACK_MODE_LABEL_KEY[mode] || PLAYBACK_MODE_LABEL_KEY[PLAYBACK_MODES.SEQUENCE]
}

export function buildPlayerInfoRows(track, options) {
  if (!track) {
    return []
  }

  const translate = options.translate
  return [
    { label: translate('player.infoTrackTitle'), value: track.title },
    { label: translate('player.infoArtist'), value: getTrackArtist(track, translate('track.unknownArtist')) },
    { label: translate('player.infoAlbum'), value: getTrackAlbum(track, translate('track.unknownAlbum')) },
    { label: translate('player.infoDuration'), value: options.durationLabel },
    { label: translate('player.infoSource'), value: getTrackSourceLabel(track, translate) },
    { label: translate('player.infoStage'), value: translate('player.infoStageValue') }
  ]
}
