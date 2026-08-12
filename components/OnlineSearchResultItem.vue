<template>
  <view class="online-result-row">
    <view class="online-result-mark">
      <text>ON</text>
    </view>
    <view class="online-result-main">
      <text class="online-result-title">{{ result.title }}</text>
      <text class="online-result-meta">{{ meta }}</text>
    </view>
    <view class="online-result-side">
      <text class="online-result-duration">{{ duration }}</text>
      <text class="online-result-source">{{ result.sourceName }}</text>
      <text class="online-result-only">{{ playbackStatus === 'resolving' ? t('search.onlinePlaybackResolving') : t('search.onlineResultOnly') }}</text>
      <view v-if="canPlay || canDownload" class="online-result-actions">
        <button v-if="canPlay" class="online-result-play" @tap.stop="$emit('play', result)">{{ t('search.onlinePlay') }}</button>
        <button v-if="canDownload" class="online-result-download" @tap.stop="$emit('download', result)">{{ t('search.onlineDownload') }}</button>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed } from 'vue'
import { formatTime } from '../utils/formatTime.js'
import { t } from '../utils/i18n.js'

const props = defineProps({
  result: {
    type: Object,
    required: true
  },
  canPlay: {
    type: Boolean,
    default: false
  },
  canDownload: {
    type: Boolean,
    default: false
  },
  playbackStatus: {
    type: String,
    default: 'idle'
  }
})

defineEmits(['play', 'download'])

const meta = computed(() => {
  const artist = props.result.artist || t('track.unknownArtist')
  const album = props.result.album || t('track.unknownAlbum')
  return `${artist} · ${album}`
})

const duration = computed(() => {
  return Number.isInteger(props.result.duration) ? formatTime(props.result.duration) : t('track.unknownDuration')
})
</script>

<style scoped>
.online-result-row {
  align-items: center;
  border-radius: 12rpx;
  display: flex;
  gap: 20rpx;
  min-height: 112rpx;
  padding: 14rpx;
}

.online-result-mark {
  align-items: center;
  background: #16351f;
  border: 1rpx solid #1db954;
  border-radius: 10rpx;
  display: flex;
  flex: 0 0 76rpx;
  height: 76rpx;
  justify-content: center;
  width: 76rpx;
}

.online-result-mark text {
  color: #d5f4df;
  font-size: 20rpx;
  font-weight: 900;
}

.online-result-main {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 8rpx;
  min-width: 0;
}

.online-result-title,
.online-result-meta,
.online-result-duration,
.online-result-only {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.online-result-title {
  color: #f5f7fa;
  font-size: 28rpx;
  font-weight: 700;
}

.online-result-meta,
.online-result-duration {
  color: #a7adb8;
  font-size: 22rpx;
}

.online-result-side {
  align-items: flex-end;
  display: flex;
  flex: 0 0 158rpx;
  flex-direction: column;
  gap: 8rpx;
}

.online-result-actions {
  display: flex;
  gap: 8rpx;
}

.online-result-only {
  color: #6f7785;
  font-size: 19rpx;
}

.online-result-source {
  color: #1db954;
  font-size: 19rpx;
  max-width: 136rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.online-result-play,
.online-result-download {
  background: #1db954;
  border-radius: 999rpx;
  color: #08110b;
  font-size: 18rpx;
  font-weight: 900;
  line-height: 42rpx;
  margin: 0;
  min-height: 42rpx;
  padding: 0 14rpx;
}

.online-result-download {
  background: #202124;
  color: #f5f7fa;
}
</style>
