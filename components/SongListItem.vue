<template>
  <view class="song-row" :class="{ active, muted: !interactive }" @tap="handleSelect">
    <view class="song-cover" :style="{ background: track.coverColor }">
      <text>{{ active ? 'ON' : coverLabel }}</text>
    </view>
    <view class="song-main">
      <text class="song-title">{{ track.title }}</text>
      <text class="song-meta">{{ trackMeta }}</text>
    </view>
    <text class="song-duration">{{ durationLabel }}</text>
  </view>
</template>

<script setup>
import { computed } from 'vue'
import { getTrackCoverLabel, getTrackDurationLabel, getTrackMeta } from '../utils/trackDisplay'
import { t } from '../utils/i18n'

const props = defineProps({
  track: {
    type: Object,
    required: true
  },
  active: {
    type: Boolean,
    default: false
  },
  interactive: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['select'])

const trackMeta = computed(() => getTrackMeta(props.track, {
  artist: t('track.unknownArtist'),
  album: t('track.unknownAlbum')
}))
const durationLabel = computed(() => getTrackDurationLabel(props.track, t('track.unknownDuration')))
const coverLabel = computed(() => getTrackCoverLabel(props.track))

function handleSelect() {
  if (props.interactive) {
    emit('select', props.track)
  }
}
</script>

<style scoped>
.song-row {
  align-items: center;
  border-radius: 12rpx;
  display: flex;
  gap: 20rpx;
  min-height: 112rpx;
  padding: 14rpx;
}

.song-row.active,
.song-row:not(.muted):active {
  background: #202124;
}

.song-cover {
  align-items: center;
  border-radius: 10rpx;
  box-shadow: 0 10rpx 22rpx rgba(0, 0, 0, 0.28);
  display: flex;
  flex: 0 0 76rpx;
  height: 76rpx;
  justify-content: center;
  overflow: hidden;
  width: 76rpx;
}

.song-cover text {
  color: #ffffff;
  font-size: 22rpx;
  font-weight: 900;
}

.song-main {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 8rpx;
  min-width: 0;
}

.song-title {
  color: #f5f7fa;
  font-size: 28rpx;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.song-meta {
  color: #a7adb8;
  font-size: 22rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.song-duration {
  color: #6f7785;
  flex: 0 0 72rpx;
  font-size: 22rpx;
  text-align: right;
}
</style>
