<template>
  <PageShell show-mini-player>
    <view class="search-page">
      <view class="page-head">
        <text class="eyebrow">LOCAL SEARCH</text>
        <text class="page-title">{{ t('nav.search') }}</text>
        <text class="page-desc">{{ t('search.phaseFourDesc') }}</text>
      </view>

      <view class="scan-card">
        <view class="scan-copy">
          <text class="scan-title">{{ t('library.importTitle') }}</text>
          <text class="scan-desc">{{ t('library.importNote') }}</text>
        </view>
        <button class="scan-button" :disabled="isScanning" :class="{ busy: isScanning }" @tap="scanLocalMusic">
          {{ isScanning ? t('library.scanStatusScanning') : t('library.importAction') }}
        </button>
      </view>

      <view class="scan-status-card" :class="{ alert: scanNeedsAttention }">
        <text>{{ scanStatusText }}</text>
        <button v-if="canOpenScanSettings" class="settings-button" @tap="openScanSettings">
          {{ t('library.openPermissionSettings') }}
        </button>
      </view>

      <view class="search-shell">
        <input
          v-model="keyword"
          class="search-input"
          confirm-type="search"
          :placeholder="t('search.placeholder')"
          @confirm="startOnlineSearch"
        />
        <button v-if="onlineScopeAvailable && selectedScope !== 'local'" class="online-search-button" @tap="startOnlineSearch">
          {{ t('search.onlineAction') }}
        </button>
      </view>

      <view v-if="onlineScopeAvailable" class="scope-switch" role="tablist">
        <button
          v-for="scope in availableScopes"
          :key="scope"
          class="scope-button"
          :class="{ active: selectedScope === scope }"
          @tap="selectScope(scope)"
        >
          {{ t(`search.${scope}Scope`) }}
        </button>
      </view>

      <view class="scope-note">
        <text>{{ selectedScope === 'local' ? t('search.localIndexOnly') : t('search.onlineScopeNote') }}</text>
      </view>

      <view v-if="showLocalResults" class="section-head">
        <text class="section-title">{{ resultTitle }}</text>
        <text class="section-note">{{ filteredTracks.length }} / {{ libraryState.tracks.length }}</text>
      </view>

      <view v-if="showLocalResults && filteredTracks.length" class="list-card">
        <SongListItem
          v-for="track in filteredTracks"
          :key="track.id"
          :track="track"
          :active="track.id === playerState.currentTrackId"
          @select="playTrack(track.id)"
        />
      </view>

      <EmptyState
        v-else-if="showLocalResults && !libraryState.tracks.length"
        mark="0"
        :title="t('library.emptyTitle')"
        :description="t('library.emptyDesc')"
        :action-text="t('library.importAction')"
        @action="scanLocalMusic"
      />

      <EmptyState
        v-else-if="showLocalResults"
        mark="0"
        :title="t('search.emptyTitle')"
        :description="t('search.emptyDesc')"
      />

      <view v-if="showOnlineResults" class="online-section">
        <view class="section-head">
          <text class="section-title">{{ t('search.onlineScope') }}</text>
          <text v-if="onlineSearchState.status === 'running'" class="section-note">{{ t('search.onlineRunning') }}</text>
        </view>

        <view v-for="group in onlineSearchState.sourceGroups" :key="group.sourceId" class="online-group">
          <view class="online-group-head">
            <text class="online-group-name">{{ group.sourceName }}</text>
            <text class="online-group-status" :class="group.status">{{ getGroupStatusText(group) }}</text>
          </view>
          <view v-if="group.results.length" class="list-card">
            <OnlineSearchResultItem
              v-for="result in group.results"
              :key="result.id"
              :result="result"
              :can-play="Boolean(getEligiblePlaybackSource(result, sourceState.items))"
              :can-download="Boolean(getEligibleDownloadSource(result, sourceState.items))"
              :playback-status="onlinePlaybackState.activeTrackId === result.id ? onlinePlaybackState.status : 'idle'"
              @play="playOnlineTrack"
              @download="prepareOnlineDownload"
            />
          </view>
          <text v-else class="online-group-empty">{{ getGroupStatusText(group) }}</text>
          <text v-if="group.invalidCount" class="online-group-empty">{{ formatMessage('search.onlineInvalidResults', { count: group.invalidCount }) }}</text>
        </view>

        <view v-if="onlineSearchState.status === 'running'" class="online-state-card">
          <text>{{ t('search.onlineRunning') }}</text>
        </view>
        <view v-else-if="onlineSearchState.status === 'empty' && onlineSearchState.sourceGroups.length" class="online-state-card">
          <text>{{ t('search.onlineEmpty') }}</text>
        </view>
        <view v-else-if="onlineSearchState.status === 'failed'" class="online-state-card alert">
          <text>{{ t('search.onlineAllFailed') }}</text>
          <button class="retry-button" @tap="retryOnlineSearch">{{ t('search.onlineRetry') }}</button>
        </view>
        <view v-else-if="onlineSearchState.status === 'partial'" class="online-state-card alert">
          <text>{{ t('search.onlinePartialFailure') }}</text>
          <button class="retry-button" @tap="retryOnlineSearch">{{ t('search.onlineRetry') }}</button>
        </view>
      </view>
    </view>

    <BaseDialog v-if="consentVisible">
      <template #head>
        <text class="dialog-title">{{ t('search.onlineConsentTitle') }}</text>
        <text class="dialog-subtitle">{{ t('search.onlineConsentCopy') }}</text>
      </template>
      <view class="consent-source-list">
        <text class="consent-source-label">{{ t('search.onlineConsentSources') }}</text>
        <text v-for="source in onlineSearchState.pendingConsentSources" :key="source.id" class="consent-source-item">
          {{ source.name }} · {{ source.version }}
        </text>
      </view>
      <template #actions>
        <button class="dialog-secondary" @tap="cancelOnlineConsent">{{ t('common.cancel') }}</button>
        <button class="dialog-primary" @tap="approveOnlineConsent">{{ t('search.onlineConsentConfirm') }}</button>
      </template>
    </BaseDialog>

    <BaseDialog v-if="downloadConsentVisible">
      <template #head>
        <text class="dialog-title">{{ t('search.onlineDownloadConsentTitle') }}</text>
        <text class="dialog-subtitle">{{ t('search.onlineDownloadConsentCopy') }}</text>
      </template>
      <view class="consent-source-list">
        <text class="consent-source-label">{{ t('search.onlineDownloadConsentSource') }}</text>
        <text class="consent-source-item">{{ downloadState.pending?.source?.name }} · {{ downloadState.pending?.result?.title }}</text>
      </view>
      <template #actions>
        <button class="dialog-secondary" @tap="cancelOnlineDownload">{{ t('common.cancel') }}</button>
        <button class="dialog-primary" :disabled="downloadConfirming" @tap="approveOnlineDownload">{{ t('search.onlineDownloadConsentConfirm') }}</button>
      </template>
    </BaseDialog>
  </PageShell>
</template>

<script setup>
import { computed, ref } from 'vue'
import BaseDialog from '../../components/BaseDialog.vue'
import EmptyState from '../../components/EmptyState.vue'
import OnlineSearchResultItem from '../../components/OnlineSearchResultItem.vue'
import PageShell from '../../components/PageShell.vue'
import SongListItem from '../../components/SongListItem.vue'
import {
  importLocalScanResult,
  libraryState,
  hydrateLibrary,
  updateScanMeta
} from '../../stores/libraryStore'
import { canUseApp } from '../../stores/appStore'
import {
  LOCAL_SCAN_STATUSES,
  openLocalMusicScanSettings,
  requestLocalMusicScan
} from '../../utils/localMusicScanner'
import { playTrack, playerState } from '../../stores/playerStore'
import {
  getEligiblePlaybackSource,
  onlinePlaybackState,
  playOnlineResult as startOnlinePlayback
} from '../../stores/onlinePlaybackStore'
import {
  approveAndDownload,
  downloadState,
  getEligibleDownloadSource,
  prepareDownload
} from '../../stores/downloadStore'
import { sourceState, hydrateSources } from '../../stores/sourceStore'
import {
  cancelOnlineSearch,
  getEligibleSearchSources,
  onlineSearchState,
  prepareOnlineSearch,
  approveAndSearch,
  retryOnlineSearch as retrySearch
} from '../../stores/onlineSearchStore'
import { t } from '../../utils/i18n'

hydrateLibrary()
hydrateSources()

const keyword = ref('')
const isScanning = ref(false)
const selectedScope = ref('local')

const normalizedKeyword = computed(() => keyword.value.trim().toLowerCase())
const filteredTracks = computed(() => {
  if (!normalizedKeyword.value) {
    return libraryState.tracks
  }

  return libraryState.tracks.filter((track) => {
    return [track.title, track.fileName]
      .some((field) => String(field || '').toLowerCase().includes(normalizedKeyword.value))
  })
})

const resultTitle = computed(() => normalizedKeyword.value ? t('search.results') : t('search.allIndexed'))
const onlineScopeAvailable = computed(() => getEligibleSearchSources(sourceState.items).length > 0)
const availableScopes = ['local', 'online', 'all']
const showLocalResults = computed(() => selectedScope.value !== 'online')
const showOnlineResults = computed(() => selectedScope.value !== 'local' && onlineScopeAvailable.value)
const consentVisible = computed(() => onlineSearchState.status === 'requires_consent')
const downloadConsentVisible = computed(() => Boolean(downloadState.pending))
const downloadConfirming = ref(false)
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

function selectScope(scope) {
  if (!availableScopes.includes(scope)) return
  selectedScope.value = scope
}

async function startOnlineSearch() {
  if (selectedScope.value === 'local') return
  const result = await prepareOnlineSearch(keyword.value, sourceState.items)
  if (result.status === 'empty_keyword') {
    uni.showToast({ icon: 'none', title: t('search.placeholder') })
  }
}

async function approveOnlineConsent() {
  const result = await approveAndSearch()
  if (result.persistenceFailed) {
    uni.showToast({ icon: 'none', title: t('source.persistenceFailed') })
  }
}

function cancelOnlineConsent() {
  cancelOnlineSearch()
}

async function retryOnlineSearch() {
  await retrySearch()
}

async function playOnlineTrack(result) {
  const playback = await startOnlinePlayback(result, sourceState.items)
  if (playback.status === 'playing' || playback.status === 'cancelled') {
    return
  }
  if (playback.errorCode === 'PLAY_UNAVAILABLE') {
    uni.showToast({ icon: 'none', title: t('search.onlinePlaybackUnavailable') })
    return
  }
  if (playback.errorCode === 'CONSENT_REQUIRED') {
    uni.showToast({ icon: 'none', title: t('search.onlinePlaybackConsentRequired') })
    return
  }
  uni.showToast({ icon: 'none', title: t('search.onlinePlaybackFailed') })
}

async function prepareOnlineDownload(result) {
  const prepared = await prepareDownload(result, sourceState.items)
  if (prepared.status === 'requires_copyright_confirmation') {
    return
  }
  const key = prepared.errorCode === 'CONSENT_REQUIRED'
    ? 'search.onlineDownloadConsentRequired'
    : 'search.onlineDownloadUnavailable'
  uni.showToast({ icon: 'none', title: t(key) })
}

async function approveOnlineDownload() {
  if (downloadConfirming.value) {
    return
  }
  downloadConfirming.value = true
  try {
    const downloaded = await approveAndDownload()
    if (downloaded.status === 'completed') {
      uni.showToast({ icon: 'none', title: t('search.onlineDownloadStarted') })
      return
    }
    if (downloaded.status === 'cancelled') {
      return
    }
    uni.showToast({ icon: 'none', title: t('search.onlineDownloadFailed') })
  } finally {
    downloadConfirming.value = false
  }
}

function cancelOnlineDownload() {
  downloadState.pending = null
}

function getGroupStatusText(group) {
  if (group.status === 'success') return ''
  if (group.status === 'empty') return t('search.onlineEmpty')
  if (group.status === 'timeout') return t('search.onlineTimeout')
  if (group.errorCode === 'CORS_OR_NETWORK') return t('search.onlineCors')
  if (group.errorCode === 'UNSUPPORTED_RUNTIME') return t('search.onlineUnsupported')
  if (group.errorCode === 'INVALID_RESULT') return t('search.onlineInvalidResults')
  return t('search.onlineAllFailed')
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

async function openScanSettings() {
  const opened = await openLocalMusicScanSettings()
  if (!opened) {
    uni.showToast({ icon: 'none', title: t('library.openSettingsFailed') })
  }
}
</script>

<style scoped>
.search-page,
.page-head {
  display: flex;
  flex-direction: column;
}

.search-page {
  gap: 22rpx;
}

.page-head {
  gap: 12rpx;
}

.eyebrow,
.section-note {
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
.scope-note,
.scan-desc,
.scan-status-card {
  color: #a7adb8;
  font-size: 25rpx;
  line-height: 1.6;
}

.scan-card {
  align-items: center;
  background: #181818;
  border: 1rpx solid #2a2d33;
  border-radius: 16rpx;
  display: flex;
  gap: 22rpx;
  justify-content: space-between;
  padding: 24rpx;
}

.scan-copy {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 10rpx;
  min-width: 0;
}

.scan-title {
  color: #f5f7fa;
  font-size: 31rpx;
  font-weight: 900;
}

.scan-button {
  background: #1db954;
  border-radius: 999rpx;
  color: #08110b;
  flex: 0 0 auto;
  font-size: 24rpx;
  font-weight: 900;
  line-height: 70rpx;
  min-height: 70rpx;
  padding: 0 28rpx;
}

.scan-button:active {
  opacity: 0.82;
}

.scan-button.busy,
.scan-button[disabled] {
  opacity: 0.68;
}

.search-shell {
  align-items: center;
  background: #181818;
  border: 1rpx solid #2a2d33;
  border-radius: 999rpx;
  display: flex;
  min-height: 84rpx;
  padding: 0 28rpx;
}

.search-input {
  color: #f5f7fa;
  flex: 1;
  font-size: 28rpx;
  min-height: 84rpx;
}

.online-search-button,
.scope-button,
.retry-button,
.dialog-primary,
.dialog-secondary {
  border-radius: 999rpx;
  font-size: 22rpx;
  font-weight: 900;
}

.online-search-button {
  background: #1db954;
  color: #08110b;
  flex: 0 0 auto;
  line-height: 62rpx;
  min-height: 62rpx;
  padding: 0 20rpx;
}

.scope-switch {
  background: #101317;
  border: 1rpx solid #242832;
  border-radius: 14rpx;
  display: flex;
  gap: 12rpx;
  padding: 12rpx;
}

.scope-button {
  background: transparent;
  color: #a7adb8;
  flex: 1;
  line-height: 62rpx;
  min-height: 62rpx;
  padding: 0 12rpx;
}

.scope-button.active {
  background: #1db954;
  color: #08110b;
}

.scope-note {
  background: #101317;
  border: 1rpx solid #242832;
  border-radius: 14rpx;
  padding: 20rpx 24rpx;
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

.settings-button {
  background: #202124;
  border-radius: 999rpx;
  color: #f5f7fa;
  flex: 0 0 auto;
  font-size: 23rpx;
  font-weight: 900;
  line-height: 58rpx;
  min-height: 58rpx;
  padding: 0 22rpx;
}

.settings-button:active {
  opacity: 0.82;
}

.section-head {
  align-items: center;
  display: flex;
  justify-content: space-between;
}

.online-section,
.online-group,
.consent-source-list {
  display: flex;
  flex-direction: column;
}

.online-section {
  gap: 16rpx;
}

.online-group {
  background: #101317;
  border: 1rpx solid #242832;
  border-radius: 16rpx;
  gap: 12rpx;
  padding: 18rpx;
}

.online-group-head {
  align-items: center;
  display: flex;
  gap: 16rpx;
  justify-content: space-between;
}

.online-group-name,
.dialog-title {
  color: #f5f7fa;
  font-size: 27rpx;
  font-weight: 900;
}

.online-group-status,
.online-group-empty,
.dialog-subtitle,
.consent-source-label,
.consent-source-item,
.online-state-card {
  color: #a7adb8;
  font-size: 23rpx;
  line-height: 1.55;
}

.online-group-status.timeout,
.online-group-status.failed,
.online-state-card.alert {
  color: #f2c46d;
}

.online-state-card {
  align-items: center;
  background: #101317;
  border: 1rpx solid #242832;
  border-radius: 14rpx;
  display: flex;
  gap: 16rpx;
  justify-content: space-between;
  padding: 18rpx 22rpx;
}

.retry-button {
  background: #202124;
  color: #f5f7fa;
  flex: 0 0 auto;
  line-height: 58rpx;
  min-height: 58rpx;
  padding: 0 20rpx;
}

.dialog-title,
.dialog-subtitle {
  display: block;
}

.dialog-subtitle {
  margin-top: 16rpx;
}

.consent-source-list {
  gap: 12rpx;
}

.consent-source-item {
  background: #202124;
  border-radius: 10rpx;
  color: #f5f7fa;
  padding: 14rpx 16rpx;
}

.dialog-primary,
.dialog-secondary {
  line-height: 80rpx;
  min-height: 80rpx;
  padding: 0 24rpx;
}

.dialog-primary {
  background: #1db954;
  color: #08110b;
}

.dialog-secondary {
  background: #202124;
  color: #f5f7fa;
}

.section-title {
  color: #f5f7fa;
  font-size: 34rpx;
  font-weight: 900;
}

.list-card {
  background: #181818;
  border: 1rpx solid #2a2d33;
  border-radius: 16rpx;
  padding: 10rpx;
}

@media screen and (max-width: 430px) {
  .scan-card {
    align-items: stretch;
    flex-direction: column;
  }

  .scan-status-card {
    align-items: stretch;
    flex-direction: column;
  }

  .scan-button {
    align-self: flex-start;
  }

  .settings-button {
    align-self: flex-start;
  }

  .online-state-card {
    align-items: stretch;
    flex-direction: column;
  }

  .retry-button {
    align-self: flex-start;
  }
}
</style>
