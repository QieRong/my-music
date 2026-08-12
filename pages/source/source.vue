<template>
  <PageShell show-mini-player>
    <view class="source-page">
      <view class="page-head">
        <text class="eyebrow">{{ t('nav.source') }}</text>
        <text class="page-title">{{ t('source.title') }}</text>
        <text class="page-desc">{{ t('source.descPhase4') }}</text>
      </view>

      <view class="summary-card">
        <view>
          <text class="summary-label">{{ t('source.summary') }}</text>
          <text class="summary-value">{{ sourceSummary }}</text>
        </view>
        <button class="primary-button" @tap="openImportRisk">
          {{ t('source.importAction') }}
        </button>
      </view>

      <EmptyState
        v-if="!sourceState.items.length"
        mark="SRC"
        :title="t('source.emptyTitle')"
        :description="t('source.emptyDesc')"
        :action-text="t('source.importAction')"
        @action="openImportRisk"
      />

      <view v-else class="source-list">
        <view v-for="source in sourceState.items" :key="source.id" class="source-card">
          <view class="source-card-head">
            <view class="source-name-wrap">
              <text class="source-name">{{ source.name }}</text>
              <text class="source-version">{{ source.version }}</text>
            </view>
            <text class="status-badge" :class="{ enabled: source.enabled }">
              {{ t(source.enabled ? 'source.enabled' : 'source.disabled') }}
            </text>
          </view>
          <text class="source-author">{{ source.author }}</text>
          <text class="source-description">{{ source.description }}</text>
          <view class="capability-list">
            <text v-for="capability in source.capabilities" :key="capability" class="capability-tag">
              {{ capability }}
            </text>
          </view>
          <text class="source-time">{{ formatMessage('source.importedAt', { time: formatImportedAt(source.importedAt) }) }}</text>
          <view class="source-actions">
            <button class="secondary-button" @tap="detailSource = source">
              {{ t('source.metadata') }}
            </button>
            <button class="secondary-button" @tap="toggleSource(source)">
              {{ t(source.enabled ? 'source.disable' : 'source.enable') }}
            </button>
            <button class="danger-button" @tap="removeTarget = source">
              {{ t('source.remove') }}
            </button>
          </view>
        </view>
      </view>
    </view>

    <BaseDialog v-if="riskVisible">
      <template #head>
        <text class="dialog-title">{{ t('source.riskTitle') }}</text>
        <text class="dialog-subtitle">{{ t('source.riskCopy') }}</text>
      </template>
      <view class="dialog-copy">
        <text>{{ t('source.riskLimitPhase4') }}</text>
      </view>
      <template #actions>
        <button class="dialog-secondary" @tap="riskVisible = false">{{ t('common.cancel') }}</button>
        <button class="dialog-primary" @tap="chooseSourceScript">{{ t('source.confirmImport') }}</button>
      </template>
    </BaseDialog>

    <BaseDialog v-if="duplicateVisible">
      <template #head>
        <text class="dialog-title">{{ t('source.duplicateTitle') }}</text>
        <text class="dialog-subtitle">{{ t('source.duplicateCopy') }}</text>
      </template>
      <template #actions>
        <button class="dialog-secondary" @tap="cancelPreparedImport">{{ t('common.cancel') }}</button>
        <button class="dialog-primary" @tap="savePreparedImport(true)">{{ t('source.confirmReplace') }}</button>
      </template>
    </BaseDialog>

    <BaseDialog v-if="detailSource">
      <template #head>
        <text class="dialog-title">{{ t('source.metadata') }}</text>
        <text class="dialog-subtitle">{{ detailSource.name }}</text>
      </template>
      <view class="metadata-list">
        <view class="metadata-row"><text>{{ t('source.author') }}</text><text>{{ detailSource.author }}</text></view>
        <view class="metadata-row"><text>{{ t('source.version') }}</text><text>{{ detailSource.version }}</text></view>
        <view class="metadata-row"><text>{{ t('source.capabilities') }}</text><text>{{ detailSource.capabilities.join(', ') }}</text></view>
        <view v-if="detailSource.homepage" class="metadata-row"><text>{{ t('source.homepage') }}</text><text>{{ detailSource.homepage }}</text></view>
      </view>
      <template #actions>
        <button class="dialog-secondary" @tap="detailSource = null">{{ t('common.close') }}</button>
      </template>
    </BaseDialog>

    <BaseDialog v-if="removeTarget">
      <template #head>
        <text class="dialog-title">{{ t('source.removeTitle') }}</text>
        <text class="dialog-subtitle">{{ t('source.removeCopy') }}</text>
      </template>
      <template #actions>
        <button class="dialog-secondary" @tap="removeTarget = null">{{ t('common.cancel') }}</button>
        <button class="dialog-danger" @tap="confirmRemove">{{ t('source.confirmRemove') }}</button>
      </template>
    </BaseDialog>
  </PageShell>
</template>

<script setup>
import { computed, ref } from 'vue'
import BaseDialog from '../../components/BaseDialog.vue'
import EmptyState from '../../components/EmptyState.vue'
import PageShell from '../../components/PageShell.vue'
import {
  enabledSourceCount,
  hydrateSources,
  prepareSourceImport,
  removeSource,
  savePreparedSource,
  setSourceEnabled,
  sourceCount,
  sourceState
} from '../../stores/sourceStore'
import { readSourceScriptText, requestSourceScriptFile } from '../../utils/sourceFilePicker'
import { t } from '../../utils/i18n'

hydrateSources()

const riskVisible = ref(false)
const duplicateVisible = ref(false)
const detailSource = ref(null)
const removeTarget = ref(null)
const pendingSource = ref(null)

const sourceSummary = computed(() => formatMessage('source.summaryValue', {
  imported: sourceCount.value,
  enabled: enabledSourceCount.value
}))

function formatMessage(key, params = {}) {
  return Object.keys(params).reduce((message, name) => message.replace(`{${name}}`, params[name]), t(key))
}

function formatImportedAt(timestamp) {
  return new Date(timestamp).toLocaleDateString()
}

function showToast(key) {
  if (typeof uni !== 'undefined' && typeof uni.showToast === 'function') {
    uni.showToast({ icon: 'none', title: t(key) })
  }
}

function openImportRisk() {
  riskVisible.value = true
}

function getImportErrorKey(error) {
  if (error?.code === 'SOURCE_PICK_UNSUPPORTED') return 'source.pickUnsupported'
  if (error?.code === 'SOURCE_PICK_FAILED') return 'source.pickFailed'
  if (error?.code === 'SOURCE_READ_FAILED') return 'source.readFailed'
  return 'source.invalidDefinition'
}

async function chooseSourceScript() {
  try {
    const result = await requestSourceScriptFile()
    riskVisible.value = false
    if (result.cancelled) return

    pendingSource.value = prepareSourceImport(await readSourceScriptText(result.file))
    const exists = sourceState.items.some((source) => source.id === pendingSource.value.id)
    if (exists) {
      duplicateVisible.value = true
      return
    }
    savePreparedImport(false)
  } catch (error) {
    riskVisible.value = false
    showToast(getImportErrorKey(error))
  }
}

function cancelPreparedImport() {
  duplicateVisible.value = false
  pendingSource.value = null
}

function savePreparedImport(replace) {
  if (!pendingSource.value) return
  const result = savePreparedSource(pendingSource.value, { replace })
  pendingSource.value = null
  duplicateVisible.value = false
  if (result.persistenceFailed || result.consentPersistenceFailed) {
    showToast('source.persistenceFailed')
    return
  }
  showToast(result.status === 'updated' ? 'source.updateSuccess' : 'source.importSuccess')
}

function toggleSource(source) {
  const result = setSourceEnabled(source.id, !source.enabled)
  if (!result) return
  showToast(result.persistenceFailed ? 'source.persistenceFailed' : (result.enabled ? 'source.enabled' : 'source.disabled'))
}

function confirmRemove() {
  const result = removeSource(removeTarget.value?.id)
  removeTarget.value = null
  if (!result.removed) return
  showToast(result.persistenceFailed || result.consentPersistenceFailed ? 'source.persistenceFailed' : 'source.removeSuccess')
}
</script>

<style scoped>
.source-page,
.page-head,
.source-list,
.source-card,
.source-name-wrap,
.capability-list,
.source-actions {
  display: flex;
  flex-direction: column;
}

.source-page,
.source-list {
  gap: 24rpx;
}

.page-head,
.source-card,
.source-name-wrap {
  gap: 12rpx;
}

.eyebrow,
.summary-label,
.source-version {
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
.source-author,
.source-description,
.source-time,
.dialog-subtitle,
.dialog-copy,
.metadata-row {
  color: #a7adb8;
  font-size: 25rpx;
  line-height: 1.6;
}

.summary-card,
.source-card {
  background: #181818;
  border: 1rpx solid #2a2d33;
  border-radius: 16rpx;
}

.summary-card,
.source-card-head,
.metadata-row {
  align-items: center;
  display: flex;
  justify-content: space-between;
}

.summary-card {
  gap: 22rpx;
  padding: 26rpx;
}

.summary-value,
.source-name,
.dialog-title {
  color: #f5f7fa;
  display: block;
  font-weight: 900;
}

.summary-value {
  font-size: 38rpx;
  margin-top: 10rpx;
}

.source-card {
  padding: 26rpx;
}

.source-card-head {
  align-items: flex-start;
  gap: 16rpx;
}

.source-name {
  font-size: 32rpx;
}

.source-description {
  overflow-wrap: anywhere;
}

.status-badge,
.capability-tag {
  background: #202124;
  border: 1rpx solid #30343d;
  border-radius: 999rpx;
  color: #a7adb8;
  font-size: 21rpx;
  font-weight: 800;
  padding: 8rpx 14rpx;
}

.status-badge.enabled {
  background: #16351f;
  border-color: #1db954;
  color: #d5f4df;
}

.capability-list {
  flex-direction: row;
  flex-wrap: wrap;
  gap: 10rpx;
}

.source-time {
  color: #6b7280;
}

.source-actions {
  flex-direction: row;
  flex-wrap: wrap;
  gap: 14rpx;
}

.primary-button,
.secondary-button,
.danger-button,
.dialog-primary,
.dialog-secondary,
.dialog-danger {
  border-radius: 999rpx;
  font-size: 24rpx;
  font-weight: 900;
  line-height: 88rpx;
  min-height: 88rpx;
  padding: 0 28rpx;
}

.primary-button,
.dialog-primary {
  background: #1db954;
  color: #08110b;
}

.secondary-button,
.dialog-secondary {
  background: #202124;
  color: #f5f7fa;
}

.danger-button,
.dialog-danger {
  background: #3a2223;
  color: #ffd7d5;
}

.dialog-title {
  font-size: 32rpx;
}

.dialog-subtitle {
  display: block;
  margin-top: 18rpx;
}

.dialog-copy {
  padding-right: 8rpx;
}

.metadata-list {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}

.metadata-row {
  align-items: flex-start;
  border-bottom: 1rpx solid #252932;
  gap: 22rpx;
  padding-bottom: 14rpx;
}

.metadata-row text:last-child {
  color: #f5f7fa;
  max-width: 62%;
  overflow-wrap: anywhere;
  text-align: right;
}

@media screen and (max-width: 430px) {
  .summary-card {
    align-items: stretch;
    flex-direction: column;
  }

  .primary-button {
    align-self: flex-start;
  }
}
</style>
