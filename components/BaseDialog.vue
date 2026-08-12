<template>
  <view class="dialog-mask">
    <view class="dialog-card">
      <view class="dialog-head">
        <slot name="head" />
      </view>
      <view class="dialog-body-wrap">
        <scroll-view
          class="dialog-body"
          scroll-y
          lower-threshold="24"
          @scroll="handleScroll"
          @scrolltolower="$emit('scrolltolower')"
        >
          <view class="dialog-content">
            <slot />
          </view>
        </scroll-view>
        <view class="dialog-scrollbar">
          <view class="dialog-scrollbar-thumb" :style="scrollbarThumbStyle" />
        </view>
      </view>
      <view class="dialog-actions">
        <slot name="actions" />
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed, getCurrentInstance, nextTick, onMounted, onUpdated, ref } from 'vue'

const emit = defineEmits(['scrolltolower', 'contentfits'])
const instance = getCurrentInstance()
const bodyHeight = ref(0)
const contentHeight = ref(0)
const scrollTop = ref(0)

const hasScrollableContent = computed(() => contentHeight.value > bodyHeight.value + 4)
const thumbHeight = computed(() => {
  if (!bodyHeight.value || !contentHeight.value) {
    return 44
  }
  if (!hasScrollableContent.value) {
    return bodyHeight.value
  }
  return Math.max(36, Math.round((bodyHeight.value / contentHeight.value) * bodyHeight.value))
})
const thumbOffset = computed(() => {
  const maxScroll = contentHeight.value - bodyHeight.value
  const maxOffset = bodyHeight.value - thumbHeight.value
  if (maxScroll <= 0 || maxOffset <= 0) {
    return 0
  }
  return Math.round((scrollTop.value / maxScroll) * maxOffset)
})
const scrollbarThumbStyle = computed(() => ({
  height: `${thumbHeight.value}px`,
  transform: `translateY(${thumbOffset.value}px)`
}))

function measureScrollableContent() {
  nextTick(() => {
    setTimeout(() => {
      const query = uni.createSelectorQuery().in(instance?.proxy)
      query.select('.dialog-body').boundingClientRect()
      query.select('.dialog-content').boundingClientRect()
      query.exec((nodes) => {
        const body = nodes && nodes[0]
        const content = nodes && nodes[1]
        if (!body || !content) {
          return
        }
        bodyHeight.value = body.height || 0
        contentHeight.value = content.height || 0
        if (contentHeight.value <= bodyHeight.value + 4) {
          emit('contentfits')
        }
      })
    }, 60)
  })
}

function handleScroll(event) {
  const detail = event?.detail || {}
  scrollTop.value = detail.scrollTop || 0
  if (detail.scrollHeight) {
    contentHeight.value = detail.scrollHeight
  }
  if (hasScrollableContent.value && scrollTop.value + bodyHeight.value >= contentHeight.value - 4) {
    emit('scrolltolower')
  }
}

onMounted(measureScrollableContent)
onUpdated(measureScrollableContent)
</script>

<style scoped>
.dialog-mask {
  align-items: center;
  background: rgba(0, 0, 0, 0.68);
  bottom: 0;
  box-sizing: border-box;
  display: flex;
  justify-content: center;
  left: 0;
  padding: 48rpx;
  position: fixed;
  right: 0;
  top: 0;
  z-index: 999;
}

.dialog-card {
  background: #181818;
  border: 1rpx solid #2a2d33;
  border-radius: 44rpx;
  box-shadow: 0 34rpx 88rpx rgba(0, 0, 0, 0.4);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  max-height: 74vh;
  max-width: 704rpx;
  padding: 44rpx 52rpx 34rpx;
  width: 100%;
}

.dialog-head {
  flex: 0 0 auto;
}

.dialog-body-wrap {
  flex: 0 1 auto;
  height: 46vh;
  margin-top: 28rpx;
  max-height: 46vh;
  min-height: 260rpx;
  position: relative;
}

.dialog-body {
  box-sizing: border-box;
  height: 100%;
  padding-right: 18rpx;
}

.dialog-body :deep(.uni-scroll-view) {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.dialog-body :deep(.uni-scroll-view::-webkit-scrollbar) {
  display: none;
  height: 0;
  width: 0;
}

.dialog-scrollbar {
  background: #101317;
  border-radius: 999rpx;
  bottom: 0;
  overflow: hidden;
  position: absolute;
  right: 0;
  top: 0;
  width: 8rpx;
}

.dialog-scrollbar-thumb {
  background: #1db954;
  border-radius: 999rpx;
  box-shadow: 0 0 18rpx rgba(29, 185, 84, 0.32);
  opacity: 0.95;
}

.dialog-actions {
  align-items: center;
  display: flex;
  flex: 0 0 auto;
  gap: 18rpx;
  justify-content: flex-end;
  margin-top: 26rpx;
}

@media screen and (max-width: 380px) {
  .dialog-mask {
    padding: 28rpx;
  }

  .dialog-card {
    border-radius: 34rpx;
    padding: 36rpx 34rpx 30rpx;
  }

  .dialog-actions {
    align-items: stretch;
    flex-direction: column-reverse;
  }
}
</style>
