<template>
  <view class="mini-player">
    <view class="mini-inner">
      <view class="mini-main" @tap="openPlayer">
        <view class="mini-cover" :style="{ background: coverColor }">
          <text>{{ coverLabel }}</text>
        </view>
        <view class="mini-copy">
          <text class="mini-title">{{ title }}</text>
          <text class="mini-subtitle">{{ subtitle }}</text>
        </view>
      </view>
      <view class="mini-controls">
        <PlayerIconButton
          class="mini-control previous"
          name="previous"
          size="compact"
          :label="t('player.previous')"
          @tap="handlePrevious"
        />
        <PlayerIconButton
          class="mini-control"
          :name="playerState.isPlaying ? 'pause' : 'play'"
          :variant="playerState.isPlaying ? 'ghost' : 'mode'"
          size="compact"
          :label="playerState.isPlaying ? t('player.pause') : t('player.play')"
          @tap="handleTogglePlay"
        />
        <PlayerIconButton
          class="mini-control"
          name="next"
          size="compact"
          :label="t('player.next')"
          @tap="handleNext"
        />
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed } from 'vue'
import PlayerIconButton from './PlayerIconButton.vue'
import { ROUTES, goToRoute } from '../constants/routes'
import { getCurrentTrack, playNext, playPrevious, playerState, togglePlay } from '../stores/playerStore'
import { toggleOnlinePlayback } from '../stores/onlinePlaybackStore'
import { getTrackCoverLabel, getTrackArtist } from '../utils/trackDisplay'
import { t } from '../utils/i18n'

const currentTrack = computed(() => getCurrentTrack())
const title = computed(() => currentTrack.value ? currentTrack.value.title : t('player.notPlaying'))
const subtitle = computed(() => currentTrack.value
  ? getTrackArtist(currentTrack.value, t('track.unknownArtist'))
  : t('mini.chooseSong'))
const coverColor = computed(() => currentTrack.value ? currentTrack.value.coverColor : '#202124')
const coverLabel = computed(() => currentTrack.value ? getTrackCoverLabel(currentTrack.value) : 'MS')

function showNoCurrentToast() {
  uni.showToast({
    icon: 'none',
    title: t('mini.noCurrentToast')
  })
}

function isCurrentPlayerPage() {
  if (typeof getCurrentPages !== 'function') {
    return false
  }
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1]
  return currentPage?.route && `/${currentPage.route}` === ROUTES.PLAYER
}

function openPlayer() {
  if (!currentTrack.value) {
    showNoCurrentToast()
    return
  }
  if (isCurrentPlayerPage()) {
    return
  }
  goToRoute(ROUTES.PLAYER)
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
</script>

<style scoped>
.mini-player {
  bottom: calc(106rpx + env(safe-area-inset-bottom));
  left: 0;
  padding: 0 24rpx;
  position: fixed;
  right: 0;
  z-index: 80;
}

.mini-inner {
  align-items: center;
  background: rgba(24, 24, 24, 0.96);
  border: 1rpx solid #2a2d33;
  border-radius: 16rpx;
  box-shadow: 0 20rpx 50rpx rgba(0, 0, 0, 0.45);
  display: flex;
  gap: 14rpx;
  margin: 0 auto;
  max-width: 1040rpx;
  min-height: 100rpx;
  padding: 12rpx;
}

.mini-main {
  align-items: center;
  display: flex;
  flex: 1;
  gap: 16rpx;
  min-width: 0;
  padding-right: 4rpx;
}

.mini-main:active {
  opacity: 0.78;
}

.mini-cover {
  align-items: center;
  border-radius: 10rpx;
  display: flex;
  flex: 0 0 72rpx;
  height: 72rpx;
  justify-content: center;
  width: 72rpx;
}

.mini-cover text {
  color: #ffffff;
  font-size: 20rpx;
  font-weight: 900;
}

.mini-copy {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
  min-width: 0;
}

.mini-title {
  color: #f5f7fa;
  font-size: 26rpx;
  font-weight: 800;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mini-subtitle {
  color: #a7adb8;
  font-size: 21rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mini-controls {
  align-items: center;
  display: flex;
  flex: 0 0 auto;
  gap: 10rpx;
}

@media screen and (max-width: 360px) {
  .mini-control.previous {
    display: none;
  }
}
</style>
