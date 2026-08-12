<template>
  <view class="empty-wrap">
    <EmptyState
      mark="MS"
      :title="title"
      :description="description"
      :action-text="searchText"
      @action="$emit('search')"
    />
    <button class="secondary-action" @tap="$emit('home')">
      {{ homeText }}
    </button>
  </view>
</template>

<script setup>
import EmptyState from './EmptyState.vue'

defineProps({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  searchText: {
    type: String,
    required: true
  },
  homeText: {
    type: String,
    required: true
  }
})

defineEmits(['search', 'home'])
</script>

<style scoped>
.empty-wrap {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.secondary-action {
  align-self: center;
  background: #202124;
  border-radius: 999rpx;
  color: #f5f7fa;
  font-size: 24rpx;
  font-weight: 800;
  line-height: 72rpx;
  min-height: 72rpx;
  padding: 0 34rpx;
}

.secondary-action:active {
  opacity: 0.76;
  transform: scale(0.98);
}
</style>
