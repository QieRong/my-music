<template>
  <view class="quick-grid">
    <view
      v-for="entry in entries"
      :key="entry.title"
      class="quick-card"
      @tap="goToRoute(entry.route)"
    >
      <text class="quick-tag">{{ entry.tag }}</text>
      <text class="quick-title">{{ entry.title }}</text>
      <text class="quick-desc">{{ entry.description }}</text>
    </view>
  </view>
</template>

<script setup>
import { goToRoute } from '../constants/routes'

defineProps({
  entries: {
    type: Array,
    default: () => []
  }
})
</script>

<style scoped>
.quick-grid {
  display: grid;
  gap: 16rpx;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.quick-card {
  background: #181818;
  border: 1rpx solid #2a2d33;
  border-radius: 14rpx;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  min-height: 148rpx;
  padding: 22rpx;
}

.quick-card:active {
  background: #202124;
  border-color: rgba(29, 185, 84, 0.55);
}

.quick-tag {
  color: #1db954;
  font-size: 22rpx;
  font-weight: 900;
}

.quick-title {
  color: #f5f7fa;
  font-size: 28rpx;
  font-weight: 800;
}

.quick-desc {
  color: #a7adb8;
  font-size: 22rpx;
  line-height: 1.45;
}

@media screen and (min-width: 768px) {
  .quick-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
