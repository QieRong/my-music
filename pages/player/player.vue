<template>
  <PageShell>
    <view class="player-page">
      <view class="top-row">
        <PlayerIconButton
          name="down"
          size="compact"
          :label="t('player.back')"
          @tap="goBack"
        />
        <text class="eyebrow">{{ t('player.nowPlaying') }}</text>
        <PlayerIconButton
          v-if="currentTrack"
          name="more"
          size="compact"
          :label="t('player.moreInfo')"
          @tap="infoVisible = true"
        />
        <view v-else class="top-placeholder"></view>
      </view>

      <view v-if="currentTrack" class="player-layout">
        <PlayerArtworkPanel
          :track="currentTrack"
          :cover-label="coverLabel"
          :mode="viewMode"
          @change-mode="viewMode = $event"
        />

        <view class="player-panel">
          <text class="track-title">{{ currentTrack.title }}</text>
          <text class="track-artist">{{ trackMeta }}</text>
          <view class="progress" aria-disabled="true">
            <view class="progress-fill" :style="{ width: `${progressPercent}%` }"></view>
          </view>
          <view class="time-row">
            <text>{{ currentTimeLabel }}</text>
            <text>{{ durationLabel }}</text>
          </view>
          <PlayerControls
            :is-playing="playerState.isPlaying"
            :playback-mode-icon="playbackModeIcon"
            :playback-mode-label="playbackModeLabel"
            @cycle-mode="handleCyclePlaybackMode"
            @previous="handlePrevious"
            @toggle="handleTogglePlay"
            @next="handleNext"
            @queue="showReadOnlyToast"
          />
          <text class="hint">{{ playerState.playbackKind === 'online' ? t('player.onlinePlaybackHint') : t('player.localIndexHint') }}</text>
        </view>
      </view>

      <PlayerEmptyState
        v-else
        :title="t('player.emptyTitle')"
        :description="t('player.emptyDesc')"
        :search-text="t('home.goSearch')"
        :home-text="t('player.returnHome')"
        @search="goToRoute(ROUTES.SEARCH)"
        @home="goToRoute(ROUTES.HOME)"
      />

      <PlayerInfoSheet
        v-if="infoVisible && currentTrack"
        :eyebrow="t('player.moreInfo')"
        :title="currentTrack.title"
        :rows="infoRows"
        :close-label="t('common.close')"
        @close="infoVisible = false"
      />
    </view>
  </PageShell>
</template>

<script setup>
import { computed, ref } from 'vue'
import PageShell from '../../components/PageShell.vue'
import PlayerArtworkPanel from '../../components/PlayerArtworkPanel.vue'
import PlayerControls from '../../components/PlayerControls.vue'
import PlayerEmptyState from '../../components/PlayerEmptyState.vue'
import PlayerIconButton from '../../components/PlayerIconButton.vue'
import PlayerInfoSheet from '../../components/PlayerInfoSheet.vue'
import { ROUTES, goToRoute } from '../../constants/routes'
import { getTrackCoverLabel, getTrackDurationLabel, getTrackMeta } from '../../utils/trackDisplay'
import { buildPlayerInfoRows, getPlaybackModeIcon, getPlaybackModeLabelKey } from '../../utils/playerDisplay'
import { t } from '../../utils/i18n'
import { formatTime } from '../../utils/formatTime.js'
import { cyclePlaybackMode, getCurrentTrack, playNext, playPrevious, playerState, togglePlay } from '../../stores/playerStore'
import { onlinePlaybackState, toggleOnlinePlayback } from '../../stores/onlinePlaybackStore'

const currentTrack = computed(() => getCurrentTrack())
const infoVisible = ref(false)
const viewMode = ref('cover')
const coverLabel = computed(() => currentTrack.value ? getTrackCoverLabel(currentTrack.value) : 'MS')
const trackMeta = computed(() => currentTrack.value
  ? getTrackMeta(currentTrack.value, {
    artist: t('track.unknownArtist'),
    album: t('track.unknownAlbum')
  })
  : '')
const durationLabel = computed(() => playerState.playbackKind === 'online' && onlinePlaybackState.duration
  ? formatTime(onlinePlaybackState.duration)
  : getTrackDurationLabel(currentTrack.value, t('track.unknownDuration')))
const currentTimeLabel = computed(() => playerState.playbackKind === 'online'
  ? formatTime(onlinePlaybackState.currentTime)
  : '0:00')
const progressPercent = computed(() => {
  if (playerState.playbackKind !== 'online' || !onlinePlaybackState.duration) return 18
  return Math.max(0, Math.min(100, (onlinePlaybackState.currentTime / onlinePlaybackState.duration) * 100))
})
const playbackModeLabel = computed(() => t(getPlaybackModeLabelKey(playerState.playbackMode)))
const playbackModeIcon = computed(() => getPlaybackModeIcon(playerState.playbackMode))
const infoRows = computed(() => buildPlayerInfoRows(currentTrack.value, {
  durationLabel: durationLabel.value,
  translate: t
}))

function formatMessage(key, params = {}) {
  return Object.keys(params).reduce((message, name) => {
    return message.replace(`{${name}}`, params[name])
  }, t(key))
}

function showNoCurrentToast() {
  uni.showToast({
    icon: 'none',
    title: t('mini.noCurrentToast')
  })
}

function showReadOnlyToast() {
  uni.showToast({
    icon: 'none',
    title: t('player.readOnlyToast')
  })
}

function goBack() {
  const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
  if (pages.length > 1) {
    uni.navigateBack()
    return
  }
  uni.switchTab({ url: ROUTES.HOME })
}

async function handleTogglePlay() {
  if (!currentTrack.value) {
    showNoCurrentToast()
    return
  }
  if (playerState.playbackKind === 'online') {
    const result = await toggleOnlinePlayback()
    if (result.status === 'unavailable') {
      uni.showToast({ icon: 'none', title: t('player.onlineResumeUnavailable') })
    }
    return
  }
  togglePlay()
}

function handlePrevious() {
  if (!currentTrack.value) {
    showNoCurrentToast()
    return
  }
  if (playerState.playbackKind === 'online') {
    uni.showToast({ icon: 'none', title: t('player.onlineTrackSelectionHint') })
    return
  }
  playPrevious()
}

function handleNext() {
  if (!currentTrack.value) {
    showNoCurrentToast()
    return
  }
  if (playerState.playbackKind === 'online') {
    uni.showToast({ icon: 'none', title: t('player.onlineTrackSelectionHint') })
    return
  }
  playNext()
}

function handleCyclePlaybackMode() {
  const nextMode = cyclePlaybackMode()
  const modeLabel = t(getPlaybackModeLabelKey(nextMode))
  uni.showToast({
    icon: 'none',
    title: formatMessage('player.modeChangedToast', { mode: modeLabel })
  })
}
</script>

<style scoped>
.player-page {
  display: flex;
  flex-direction: column;
  gap: 28rpx;
}

.top-row {
  align-items: center;
  display: flex;
  gap: 18rpx;
  justify-content: space-between;
}

.top-placeholder {
  height: 58rpx;
  width: 58rpx;
}

.eyebrow {
  color: #1db954;
  font-size: 22rpx;
  font-weight: 900;
}

.player-layout {
  display: grid;
  gap: 34rpx;
  grid-template-columns: 1fr;
}

.player-panel {
  background: #181818;
  border: 1rpx solid #2a2d33;
  border-radius: 18rpx;
  display: flex;
  flex-direction: column;
  gap: 22rpx;
  padding: 30rpx;
}

.track-title {
  color: #f5f7fa;
  font-size: 44rpx;
  font-weight: 900;
}

.track-artist,
.hint,
.time-row {
  color: #a7adb8;
  font-size: 24rpx;
}

.progress {
  background: #2a2d33;
  border-radius: 999rpx;
  height: 10rpx;
  overflow: hidden;
  pointer-events: none;
}

.progress-fill {
  background: #1db954;
  border-radius: 999rpx;
  height: 100%;
  width: 18%;
}

.time-row {
  align-items: center;
  display: flex;
  justify-content: space-between;
}

.hint,
.time-row {
  line-height: 1.5;
}

@media screen and (min-width: 768px) {
  .player-layout {
    align-items: center;
    grid-template-columns: 0.9fr 1.1fr;
  }
}
</style>
