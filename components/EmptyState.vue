<template>
  <view class="empty-state">
    <view class="empty-mark">{{ mark }}</view>
    <text class="empty-title">{{ title }}</text>
    <text class="empty-desc">{{ description }}</text>
    <button v-if="actionText" class="empty-action" @tap="$emit('action')">
      {{ actionText }}
    </button>
  </view>
</template>

<script setup>
defineProps({
  mark: {
    type: String,
    default: '--'
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  actionText: {
    type: String,
    default: ''
  }
})

defineEmits(['action'])
</script>

<style scoped>
.empty-state {
  align-items: center;
  background: #181818;
  border: 1rpx solid #2a2d33;
  border-radius: 16rpx;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  padding: 44rpx 28rpx;
  text-align: center;
}

.empty-mark {
  align-items: center;
  background: #202124;
  border-radius: 999rpx;
  color: #1db954;
  display: flex;
  font-size: 28rpx;
  font-weight: 800;
  height: 72rpx;
  justify-content: center;
  width: 72rpx;
}

.empty-title {
  color: #f5f7fa;
  font-size: 32rpx;
  font-weight: 800;
}

.empty-desc {
  color: #a7adb8;
  font-size: 24rpx;
  line-height: 1.6;
  max-width: 560rpx;
}

.empty-action {
  background: #1db954;
  border-radius: 999rpx;
  color: #08110b;
  font-size: 24rpx;
  font-weight: 800;
  line-height: 72rpx;
  margin-top: 8rpx;
  min-height: 72rpx;
  padding: 0 34rpx;
}
</style>
