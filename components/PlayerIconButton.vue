<template>
  <button
    class="player-icon-button"
    :class="[variant, size, { active, disabled }]"
    :aria-label="label"
    hover-class="none"
    @tap.stop="handleTap"
  >
    <uni-icons
      :type="name"
      :size="iconSize"
      color="currentColor"
      font-family="MusicShellIcons"
    />
    <text class="sr-only">{{ label }}</text>
  </button>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  name: {
    type: String,
    required: true
  },
  label: {
    type: String,
    required: true
  },
  variant: {
    type: String,
    default: 'ghost'
  },
  size: {
    type: String,
    default: 'medium'
  },
  active: {
    type: Boolean,
    default: false
  },
  disabled: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['tap'])
const iconSize = computed(() => {
  if (props.size === 'large') {
    return 46
  }
  if (props.size === 'compact') {
    return 28
  }
  return 34
})

function handleTap(event) {
  if (props.disabled) {
    return
  }
  emit('tap', event)
}
</script>

<style scoped>
.player-icon-button {
  align-items: center;
  background: #202124;
  border: 1rpx solid rgba(255, 255, 255, 0.06);
  border-radius: 999rpx;
  color: #f5f7fa;
  display: flex;
  flex: 0 0 auto;
  justify-content: center;
  margin: 0;
  padding: 0;
  position: relative;
  transform: scale(1);
  transition: opacity 0.16s ease, transform 0.16s ease;
}

.player-icon-button::after {
  border: 0;
}

.player-icon-button:active {
  opacity: 0.76;
  transform: scale(0.96);
}

.player-icon-button.medium {
  height: 68rpx;
  width: 68rpx;
}

.player-icon-button.large {
  height: 104rpx;
  width: 104rpx;
}

.player-icon-button.compact {
  height: 58rpx;
  width: 58rpx;
}

.player-icon-button.primary {
  background: #f5f7fa;
  color: #050706;
}

.player-icon-button.mode,
.player-icon-button.active {
  background: rgba(29, 185, 84, 0.14);
  border-color: rgba(29, 185, 84, 0.34);
  color: #1db954;
}

.player-icon-button.disabled {
  opacity: 0.52;
}

.sr-only {
  height: 1px;
  left: -9999px;
  overflow: hidden;
  position: absolute;
  top: auto;
  width: 1px;
}
</style>
