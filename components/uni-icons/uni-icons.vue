<template>
  <text class="uni-icons" :style="iconStyle">{{ glyph }}</text>
</template>

<script setup>
import { computed } from 'vue'

const ICON_GLYPHS = {
  previous: '⏮',
  play: '▶',
  pause: 'Ⅱ',
  next: '⏭',
  sequence: '⇥',
  repeatOne: '↻1',
  shuffle: '⇄',
  queue: '☰',
  more: '⋯',
  lyrics: '词',
  down: '⌄',
  home: '⌂',
  search: '⌕'
}

const props = defineProps({
  type: {
    type: String,
    required: true
  },
  size: {
    type: [Number, String],
    default: 34
  },
  color: {
    type: String,
    default: 'currentColor'
  },
  fontFamily: {
    type: String,
    default: 'MusicShellIcons'
  }
})

const glyph = computed(() => ICON_GLYPHS[props.type] || ICON_GLYPHS.more)
const iconStyle = computed(() => ({
  color: props.color,
  fontFamily: `${props.fontFamily}, Arial, sans-serif`,
  fontSize: `${Number(props.size) || 34}rpx`
}))
</script>

<style scoped>
.uni-icons {
  font-weight: 900;
  line-height: 1;
}
</style>
