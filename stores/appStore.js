import { computed, reactive } from 'vue'

export const DISCLAIMER_KEY = 'musicShellUniDisclaimerAccepted'
export const DISCLAIMER_VERSION_KEY = 'musicShellUniDisclaimerVersion'
export const DISCLAIMER_VERSION = '2026-05-phase-2-local-index-notice'

export const appState = reactive({
  hydrated: false,
  disclaimerAccepted: false,
  disclaimerVisible: false,
  disclaimerDeclined: false
})

export const canUseApp = computed(() => appState.disclaimerAccepted)

export function hydrateDisclaimer() {
  if (appState.hydrated) {
    return
  }

  try {
    const accepted = uni.getStorageSync(DISCLAIMER_KEY)
    const version = uni.getStorageSync(DISCLAIMER_VERSION_KEY)
    appState.disclaimerAccepted = accepted === true && version === DISCLAIMER_VERSION
    appState.disclaimerVisible = !appState.disclaimerAccepted
  } catch (error) {
    appState.disclaimerAccepted = false
    appState.disclaimerVisible = true
  }

  appState.hydrated = true
}

export function showDisclaimer() {
  appState.disclaimerDeclined = false
  appState.disclaimerVisible = true
}

export function acceptDisclaimer() {
  try {
    uni.setStorageSync(DISCLAIMER_KEY, true)
    uni.setStorageSync(DISCLAIMER_VERSION_KEY, DISCLAIMER_VERSION)
  } catch (error) {
    // H5 private browsing can reject storage. Keep the session usable anyway.
  }

  appState.disclaimerAccepted = true
  appState.disclaimerDeclined = false
  appState.disclaimerVisible = false
  appState.hydrated = true
}

export function declineDisclaimer() {
  appState.disclaimerAccepted = false
  appState.disclaimerDeclined = true
  appState.disclaimerVisible = false
  appState.hydrated = true
}
