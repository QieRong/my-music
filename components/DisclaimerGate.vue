<template>
  <BaseDialog
    v-if="appState.disclaimerVisible"
    @contentfits="markRead"
    @scrolltolower="markRead"
  >
    <template #head>
      <text class="gate-title">{{ t('disclaimer.title') }}</text>
      <text class="gate-subtitle">{{ t('disclaimer.subtitle') }}</text>
    </template>

    <view class="gate-content">
      <text class="gate-copy">{{ t('disclaimer.intro') }}</text>

      <view class="gate-section">
        <text class="section-title">{{ t('disclaimer.requiredTitle') }}</text>
        <view class="permission-item">
          <text class="dot">·</text>
          <view>
            <text class="item-title">{{ t('disclaimer.storageTitle') }}</text>
            <text class="item-copy">{{ t('disclaimer.storageCopy') }}</text>
          </view>
        </view>
        <view class="permission-item">
          <text class="dot">·</text>
          <view>
            <text class="item-title">{{ t('disclaimer.networkTitle') }}</text>
            <text class="item-copy">{{ t('disclaimer.networkCopy') }}</text>
          </view>
        </view>
        <view class="permission-item">
          <text class="dot">·</text>
          <view>
            <text class="item-title">{{ t('disclaimer.playSessionTitle') }}</text>
            <text class="item-copy">{{ t('disclaimer.playSessionCopy') }}</text>
          </view>
        </view>
      </view>

      <view class="gate-section">
        <text class="section-title">{{ t('disclaimer.riskTitle') }}</text>
        <text class="gate-copy">{{ t('disclaimer.riskCopy') }}</text>
      </view>

      <view class="gate-section">
        <text class="section-title">{{ t('disclaimer.liabilityTitle') }}</text>
        <text class="gate-copy">{{ t('disclaimer.liabilityCopy') }}</text>
      </view>

      <text class="gate-promise">{{ t('disclaimer.promise') }}</text>
      <text class="gate-copy">{{ t('disclaimer.readHint') }}</text>
    </view>

    <template #actions>
      <button class="decline" @tap="declineDisclaimer">{{ t('disclaimer.decline') }}</button>
      <button
        class="agree"
        :class="{ disabled: !hasReachedEnd }"
        :disabled="!hasReachedEnd"
        @tap="handleAccept"
      >
        {{ hasReachedEnd ? t('disclaimer.accept') : t('disclaimer.scrollToAgree') }}
      </button>
    </template>
  </BaseDialog>

  <BaseDialog v-else-if="appState.disclaimerDeclined && !canUseApp">
    <template #head>
      <text class="gate-title">{{ t('disclaimer.blocked') }}</text>
      <text class="gate-subtitle">{{ t('disclaimer.blockedSubtitle') }}</text>
    </template>

    <view class="gate-content compact">
      <text class="gate-copy">{{ t('disclaimer.blockedCopy') }}</text>
    </view>

    <template #actions>
      <button class="agree" @tap="showDisclaimer">{{ t('disclaimer.reviewAgain') }}</button>
    </template>
  </BaseDialog>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue'
import BaseDialog from './BaseDialog.vue'
import {
  acceptDisclaimer,
  appState,
  canUseApp,
  declineDisclaimer,
  hydrateDisclaimer,
  showDisclaimer
} from '../stores/appStore'
import { t } from '../utils/i18n'

const hasReachedEnd = ref(false)

watch(
  () => appState.disclaimerVisible,
  (visible) => {
    if (visible) {
      hasReachedEnd.value = false
    }
  }
)

function markRead() {
  hasReachedEnd.value = true
}

function handleAccept() {
  if (!hasReachedEnd.value) {
    uni.showToast({
      icon: 'none',
      title: t('disclaimer.scrollToAgree')
    })
    return
  }
  acceptDisclaimer()
}

onMounted(() => {
  hydrateDisclaimer()
})
</script>

<style scoped>
.gate-title {
  color: #f5f7fa;
  display: block;
  font-size: 44rpx;
  font-weight: 900;
  line-height: 1.18;
}

.gate-subtitle {
  color: #1db954;
  display: block;
  font-size: 30rpx;
  font-weight: 900;
  line-height: 1.45;
  margin-top: 34rpx;
}

.gate-content {
  display: flex;
  flex-direction: column;
  gap: 28rpx;
  padding-right: 8rpx;
}

.gate-content.compact {
  gap: 0;
}

.gate-section {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}

.gate-copy,
.item-copy {
  color: #d0d3dc;
  display: block;
  font-size: 27rpx;
  font-weight: 700;
  line-height: 1.58;
}

.section-title,
.item-title {
  color: #f5f7fa;
  display: block;
  font-size: 28rpx;
  font-weight: 900;
  line-height: 1.45;
}

.permission-item {
  display: flex;
  gap: 18rpx;
  padding-left: 8rpx;
}

.dot {
  color: #d0d3dc;
  flex: 0 0 auto;
  font-size: 28rpx;
  font-weight: 900;
  line-height: 1.45;
}

.gate-promise {
  color: #1db954;
  display: block;
  font-size: 27rpx;
  font-weight: 900;
  line-height: 1.58;
}

.agree,
.decline {
  border-radius: 999rpx;
  font-size: 27rpx;
  font-weight: 900;
  line-height: 78rpx;
  min-height: 78rpx;
  padding: 0 34rpx;
}

.agree {
  background: #1db954;
  color: #08110b;
  min-width: 240rpx;
}

.agree.disabled {
  background: #26352c;
  color: #8fb99e;
  pointer-events: none;
}

.decline {
  background: transparent;
  color: #1db954;
}

@media screen and (max-width: 380px) {
  .agree,
  .decline {
    width: 100%;
  }
}
</style>
