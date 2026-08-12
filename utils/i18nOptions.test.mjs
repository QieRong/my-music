import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const i18nSource = readFileSync(new URL('./i18n.js', import.meta.url), 'utf8')
const settingsSource = readFileSync(new URL('../pages/settings/settings.vue', import.meta.url), 'utf8')
const appSource = readFileSync(new URL('../App.vue', import.meta.url), 'utf8')
const sourcePage = readFileSync(new URL('../pages/source/source.vue', import.meta.url), 'utf8')
const zhHansLocaleSource = readFileSync(new URL('../locales/zh-Hans.js', import.meta.url), 'utf8')

test('i18n exposes native language labels without relying on translated locale names', () => {
  const expectedOptions = [
    ["value: 'zh-Hans'", "nativeName: '简体中文'"],
    ["value: 'zh-Hant'", "nativeName: '繁體中文'"],
    ["value: 'en'", "nativeName: 'English'"],
    ["value: 'ja'", "nativeName: '日本語'"],
    ["value: 'ko'", "nativeName: '한국어'"],
    ["value: 'de'", "nativeName: 'Deutsch'"],
    ["value: 'fr'", "nativeName: 'Français'"],
    ["value: 'es'", "nativeName: 'Español'"]
  ]

  assert.match(i18nSource, /export const LOCALE_OPTIONS = \[/)
  expectedOptions.forEach(([value, nativeName]) => {
    assert.ok(i18nSource.includes(value), value)
    assert.ok(i18nSource.includes(nativeName), nativeName)
  })
})

test('settings page renders native locale names instead of internal locale codes', () => {
  assert.match(settingsSource, /LOCALE_OPTIONS/)
  assert.match(settingsSource, /option\.nativeName/)
  assert.doesNotMatch(settingsSource, /v-for="locale in SUPPORTED_LOCALES"/)
  assert.doesNotMatch(settingsSource, /\{\{\s*locale\s*\}\}/)
})

test('app launch hydrates persisted locale before rendering visible copy', () => {
  assert.match(appSource, /import\s+\{\s*hydrateLocale\s*\}\s+from\s+['"]\.\/utils\/i18n['"]/) 
  assert.match(appSource, /onLaunch:\s*async function\(\)\s*\{\s*hydrateLocale\(\)/)
})

test('音源管理页只通过阶段 3 导入与管理接口处理用户脚本', () => {
  assert.match(sourcePage, /requestSourceScriptFile/)
  assert.match(sourcePage, /readSourceScriptText/)
  assert.match(sourcePage, /prepareSourceImport/)
  assert.match(sourcePage, /savePreparedSource/)
  assert.match(sourcePage, /BaseDialog/)
  assert.match(sourcePage, /t\('source\.importAction'\)/)
  assert.doesNotMatch(sourcePage, /音源功能尚未开放|第一阶段不接入音源/)
})

test('音源文件选择在确认点击中先发起，避免关闭弹层后丢失用户激活上下文', () => {
  assert.match(
    sourcePage,
    /async function chooseSourceScript\(\) \{\s*try \{\s*const result = await requestSourceScriptFile\(\)\s*riskVisible\.value = false/
  )
})

test('app launch hydrates persisted source state before pruning versioned execution consents', () => {
  assert.match(appSource, /import\s+\{\s*hydrateSources,\s*sourceState\s*\}\s+from\s+['"]\.\/stores\/sourceStore['"]/) 
  assert.match(appSource, /hydrateSources\(\)/)
  assert.match(appSource, /hydrateSourceExecutionConsents\(sourceState\.items\)/)
  assert.doesNotMatch(appSource, /sourceRuntime/)
})

test('local music visible copy uses scan wording instead of add or import wording', () => {
  assert.match(zhHansLocaleSource, /'library\.importAction': '扫描本地音乐'/)
  assert.match(zhHansLocaleSource, /'library\.importTitle': '扫描本地音乐索引'/)
  assert.doesNotMatch(zhHansLocaleSource, /导入本地音乐/)
  assert.doesNotMatch(zhHansLocaleSource, /添加本地音乐/)
})
