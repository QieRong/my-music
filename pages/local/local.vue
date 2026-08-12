<template>
  <PageShell show-mini-player>
    <view class="local-page">
      <view class="page-head">
        <text class="eyebrow">LOCAL INDEX</text>
        <text class="page-title">{{ t('nav.local') }}</text>
        <text class="page-desc">{{ t('library.managementDesc') }}</text>
      </view>

      <view class="summary-card">
        <view>
          <text class="summary-label">{{ t('library.indexedCount') }}</text>
          <text class="summary-value">{{ countLabel }}</text>
        </view>
        <button class="primary-button" :disabled="isScanning" :class="{ busy: isScanning }" @tap="scanLocalMusic">
          {{ scanButtonText }}
        </button>
      </view>

      <view class="scan-status-card" :class="{ alert: scanNeedsAttention }">
        <text>{{ scanStatusText }}</text>
        <button v-if="canOpenScanSettings" class="settings-button" @tap="openScanSettings">
          {{ t('library.openPermissionSettings') }}
        </button>
      </view>

      <view class="notice-card">
        <text class="notice-title">{{ t('library.boundaryTitle') }}</text>
        <text class="notice-copy">{{ t('library.boundaryDesc') }}</text>
        <text class="notice-copy">{{ t('library.capacity') }}</text>
      </view>

      <view v-if="libraryState.tracks.length" class="section">
        <view class="section-head">
          <text class="section-title">{{ t('library.indexList') }}</text>
          <button class="clear-button" @tap="confirmClearVisible = true">
            {{ t('library.clear') }}
          </button>
        </view>

        <view class="list-card">
          <view v-for="track in libraryState.tracks" :key="track.id" class="index-row">
            <SongListItem :track="track" :interactive="false" />
            <view class="file-meta">
              <text>{{ formatFileMeta(track) }}</text>
              <button class="remove-button" @tap="handleRemove(track.id)">
                {{ t('library.remove') }}
              </button>
            </view>
          </view>
        </view>
      </view>

      <EmptyState
        v-else
        mark="0"
        :title="t('library.emptyTitle')"
        :description="t('library.emptyDesc')"
        :action-text="t('library.importAction')"
        @action="scanLocalMusic"
      />
    </view>

    <BaseDialog v-if="confirmClearVisible">
      <template #head>
        <text class="dialog-title">{{ t('library.clearConfirmTitle') }}</text>
        <text class="dialog-subtitle">{{ t('library.clearConfirmContent') }}</text>
      </template>

      <view class="dialog-copy">
        <text>{{ t('library.clearConfirmDesc') }}</text>
      </view>

      <template #actions>
        <button class="dialog-secondary" @tap="confirmClearVisible = false">
          {{ t('common.cancel') }}
        </button>
        <button class="dialog-danger" @tap="handleClear">
          {{ t('library.clearConfirm') }}
        </button>
      </template>
    </BaseDialog>
  </PageShell>
</template>

<script setup>
import { computed, ref } from 'vue'
import BaseDialog from '../../components/BaseDialog.vue'
import EmptyState from '../../components/EmptyState.vue'
import PageShell from '../../components/PageShell.vue'
import SongListItem from '../../components/SongListItem.vue'
import {
  clearLocalLibrary,
  hydrateLibrary,
  importLocalScanResult,
  libraryState,
  removeLocalTrack,
  updateScanMeta
} from '../../stores/libraryStore'
import { canUseApp } from '../../stores/appStore'
import {
  LOCAL_SCAN_STATUSES,
  openLocalMusicScanSettings,
  requestLocalMusicScan
} from '../../utils/localMusicScanner'
import { t } from '../../utils/i18n'

hydrateLibrary()

const confirmClearVisible = ref(false)
const isScanning = ref(false)
const countLabel = computed(() => formatMessage('library.countLabel', {
  count: libraryState.tracks.length
}))
const scanButtonText = computed(() => {
  if (isScanning.value) {
    return t('library.scanStatusScanning')
  }
  return t(libraryState.tracks.length ? 'library.rescanAction' : 'library.importAction')
})
const scanNeedsAttention = computed(() => [
  LOCAL_SCAN_STATUSES.DENIED,
  LOCAL_SCAN_STATUSES.BLOCKED_SETTINGS,
  LOCAL_SCAN_STATUSES.SCAN_FAILED
].includes(libraryState.scanMeta.status))
const canOpenScanSettings = computed(() => libraryState.scanMeta.status === LOCAL_SCAN_STATUSES.BLOCKED_SETTINGS)
const scanStatusText = computed(() => getScanStatusText())

function formatMessage(key, params = {}) {
  return Object.keys(params).reduce((message, name) => {
    return message.replace(`{${name}}`, params[name])
  }, t(key))
}

function formatFileSize(size) {
  if (!size) {
    return '0 KB'
  }
  if (size < 1024 * 1024) {
    return `${Math.max(1, Math.round(size / 1024))} KB`
  }
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

function formatFileMeta(track) {
  return `${formatFileSize(track.fileSize)} / ${track.fileType}`
}

function getSkippedCount(stats = {}) {
  return (stats.shortSkippedCount || 0)
    + (stats.smallSkippedCount || 0)
    + (stats.missingMetadataSkippedCount || 0)
    + (stats.nonMusicSkippedCount || 0)
    + (stats.duplicateSkippedCount || 0)
    + (stats.failedCount || 0)
}

function getScanStatusText() {
  const status = libraryState.scanMeta.status
  const stats = libraryState.scanMeta.stats || {}
  if (status === LOCAL_SCAN_STATUSES.REQUESTING) {
    return t('library.scanStatusRequesting')
  }
  if (status === LOCAL_SCAN_STATUSES.SCANNING) {
    return t('library.scanStatusScanning')
  }
  if (status === LOCAL_SCAN_STATUSES.COMPLETED) {
    return t('library.scanStatusComplete')
  }
  if (status === LOCAL_SCAN_STATUSES.HAS_RESULTS) {
    if (stats.classificationMode === 'system') {
      return formatMessage('library.scanStatusSystemResults', {
        audio: stats.queriedCount || 0,
        music: stats.systemMusicCount || 0,
        other: stats.otherAudioCount || 0,
        indexed: stats.indexedCount || 0
      })
    }
    if (stats.classificationMode === 'fallback' || stats.classificationMode === 'mixed') {
      return formatMessage('library.scanStatusFallbackResults', {
        audio: stats.queriedCount || 0,
        indexed: stats.indexedCount || 0,
        skipped: getSkippedCount(stats)
      })
    }
    return formatMessage('library.scanStatusHasResults', {
      count: stats.indexedCount || 0,
      skipped: getSkippedCount(stats)
    })
  }
  if (status === LOCAL_SCAN_STATUSES.EMPTY) {
    return t('library.scanStatusEmpty')
  }
  if (status === LOCAL_SCAN_STATUSES.DENIED) {
    return t('library.scanStatusDenied')
  }
  if (status === LOCAL_SCAN_STATUSES.BLOCKED_SETTINGS) {
    return t('library.scanStatusBlocked')
  }
  if (status === LOCAL_SCAN_STATUSES.SCAN_FAILED) {
    return t('library.scanStatusFailed')
  }
  return t('library.scanStatusExplain')
}

function showScanResult(result, scanResult) {
  if (result.persistenceFailed) {
    uni.showToast({ icon: 'none', title: t('library.persistenceFailedToast') })
    return
  }

  if (scanResult.status === LOCAL_SCAN_STATUSES.DENIED) {
    uni.showToast({ icon: 'none', title: t('library.permissionDeniedToast') })
    return
  }

  if (scanResult.status === LOCAL_SCAN_STATUSES.BLOCKED_SETTINGS) {
    uni.showToast({ icon: 'none', title: t('library.permissionBlockedToast') })
    return
  }

  if (scanResult.status === LOCAL_SCAN_STATUSES.SCAN_FAILED) {
    uni.showToast({ icon: 'none', title: t('library.scanFailedToast') })
    return
  }

  if (scanResult.status === LOCAL_SCAN_STATUSES.EMPTY) {
    uni.showToast({ icon: 'none', title: t('library.scanEmptyToast') })
    return
  }

  if (result.addedCount > 0) {
    uni.showToast({
      icon: 'none',
      title: formatMessage('library.importSuccess', { count: result.addedCount })
    })
    return
  }

  if (result.duplicateCount > 0) {
    uni.showToast({ icon: 'none', title: t('library.duplicateToast') })
    return
  }

  if (result.unsupportedCount > 0) {
    uni.showToast({ icon: 'none', title: t('library.unsupportedToast') })
    return
  }

  uni.showToast({ icon: 'none', title: t('library.importNothing') })
}

async function scanLocalMusic() {
  hydrateLibrary()
  if (!canUseApp.value) {
    uni.showToast({ icon: 'none', title: t('library.scanNeedDisclaimer') })
    return
  }
  if (isScanning.value) {
    return
  }

  try {
    isScanning.value = true
    updateScanMeta({ status: LOCAL_SCAN_STATUSES.REQUESTING })
    const scanResult = await requestLocalMusicScan({
      onStatus: (status) => updateScanMeta({ status })
    })
    if (scanResult.cancelled) {
      updateScanMeta({ status: LOCAL_SCAN_STATUSES.IDLE })
      return
    }

    const terminalStatuses = [
      LOCAL_SCAN_STATUSES.DENIED,
      LOCAL_SCAN_STATUSES.BLOCKED_SETTINGS,
      LOCAL_SCAN_STATUSES.SCAN_FAILED
    ]
    if (terminalStatuses.includes(scanResult.status)) {
      updateScanMeta({
        status: scanResult.status,
        source: scanResult.mode,
        stats: scanResult.stats
      })
      showScanResult({ addedCount: 0 }, scanResult)
      return
    }

    const result = importLocalScanResult(scanResult)
    showScanResult(result, scanResult)
  } catch (error) {
    updateScanMeta({ status: LOCAL_SCAN_STATUSES.SCAN_FAILED })
    const key = error?.code === 'SCAN_UNSUPPORTED'
      ? 'library.chooseUnsupported'
      : 'library.chooseFailed'
    uni.showToast({ icon: 'none', title: t(key) })
  } finally {
    isScanning.value = false
  }
}

function handleRemove(trackId) {
  const result = removeLocalTrack(trackId)
  if (!result.removed) {
    return
  }

  const key = result.persistenceFailed
    ? 'library.mutationPersistenceFailedToast'
    : 'library.removeSuccess'
  uni.showToast({ icon: 'none', title: t(key) })
}

function handleClear() {
  const result = clearLocalLibrary()
  confirmClearVisible.value = false
  const key = result.persistenceFailed
    ? 'library.mutationPersistenceFailedToast'
    : 'library.clearSuccess'
  uni.showToast({ icon: 'none', title: t(key) })
}

async function openScanSettings() {
  const opened = await openLocalMusicScanSettings()
  if (!opened) {
    uni.showToast({ icon: 'none', title: t('library.openSettingsFailed') })
  }
}
</script>

<style scoped>
.local-page,
.page-head,
.section,
.notice-card {
  display: flex;
  flex-direction: column;
}

.local-page {
  gap: 24rpx;
}

.page-head {
  gap: 12rpx;
}

.eyebrow,
.summary-label {
  color: #1db954;
  font-size: 22rpx;
  font-weight: 900;
}

.page-title {
  color: #f5f7fa;
  font-size: 48rpx;
  font-weight: 900;
}

.page-desc,
.notice-copy,
.file-meta,
.dialog-copy,
.dialog-subtitle,
.scan-status-card {
  color: #a7adb8;
  font-size: 25rpx;
  line-height: 1.6;
}

.summary-card,
.notice-card,
.list-card {
  background: #181818;
  border: 1rpx solid #2a2d33;
  border-radius: 16rpx;
}

.summary-card {
  align-items: center;
  display: flex;
  gap: 22rpx;
  justify-content: space-between;
  padding: 26rpx;
}

.summary-value {
  color: #f5f7fa;
  display: block;
  font-size: 38rpx;
  font-weight: 900;
  margin-top: 10rpx;
}

.notice-card {
  gap: 12rpx;
  padding: 26rpx;
}

.scan-status-card {
  align-items: center;
  background: #101317;
  border: 1rpx solid #242832;
  border-radius: 14rpx;
  display: flex;
  gap: 18rpx;
  justify-content: space-between;
  padding: 18rpx 22rpx;
}

.scan-status-card.alert {
  border-color: #4b3a23;
  color: #f2c46d;
}

.notice-title,
.section-title,
.dialog-title {
  color: #f5f7fa;
  font-size: 32rpx;
  font-weight: 900;
}

.section {
  gap: 16rpx;
}

.section-head {
  align-items: center;
  display: flex;
  justify-content: space-between;
}

.list-card {
  overflow: hidden;
  padding: 10rpx;
}

.index-row {
  border-bottom: 1rpx solid #252932;
  padding-bottom: 14rpx;
}

.index-row:last-child {
  border-bottom: 0;
  padding-bottom: 0;
}

.file-meta {
  align-items: center;
  display: flex;
  justify-content: space-between;
  padding: 0 14rpx 14rpx 110rpx;
}

.primary-button,
.clear-button,
.remove-button,
.settings-button,
.dialog-secondary,
.dialog-danger {
  border-radius: 999rpx;
  font-size: 24rpx;
  font-weight: 900;
  line-height: 68rpx;
  min-height: 68rpx;
  padding: 0 26rpx;
}

.primary-button,
.dialog-danger {
  background: #1db954;
  color: #08110b;
}

.clear-button,
.remove-button,
.settings-button,
.dialog-secondary {
  background: #202124;
  color: #f5f7fa;
}

.remove-button {
  flex: 0 0 auto;
  line-height: 58rpx;
  min-height: 58rpx;
  padding: 0 20rpx;
}

.settings-button {
  flex: 0 0 auto;
}

.primary-button:active,
.clear-button:active,
.remove-button:active,
.settings-button:active,
.dialog-secondary:active,
.dialog-danger:active {
  opacity: 0.82;
}

.primary-button.busy,
.primary-button[disabled] {
  opacity: 0.68;
}

.dialog-title,
.dialog-subtitle {
  display: block;
}

.dialog-subtitle {
  margin-top: 18rpx;
}

.dialog-copy {
  padding-right: 8rpx;
}

@media screen and (max-width: 430px) {
  .summary-card,
  .section-head,
  .scan-status-card {
    align-items: stretch;
    flex-direction: column;
  }

  .primary-button,
  .clear-button,
  .settings-button {
    align-self: flex-start;
  }

  .file-meta {
    align-items: flex-start;
    flex-direction: column;
    gap: 12rpx;
    padding-left: 14rpx;
  }
}
</style>
