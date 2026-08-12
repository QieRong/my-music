<template>
  <view class="sheet-mask" @tap="$emit('close')">
    <view class="sheet-card" @tap.stop>
      <view class="sheet-handle"></view>
      <view class="sheet-head">
        <view class="sheet-title-wrap">
          <text class="sheet-eyebrow">{{ eyebrow }}</text>
          <text class="sheet-title">{{ title }}</text>
        </view>
        <PlayerIconButton
          name="down"
          size="compact"
          :label="closeLabel"
          @tap="$emit('close')"
        />
      </view>

      <view class="sheet-list">
        <view v-for="row in rows" :key="row.label" class="sheet-row">
          <text class="row-label">{{ row.label }}</text>
          <text class="row-value">{{ row.value }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import PlayerIconButton from './PlayerIconButton.vue'

defineProps({
  eyebrow: {
    type: String,
    required: true
  },
  title: {
    type: String,
    required: true
  },
  rows: {
    type: Array,
    default: () => []
  },
  closeLabel: {
    type: String,
    required: true
  }
})

defineEmits(['close'])
</script>

<style scoped>
.sheet-mask {
  align-items: flex-end;
  background: rgba(0, 0, 0, 0.62);
  bottom: 0;
  display: flex;
  left: 0;
  padding: 0 24rpx calc(24rpx + env(safe-area-inset-bottom));
  position: fixed;
  right: 0;
  top: 0;
  z-index: 220;
}

.sheet-card {
  background: #181818;
  border: 1rpx solid #2a2d33;
  border-radius: 28rpx;
  box-shadow: 0 -24rpx 64rpx rgba(0, 0, 0, 0.36);
  box-sizing: border-box;
  margin: 0 auto;
  max-width: 900rpx;
  padding: 18rpx 24rpx 28rpx;
  width: 100%;
}

.sheet-handle {
  background: #4b5563;
  border-radius: 999rpx;
  height: 8rpx;
  margin: 0 auto 22rpx;
  width: 88rpx;
}

.sheet-head {
  align-items: center;
  display: flex;
  gap: 20rpx;
  justify-content: space-between;
}

.sheet-title-wrap {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 8rpx;
  min-width: 0;
}

.sheet-eyebrow {
  color: #1db954;
  font-size: 21rpx;
  font-weight: 900;
}

.sheet-title {
  color: #f5f7fa;
  font-size: 32rpx;
  font-weight: 900;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sheet-list {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  margin-top: 24rpx;
}

.sheet-row {
  background: #202124;
  border-radius: 14rpx;
  display: flex;
  gap: 18rpx;
  justify-content: space-between;
  padding: 18rpx;
}

.row-label,
.row-value {
  font-size: 24rpx;
  line-height: 1.45;
}

.row-label {
  color: #8d96a5;
  flex: 0 0 180rpx;
}

.row-value {
  color: #f5f7fa;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
