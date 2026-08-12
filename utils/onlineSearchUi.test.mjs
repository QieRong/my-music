import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import de from '../locales/de.js'
import en from '../locales/en.js'
import es from '../locales/es.js'
import fr from '../locales/fr.js'
import ja from '../locales/ja.js'
import ko from '../locales/ko.js'
import zhHans from '../locales/zh-Hans.js'
import zhHant from '../locales/zh-Hant.js'

const searchPage = readFileSync(new URL('../pages/search/search.vue', import.meta.url), 'utf8')
const onlineItem = readFileSync(new URL('../components/OnlineSearchResultItem.vue', import.meta.url), 'utf8')
const downloadsPage = readFileSync(new URL('../pages/downloads/downloads.vue', import.meta.url), 'utf8')
const requiredKeys = [
  'search.localScope', 'search.onlineScope', 'search.allScope', 'search.onlineAction',
  'search.onlineConsentTitle', 'search.onlineConsentCopy', 'search.onlineConsentSources',
  'search.onlineConsentConfirm', 'search.onlineResultOnly', 'search.onlineRunning',
  'search.onlineEmpty', 'search.onlinePartialFailure', 'search.onlineAllFailed',
  'search.onlineRetry', 'search.onlineTimeout', 'search.onlineCors',
  'search.onlineInvalidResults', 'search.onlineUnsupported'
  , 'search.onlinePlay', 'search.onlinePlaybackResolving', 'search.onlinePlaybackFailed',
  'search.onlinePlaybackUnavailable', 'search.onlinePlaybackConsentRequired',
  'player.onlinePlaybackHint', 'player.onlineResumeUnavailable', 'player.onlineTrackSelectionHint',
  'search.onlineDownload', 'search.onlineDownloadConsentTitle', 'search.onlineDownloadConsentCopy',
  'search.onlineDownloadConsentSource', 'search.onlineDownloadConsentConfirm', 'search.onlineDownloadUnavailable',
  'search.onlineDownloadConsentRequired', 'search.onlineDownloadStarted', 'search.onlineDownloadFailed',
  'downloads.title', 'downloads.desc', 'downloads.quotaTitle', 'downloads.quotaEstimateUnavailable',
  'downloads.tasksTitle', 'downloads.cachedTitle', 'downloads.emptyTitle', 'downloads.emptyDesc',
  'downloads.cancel', 'downloads.remove', 'downloads.clear', 'downloads.clearTitle', 'downloads.clearCopy',
  'downloads.clearConfirm', 'downloads.statusPreparing', 'downloads.statusResolving', 'downloads.statusDownloading',
  'downloads.statusSaving', 'downloads.statusCompleted', 'downloads.statusFailed', 'downloads.statusTimeout',
  'downloads.statusCancelled'
]

test('在线搜索页使用范围、双确认弹层和显式搜索入口', () => {
  assert.match(searchPage, /prepareOnlineSearch/)
  assert.match(searchPage, /BaseDialog/)
  assert.match(searchPage, /t\('search\.onlineScope'\)/)
  assert.match(searchPage, /@confirm="startOnlineSearch"/)
})

test('切换搜索范围不会清空已经完成的在线结果', () => {
  const selectScope = searchPage.match(/function selectScope\(scope\) \{[\s\S]*?\n\}/)?.[0] || ''
  assert.match(selectScope, /selectedScope\.value = scope/)
  assert.doesNotMatch(selectScope, /clearOnlineSearchResults/)
})

test('在线结果组件只暴露受控操作事件，不包含或渲染播放地址', () => {
  assert.match(onlineItem, /sourceName/)
  assert.match(onlineItem, /onlineResultOnly/)
  assert.match(onlineItem, /defineEmits\(\['play', 'download'\]\)/)
  assert.match(onlineItem, /v-if="canPlay"/)
  assert.match(searchPage, /getEligiblePlaybackSource/)
  assert.match(searchPage, /@play="playOnlineTrack"/)
  assert.doesNotMatch(onlineItem, /result\.url|playUrl|cover/)
})

test('下载入口受音源能力控制，确认弹层与下载页只呈现任务和缓存元数据', () => {
  assert.match(onlineItem, /canDownload/)
  assert.match(onlineItem, /defineEmits\(\['play', 'download'\]\)/)
  assert.match(onlineItem, /v-if="canDownload"/)
  assert.match(searchPage, /getEligibleDownloadSource/)
  assert.match(searchPage, /@download="prepareOnlineDownload"/)
  assert.match(searchPage, /approveAndDownload/)
  assert.match(searchPage, /downloadConsentVisible/)
  assert.match(downloadsPage, /cancelDownload/)
  assert.match(downloadsPage, /removeCachedTrack/)
  assert.match(downloadsPage, /clearCachedTracks/)
  assert.doesNotMatch(onlineItem, /result\.url|downloadUrl/)
  assert.doesNotMatch(downloadsPage, /url|playUrl|content URI/i)
})

test('八种语言都提供在线搜索文案', () => {
  const locales = { de, en, es, fr, ja, ko, 'zh-Hans': zhHans, 'zh-Hant': zhHant }
  for (const [locale, messages] of Object.entries(locales)) {
    for (const key of requiredKeys) {
      assert.equal(typeof messages[key], 'string', `${locale} missing ${key}`)
    }
  }
})
