<template>
  <view v-if="mode === 'cover'" class="cover-mode fade-panel">
    <view class="artwork" :style="{ background: track.coverColor }">
      <text>{{ coverLabel }}</text>
    </view>
    <view class="lyrics-peek" @tap="$emit('change-mode', 'lyrics')">
      <view class="lyrics-peek-copy">
        <text class="lyrics-peek-title">{{ t('player.lyricsEmptyTitle') }}</text>
        <text class="lyrics-peek-desc">{{ t('player.lyricsEmptyDesc') }}</text>
      </view>
      <PlayerIconButton
        name="lyrics"
        size="compact"
        :label="t('player.openLyrics')"
        @tap="$emit('change-mode', 'lyrics')"
      />
    </view>
  </view>

  <view v-else class="lyrics-mode fade-panel" @tap="$emit('change-mode', 'cover')">
    <view class="lyrics-card">
      <text class="lyrics-title">{{ t('player.lyricsEmptyTitle') }}</text>
      <text class="lyrics-desc">{{ t('player.lyricsEmptyDesc') }}</text>
      <text class="lyrics-hint">{{ t('player.lyricsTapToCover') }}</text>
    </view>
  </view>
</template>

<script setup>
import PlayerIconButton from './PlayerIconButton.vue'
import { t } from '../utils/i18n'

defineProps({
  track: {
    type: Object,
    required: true
  },
  coverLabel: {
    type: String,
    required: true
  },
  mode: {
    type: String,
    default: 'cover'
  }
})

defineEmits(['change-mode'])
</script>

<style scoped>
.cover-mode,
.lyrics-mode {
  display: flex;
  flex-direction: column;
  gap: 22rpx;
}

.fade-panel {
  animation: softFade 0.18s ease both;
}

.artwork {
  align-items: center;
  aspect-ratio: 1;
  border-radius: 18rpx;
  box-shadow: 0 32rpx 80rpx rgba(0, 0, 0, 0.45);
  display: flex;
  justify-content: center;
  width: 100%;
}

.artwork text {
  color: #ffffff;
  font-size: 120rpx;
  font-weight: 900;
}

.lyrics-peek,
.lyrics-card {
  background: #181818;
  border: 1rpx solid #2a2d33;
  border-radius: 18rpx;
}

.lyrics-peek {
  align-items: center;
  display: flex;
  gap: 18rpx;
  justify-content: space-between;
  padding: 24rpx;
}

.lyrics-peek:active,
.lyrics-card:active {
  opacity: 0.78;
}

.lyrics-peek-copy,
.lyrics-card {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.lyrics-title,
.lyrics-peek-title {
  color: #f5f7fa;
  font-size: 30rpx;
  font-weight: 900;
}

.lyrics-desc,
.lyrics-hint,
.lyrics-peek-desc {
  color: #a7adb8;
  font-size: 24rpx;
  line-height: 1.55;
}

.lyrics-card {
  justify-content: center;
  min-height: 640rpx;
  padding: 48rpx;
}

.lyrics-hint {
  color: #1db954;
}

@keyframes softFade {
  from {
    opacity: 0.68;
  }

  to {
    opacity: 1;
  }
}

@media screen and (min-width: 768px) {
  .lyrics-card {
    min-height: 720rpx;
  }
}
</style>
