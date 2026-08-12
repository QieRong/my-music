<template>
  <PageShell show-mini-player>
    <view class="mine-page">
      <view class="page-head">
        <text class="eyebrow">LOCAL CONSOLE</text>
        <text class="page-title">{{ t('nav.mine') }}</text>
        <text class="page-desc">{{ t('mine.desc') }}</text>
      </view>

      <view class="status-grid">
        <view v-for="item in statusItems" :key="item.label" class="status-card">
          <text class="status-label">{{ item.label }}</text>
          <text class="status-value">{{ item.value }}</text>
        </view>
      </view>

      <view class="section">
        <text class="section-title">{{ t('mine.controls') }}</text>
        <view class="action-list">
          <view class="action-row" @tap="goToRoute(ROUTES.SETTINGS)">
            <view>
              <text class="action-title">{{ t('nav.settings') }}</text>
              <text class="action-desc">{{ t('mine.settingsDesc') }}</text>
            </view>
            <text class="action-mark">SET</text>
          </view>

          <view class="action-row" @tap="goToRoute(ROUTES.DOWNLOADS)">
            <view>
              <text class="action-title">{{ t('nav.downloads') }}</text>
              <text class="action-desc">{{ t('mine.downloadsDesc') }}</text>
            </view>
            <text class="action-mark">0</text>
          </view>

          <view class="action-row" @tap="showDisclaimer">
            <view>
              <text class="action-title">{{ t('mine.disclaimer') }}</text>
              <text class="action-desc">{{ t('mine.disclaimerDesc') }}</text>
            </view>
            <text class="action-mark">DOC</text>
          </view>
        </view>
      </view>

      <view class="section">
        <text class="section-title">{{ t('mine.sourceSummary') }}</text>
        <view class="info-card">
          <text class="info-title">{{ sourceSummary }}</text>
          <text class="info-copy">{{ t('mine.sourceDescPhase4') }}</text>
        </view>
      </view>

      <view class="section">
        <text class="section-title">{{ t('mine.privacyTitle') }}</text>
        <view class="info-card">
          <text class="info-title">{{ t('mine.privacyLocal') }}</text>
          <text class="info-copy">{{ t('mine.privacyDesc') }}</text>
        </view>
      </view>
    </view>
  </PageShell>
</template>

<script setup>
import { computed } from 'vue'
import PageShell from '../../components/PageShell.vue'
import { ROUTES, goToRoute } from '../../constants/routes'
import { showDisclaimer } from '../../stores/appStore'
import { enabledSourceCount, sourceCount } from '../../stores/sourceStore'
import { t } from '../../utils/i18n'

function formatMessage(key, params = {}) {
  return Object.keys(params).reduce((message, name) => message.replace(`{${name}}`, params[name]), t(key))
}

const sourceSummary = computed(() => formatMessage('mine.sourceImportedEnabled', {
  imported: sourceCount.value,
  enabled: enabledSourceCount.value
}))

const statusItems = computed(() => [
  { label: t('mine.localMode'), value: t('mine.enabled') },
  { label: t('mine.privacyFirst'), value: t('mine.enabled') },
  { label: t('mine.currentPhase'), value: t('mine.phase4') }
])
</script>

<style scoped>
.mine-page,
.page-head,
.section {
  display: flex;
  flex-direction: column;
}

.mine-page {
  gap: 24rpx;
}

.page-head {
  gap: 12rpx;
}

.eyebrow,
.status-label,
.action-mark {
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
.action-desc,
.info-copy {
  color: #a7adb8;
  font-size: 25rpx;
  line-height: 1.6;
}

.status-grid {
  display: grid;
  gap: 16rpx;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.status-card,
.action-list,
.info-card {
  background: #181818;
  border: 1rpx solid #2a2d33;
  border-radius: 16rpx;
}

.status-card {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  min-height: 120rpx;
  padding: 22rpx;
}

.status-value {
  color: #f5f7fa;
  font-size: 28rpx;
  font-weight: 900;
}

.section {
  gap: 16rpx;
}

.section-title {
  color: #f5f7fa;
  font-size: 32rpx;
  font-weight: 900;
}

.action-list {
  overflow: hidden;
}

.action-row {
  align-items: center;
  border-bottom: 1rpx solid #252932;
  display: flex;
  gap: 18rpx;
  justify-content: space-between;
  min-height: 118rpx;
  padding: 22rpx 24rpx;
}

.action-row:last-child {
  border-bottom: 0;
}

.action-row:active {
  background: #202124;
}

.action-title,
.info-title {
  color: #f5f7fa;
  display: block;
  font-size: 30rpx;
  font-weight: 900;
}

.action-desc {
  display: block;
  margin-top: 8rpx;
}

.action-mark {
  background: #202124;
  border-radius: 999rpx;
  flex: 0 0 auto;
  padding: 10rpx 18rpx;
}

.info-card {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  padding: 26rpx;
}

@media screen and (max-width: 430px) {
  .status-grid {
    grid-template-columns: 1fr;
  }
}
</style>
