<template>
  <view class="controls-row">
    <PlayerIconButton
      :name="playbackModeIcon"
      variant="mode"
      active
      :label="playbackModeLabel"
      @tap="$emit('cycle-mode')"
    />
    <PlayerIconButton
      name="previous"
      :label="t('player.previous')"
      @tap="$emit('previous')"
    />
    <PlayerIconButton
      :name="isPlaying ? 'pause' : 'play'"
      variant="primary"
      size="large"
      :label="isPlaying ? t('player.pause') : t('player.play')"
      @tap="$emit('toggle')"
    />
    <PlayerIconButton
      name="next"
      :label="t('player.next')"
      @tap="$emit('next')"
    />
    <PlayerIconButton
      name="queue"
      :label="t('player.queue')"
      @tap="$emit('queue')"
    />
  </view>
</template>

<script setup>
import PlayerIconButton from './PlayerIconButton.vue'
import { t } from '../utils/i18n'

defineProps({
  isPlaying: {
    type: Boolean,
    default: false
  },
  playbackModeIcon: {
    type: String,
    required: true
  },
  playbackModeLabel: {
    type: String,
    required: true
  }
})

defineEmits(['cycle-mode', 'previous', 'toggle', 'next', 'queue'])
</script>

<style scoped>
.controls-row {
  align-items: center;
  display: flex;
  gap: 18rpx;
  justify-content: space-between;
}

@media screen and (max-width: 360px) {
  .controls-row {
    gap: 10rpx;
  }
}
</style>
