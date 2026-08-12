<template>
  <view class="page-shell" :class="{ 'has-mini': showMiniPlayer }">
    <scroll-view class="page-scroll" scroll-y>
      <view class="page-inner">
        <slot />
      </view>
    </scroll-view>
    <MiniPlayer v-if="showMiniPlayer" />
    <DisclaimerGate />
  </view>
</template>

<script setup>
import DisclaimerGate from './DisclaimerGate.vue'
import MiniPlayer from './MiniPlayer.vue'

defineProps({
  showMiniPlayer: {
    type: Boolean,
    default: false
  }
})
</script>

<style scoped>
.page-shell {
  background: #0b0d10;
  min-height: 100vh;
}

.page-scroll {
  height: 100vh;
}

.page-inner {
  box-sizing: border-box;
  margin: 0 auto;
  max-width: 1120rpx;
  min-height: 100vh;
  padding: 38rpx 28rpx 70rpx;
  width: 100%;
}

.has-mini .page-inner {
  padding-bottom: 268rpx;
}

@media screen and (min-width: 768px) {
  .page-inner {
    padding-left: 44rpx;
    padding-right: 44rpx;
  }
}
</style>
