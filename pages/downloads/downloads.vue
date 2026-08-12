<template>
  <PageShell show-mini-player>
    <view class="downloads-page">
      <text class="eyebrow">OFFLINE CACHE</text>
      <text class="page-title">{{ t('downloads.title') }}</text>
      <text class="page-desc">{{ t('downloads.desc') }}</text>

      <view class="quota-card">
        <text class="quota-title">{{ t('downloads.quotaTitle') }}</text>
        <text class="quota-copy">{{ formatBytes(downloadState.quota.usedBytes) }} / {{ formatBytes(downloadState.quota.limitBytes) }}</text>
        <text v-if="!downloadState.quota.estimateAvailable" class="quota-note">{{ t('downloads.quotaEstimateUnavailable') }}</text>
      </view>

      <view v-if="downloadState.tasks.length" class="section-card">
        <text class="section-title">{{ t('downloads.tasksTitle') }}</text>
        <view v-for="task in downloadState.tasks" :key="task.id" class="task-row">
          <view class="task-copy">
            <text class="task-title">{{ task.title }}</text>
            <text class="task-meta">{{ task.sourceName }} · {{ getTaskStatus(task) }} · {{ formatBytes(task.receivedBytes) }} / {{ formatBytes(task.totalBytes) }}</text>
          </view>
          <button v-if="['resolving', 'downloading', 'saving'].includes(task.status)" class="secondary-button" @tap="cancelDownload(task.id)">{{ t('downloads.cancel') }}</button>
        </view>
      </view>

      <view v-if="downloadState.cachedTracks.length" class="section-card">
        <view class="section-head">
          <text class="section-title">{{ t('downloads.cachedTitle') }}</text>
          <button class="secondary-button" @tap="clearVisible = true">{{ t('downloads.clear') }}</button>
        </view>
        <view v-for="track in downloadState.cachedTracks" :key="track.cacheId" class="task-row">
          <view class="task-copy">
            <text class="task-title">{{ track.title }}</text>
            <text class="task-meta">{{ track.artist || t('track.unknownArtist') }} · {{ formatBytes(track.byteSize) }}</text>
          </view>
          <button class="secondary-button" @tap="removeCachedTrack(track.cacheId)">{{ t('downloads.remove') }}</button>
        </view>
      </view>

      <EmptyState
        v-if="!downloadState.tasks.length && !downloadState.cachedTracks.length"
        mark="0"
        :title="t('downloads.emptyTitle')"
        :description="t('downloads.emptyDesc')"
      />

      <BaseDialog v-if="clearVisible">
        <template #head>
          <text class="dialog-title">{{ t('downloads.clearTitle') }}</text>
          <text class="dialog-copy">{{ t('downloads.clearCopy') }}</text>
        </template>
        <template #actions>
          <button class="secondary-button" @tap="clearVisible = false">{{ t('common.cancel') }}</button>
          <button class="primary-button" @tap="confirmClear">{{ t('downloads.clearConfirm') }}</button>
        </template>
      </BaseDialog>
    </view>
  </PageShell>
</template>

<script setup>
import { ref } from 'vue'
import BaseDialog from '../../components/BaseDialog.vue'
import EmptyState from '../../components/EmptyState.vue'
import PageShell from '../../components/PageShell.vue'
import {
  cancelDownload,
  clearCachedTracks,
  downloadState,
  hydrateDownloads,
  removeCachedTrack
} from '../../stores/downloadStore'
import { t } from '../../utils/i18n'

const clearVisible = ref(false)

hydrateDownloads()

function formatBytes(value) {
  const bytes = Number(value) || 0
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getTaskStatus(task) {
  const key = `downloads.status${String(task.status || '').charAt(0).toUpperCase()}${String(task.status || '').slice(1)}`
  return t(key)
}

async function confirmClear() {
  await clearCachedTracks()
  clearVisible.value = false
}
</script>

<style scoped>
.downloads-page {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.eyebrow {
  color: #1db954;
  font-size: 22rpx;
  font-weight: 900;
}

.page-title {
  color: #f5f7fa;
  font-size: 48rpx;
  font-weight: 900;
}

.page-desc {
  color: #a7adb8;
  font-size: 25rpx;
  line-height: 1.6;
}

.quota-card,
.section-card {
  background: #101317;
  border: 1rpx solid #242832;
  border-radius: 16rpx;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  padding: 20rpx;
}

.quota-title,
.section-title,
.task-title,
.dialog-title {
  color: #f5f7fa;
  font-size: 28rpx;
  font-weight: 900;
}

.quota-copy,
.quota-note,
.task-meta,
.dialog-copy {
  color: #a7adb8;
  font-size: 23rpx;
  line-height: 1.5;
}

.quota-note {
  color: #f2c46d;
}

.section-head,
.task-row {
  align-items: center;
  display: flex;
  gap: 16rpx;
  justify-content: space-between;
}

.task-row {
  border-top: 1rpx solid #242832;
  padding-top: 16rpx;
}

.task-copy {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 6rpx;
  min-width: 0;
}

.secondary-button,
.primary-button {
  border-radius: 999rpx;
  font-size: 22rpx;
  font-weight: 900;
  line-height: 58rpx;
  min-height: 58rpx;
  padding: 0 20rpx;
}

.secondary-button {
  background: #202124;
  color: #f5f7fa;
}

.primary-button {
  background: #1db954;
  color: #08110b;
}
</style>
