<template>
  <PageShell>
    <view class="settings-page">
      <view class="page-head">
        <text class="eyebrow">SETTINGS</text>
        <text class="page-title">{{ t('nav.settings') }}</text>
        <text class="page-desc">{{ t('settings.desc') }}</text>
      </view>

      <view class="setting-card">
        <text class="card-title">{{ t('settings.language') }}</text>
        <text class="card-copy">{{ t('settings.languageDesc') }}</text>
        <view class="locale-grid">
          <button
            v-for="option in LOCALE_OPTIONS"
            :key="option.value"
            class="locale-button"
            :class="{ active: option.value === i18nState.locale }"
            @tap="setLocale(option.value)"
          >
            <text class="locale-name">{{ option.nativeName }}</text>
          </button>
        </view>
      </view>

      <view class="setting-card">
        <text class="card-title">{{ t('nav.source') }}</text>
        <text class="card-copy">{{ t('settings.sourceDescPhase4') }}</text>
        <button class="secondary-button" @tap="goToRoute(ROUTES.SOURCE)">
          {{ t('settings.openSource') }}
        </button>
      </view>

      <view class="setting-card">
        <text class="card-title">{{ t('settings.disclaimer') }}</text>
        <text class="card-copy">
          {{ appState.disclaimerAccepted ? t('settings.disclaimerAccepted') : t('settings.disclaimerNotAccepted') }}
        </text>
        <button class="primary-button" @tap="showDisclaimer">
          {{ t('settings.viewDisclaimer') }}
        </button>
      </view>

      <view class="setting-card">
        <text class="card-title">{{ t('settings.compliance') }}</text>
        <text class="card-copy">{{ t('settings.complianceDesc') }}</text>
      </view>

      <view class="setting-card">
        <text class="card-title">{{ t('settings.storage') }}</text>
        <text class="card-copy">{{ t('settings.storageDesc') }}</text>
      </view>
    </view>
  </PageShell>
</template>

<script setup>
import PageShell from '../../components/PageShell.vue'
import { ROUTES, goToRoute } from '../../constants/routes'
import { appState, showDisclaimer } from '../../stores/appStore'
import { LOCALE_OPTIONS, i18nState, setLocale, t } from '../../utils/i18n'
</script>

<style scoped>
.settings-page,
.page-head,
.setting-card {
  display: flex;
  flex-direction: column;
}

.settings-page {
  gap: 22rpx;
}

.page-head {
  gap: 12rpx;
  margin-bottom: 8rpx;
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

.page-desc,
.card-copy {
  color: #a7adb8;
  font-size: 25rpx;
  line-height: 1.6;
}

.setting-card {
  background: #181818;
  border: 1rpx solid #2a2d33;
  border-radius: 16rpx;
  gap: 16rpx;
  padding: 28rpx;
}

.card-title {
  color: #f5f7fa;
  font-size: 32rpx;
  font-weight: 900;
}

.locale-grid {
  display: grid;
  gap: 12rpx;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.locale-button,
.primary-button,
.secondary-button {
  font-size: 24rpx;
  font-weight: 900;
  min-height: 70rpx;
  padding: 0 24rpx;
}

.locale-button {
  align-items: center;
  background: #202124;
  border: 2rpx solid #2a2d33;
  border-radius: 16rpx;
  box-sizing: border-box;
  color: #a7adb8;
  display: flex;
  justify-content: center;
  line-height: 1.2;
  min-height: 88rpx;
  padding: 0 18rpx;
  width: 100%;
}

.locale-button.active {
  background: #16351f;
  border-color: #1db954;
  box-shadow: inset 0 0 0 1rpx rgba(29, 185, 84, 0.45);
  color: #f5f7fa;
  font-weight: 950;
}

.locale-button:active {
  opacity: 0.82;
}

.locale-name {
  display: block;
  overflow-wrap: anywhere;
  text-align: center;
}

.primary-button,
.secondary-button {
  border-radius: 999rpx;
  line-height: 70rpx;
}

.primary-button {
  background: #1db954;
  color: #08110b;
}

.primary-button,
.secondary-button {
  align-self: flex-start;
}

.secondary-button {
  background: #202124;
  color: #f5f7fa;
}

@media screen and (max-width: 430px) {
  .locale-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
