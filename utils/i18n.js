import { reactive } from 'vue'
import zhHans from '../locales/zh-Hans.js'
import zhHant from '../locales/zh-Hant.js'
import en from '../locales/en.js'
import ja from '../locales/ja.js'
import ko from '../locales/ko.js'
import de from '../locales/de.js'
import fr from '../locales/fr.js'
import es from '../locales/es.js'

export const DEFAULT_LOCALE = 'zh-Hans'
export const LOCALE_STORAGE_KEY = 'MUSIC_SHELL_LOCALE'

export const LOCALE_OPTIONS = [
  { value: 'zh-Hans', nativeName: '简体中文' },
  { value: 'zh-Hant', nativeName: '繁體中文' },
  { value: 'en', nativeName: 'English' },
  { value: 'ja', nativeName: '日本語' },
  { value: 'ko', nativeName: '한국어' },
  { value: 'de', nativeName: 'Deutsch' },
  { value: 'fr', nativeName: 'Français' },
  { value: 'es', nativeName: 'Español' }
]

const messages = {
  'zh-Hans': zhHans,
  'zh-Hant': zhHant,
  en,
  ja,
  ko,
  de,
  fr,
  es
}

export const SUPPORTED_LOCALES = LOCALE_OPTIONS.map((option) => option.value)

export const i18nState = reactive({
  locale: DEFAULT_LOCALE,
  hydrated: false
})

function canUseUniStorage() {
  return typeof uni !== 'undefined'
    && typeof uni.getStorageSync === 'function'
    && typeof uni.setStorageSync === 'function'
}

function normalizeLocale(locale) {
  return SUPPORTED_LOCALES.includes(locale) ? locale : DEFAULT_LOCALE
}

export function hydrateLocale() {
  if (i18nState.hydrated) {
    return
  }

  if (canUseUniStorage()) {
    try {
      i18nState.locale = normalizeLocale(uni.getStorageSync(LOCALE_STORAGE_KEY))
    } catch (error) {
      i18nState.locale = DEFAULT_LOCALE
    }
  }

  i18nState.hydrated = true
}

export function setLocale(locale) {
  const nextLocale = normalizeLocale(locale)
  i18nState.locale = nextLocale
  i18nState.hydrated = true

  if (canUseUniStorage()) {
    try {
      uni.setStorageSync(LOCALE_STORAGE_KEY, nextLocale)
    } catch (error) {
      // 存储失败时只影响持久化，不影响当前会话语言。
    }
  }
}

export function t(key) {
  const currentMessages = messages[i18nState.locale] || {}
  const fallbackMessages = messages[DEFAULT_LOCALE] || {}

  if (Object.prototype.hasOwnProperty.call(currentMessages, key)) {
    return currentMessages[key]
  }

  if (Object.prototype.hasOwnProperty.call(fallbackMessages, key)) {
    return fallbackMessages[key]
  }

  return key
}
