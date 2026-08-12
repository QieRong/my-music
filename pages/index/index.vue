<template>
  <PageShell show-mini-player>
    <view class="hero">
      <view>
        <text class="eyebrow">LOCAL FIRST PLAYER</text>
        <text class="title">{{ t('app.name') }}</text>
        <text class="subtitle">{{ t('home.subtitle') }}</text>
      </view>
    </view>

    <view class="now-card" @tap="openNowPlaying">
      <view class="now-cover" :style="{ background: coverColor }">
        <text>{{ coverLabel }}</text>
      </view>
      <view class="now-copy">
        <text class="now-label">{{ t('home.nowPlaying') }}</text>
        <text class="now-title">{{ nowTitle }}</text>
        <text class="now-desc">{{ nowDesc }}</text>
      </view>
      <button class="now-button" @tap.stop="openNowPlaying">
        {{ currentTrack ? t('home.continuePlaying') : t('home.goSearch') }}
      </button>
    </view>

    <view class="section">
      <view class="section-head">
        <text class="section-title">{{ t('home.recent') }}</text>
        <text class="section-note">{{ recentTracks.length ? t('home.stateSaved') : t('home.notStarted') }}</text>
      </view>
      <view v-if="recentTracks.length" class="list-card">
        <SongListItem
          v-for="track in recentTracks"
          :key="track.id"
          :track="track"
          :active="track.id === playerState.currentTrackId"
          @select="playTrack(track.id)"
        />
      </view>
      <EmptyState
        v-else
        mark="MS"
        :title="t('empty.recent')"
        :description="t('home.emptyRecentDesc')"
        :action-text="t('home.goSearch')"
        @action="goToRoute(ROUTES.SEARCH)"
      />
    </view>

    <view class="home-grid">
      <view class="search-guide">
        <text class="guide-label">{{ t('home.searchGuideLabel') }}</text>
        <text class="guide-title">{{ t('home.searchGuideTitle') }}</text>
        <text class="guide-copy">{{ t('home.searchGuideDesc') }}</text>
        <button class="guide-button" @tap="goToRoute(ROUTES.SEARCH)">
          {{ t('nav.search') }}
        </button>
      </view>

      <view class="phase-card">
        <text class="phase-label">{{ t('home.phaseLabel') }}</text>
        <text class="phase-title">{{ t('home.phaseTitle') }}</text>
        <text class="phase-copy">{{ t('home.phaseDesc') }}</text>
      </view>
    </view>
  </PageShell>
</template>

<script setup>
import { computed } from 'vue'
import EmptyState from '../../components/EmptyState.vue'
import PageShell from '../../components/PageShell.vue'
import SongListItem from '../../components/SongListItem.vue'
import { ROUTES, goToRoute } from '../../constants/routes'
import { getCurrentTrack, getRecentTracks, playTrack, playerState } from '../../stores/playerStore'
import { getTrackCoverLabel, getTrackMeta } from '../../utils/trackDisplay'
import { t } from '../../utils/i18n'

const currentTrack = computed(() => getCurrentTrack())
const recentTracks = computed(() => getRecentTracks(4))
const coverColor = computed(() => currentTrack.value ? currentTrack.value.coverColor : '#202124')
const coverLabel = computed(() => currentTrack.value ? getTrackCoverLabel(currentTrack.value) : 'MS')
const nowTitle = computed(() => currentTrack.value ? currentTrack.value.title : t('player.notPlaying'))
const nowDesc = computed(() => currentTrack.value
  ? getTrackMeta(currentTrack.value, {
    artist: t('track.unknownArtist'),
    album: t('track.unknownAlbum')
  })
  : t('home.noCurrentDesc'))

function openNowPlaying() {
  if (currentTrack.value) {
    goToRoute(ROUTES.PLAYER)
    return
  }
  goToRoute(ROUTES.SEARCH)
}
</script>

<style scoped>
.hero {
  align-items: flex-start;
  display: flex;
  gap: 24rpx;
  justify-content: space-between;
  margin-bottom: 30rpx;
}
.eyebrow,
.now-label,
.guide-label,
.phase-label,
.section-note {
  color: #1db954;
  font-size: 22rpx;
  font-weight: 900;
}
.title {
  color: #f5f7fa;
  display: block;
  font-size: 54rpx;
  font-weight: 900;
  margin-top: 10rpx;
}
.subtitle,
.now-desc,
.guide-copy,
.phase-copy {
  color: #a7adb8;
  display: block;
  font-size: 25rpx;
  line-height: 1.55;
  margin-top: 10rpx;
}
.now-card {
  align-items: center;
  background: #181818;
  border: 1rpx solid #2a2d33;
  border-radius: 16rpx;
  display: flex;
  gap: 20rpx;
  margin-bottom: 32rpx;
  padding: 22rpx;
}
.now-card:active,
.search-guide:active {
  background: #202124;
}
.now-cover {
  align-items: center;
  border-radius: 14rpx;
  display: flex;
  flex: 0 0 104rpx;
  height: 104rpx;
  justify-content: center;
  width: 104rpx;
}
.now-cover text {
  color: #ffffff;
  font-size: 30rpx;
  font-weight: 900;
}
.now-copy {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}
.now-title {
  color: #f5f7fa;
  font-size: 34rpx;
  font-weight: 900;
  margin-top: 8rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.now-button,
.guide-button {
  background: #1db954;
  border-radius: 999rpx;
  color: #08110b;
  flex: 0 0 auto;
  font-size: 23rpx;
  font-weight: 900;
  line-height: 66rpx;
  min-height: 66rpx;
  padding: 0 26rpx;
}
.section {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
  margin-bottom: 24rpx;
}
.section-head {
  align-items: center;
  display: flex;
  justify-content: space-between;
}
.section-title {
  color: #f5f7fa;
  font-size: 34rpx;
  font-weight: 900;
}
.list-card,
.search-guide,
.phase-card {
  background: #181818;
  border: 1rpx solid #2a2d33;
  border-radius: 16rpx;
}
.list-card {
  padding: 10rpx;
}
.home-grid {
  display: grid;
  gap: 20rpx;
  grid-template-columns: 1fr;
}
.search-guide,
.phase-card {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  padding: 28rpx;
}
.guide-title,
.phase-title {
  color: #f5f7fa;
  display: block;
  font-size: 34rpx;
  font-weight: 900;
}
.guide-button {
  align-self: flex-start;
  margin-top: 8rpx;
}
@media screen and (max-width: 380px) {
  .now-card {
    align-items: stretch;
    flex-direction: column;
  }
  .now-button {
    align-self: flex-start;
  }
}
@media screen and (min-width: 768px) {
  .home-grid {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
