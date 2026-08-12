import test from 'node:test'
import assert from 'node:assert/strict'

import de from '../locales/de.js'
import en from '../locales/en.js'
import es from '../locales/es.js'
import fr from '../locales/fr.js'
import ja from '../locales/ja.js'
import ko from '../locales/ko.js'
import zhHans from '../locales/zh-Hans.js'
import zhHant from '../locales/zh-Hant.js'

const localeMessages = {
  'zh-Hans': zhHans,
  'zh-Hant': zhHant,
  en,
  ja,
  ko,
  de,
  fr,
  es
}

test('all eight locale files expose exactly the same message keys', () => {
  const expectedKeys = Object.keys(zhHans).sort()

  Object.entries(localeMessages).forEach(([locale, messages]) => {
    assert.deepEqual(Object.keys(messages).sort(), expectedKeys, `${locale} locale keys differ`)
  })
})
