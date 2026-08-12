import test from 'node:test'
import assert from 'node:assert/strict'

import {
  SOURCE_RUNTIME_ERROR_CODES,
  mapOnlineSearchResults,
  readLimitedResponse,
  validateDownloadUrl,
  validatePlayUrl,
  validateSourceRequest
} from './sourceRuntimeCore.js'

const source = { id: 'qa-source', name: 'QA Source' }

test('仅允许 HTTPS 的 GET 或 POST 请求，并且不透传未知字段', () => {
  assert.throws(
    () => validateSourceRequest({ url: 'http://example.test' }),
    (error) => error?.code === SOURCE_RUNTIME_ERROR_CODES.REQUEST_PROTOCOL
  )
  assert.throws(
    () => validateSourceRequest({ url: 'https://example.test', method: 'PUT' }),
    (error) => error?.code === SOURCE_RUNTIME_ERROR_CODES.REQUEST_METHOD
  )

  assert.throws(
    () => validateSourceRequest({ url: 'https://example.test/search', credentials: 'include' }),
    (error) => error?.code === SOURCE_RUNTIME_ERROR_CODES.REQUEST_CREDENTIALS
  )

  assert.deepEqual(validateSourceRequest({
    url: 'https://example.test/search',
    method: 'post',
    headers: { Accept: 'application/json', ignored: null },
    body: { keyword: 'alpha' },
    extra: 'must not pass through'
  }), {
    url: 'https://example.test/search',
    method: 'POST',
    headers: { Accept: 'application/json' },
    body: '{"keyword":"alpha"}'
  })
})

test('拒绝超过 64KB 的请求体和超过 1MB 的响应文本', async () => {
  assert.throws(
    () => validateSourceRequest({ url: 'https://example.test', body: 'a'.repeat(65537) }),
    (error) => error?.code === SOURCE_RUNTIME_ERROR_CODES.REQUEST_BODY_TOO_LARGE
  )

  await assert.rejects(
    () => readLimitedResponse({ text: async () => 'a'.repeat(1048577) }),
    (error) => error?.code === SOURCE_RUNTIME_ERROR_CODES.RESPONSE_TOO_LARGE
  )
})

test('在线结果仅保留白名单字段并丢弃无效项', () => {
  const { results, invalidCount } = mapOnlineSearchResults(source, [
    {
      trackId: 'track-1',
      title: 'Alpha',
      artist: 'Artist',
      album: 'Album',
      duration: 120,
      url: 'https://must-not-persist.test/file.mp3',
      cover: 'https://must-not-persist.test/cover.jpg'
    },
    { title: 'missing id' },
    { trackId: 'bad-duration', title: 'Bad', duration: 3.5 }
  ])

  assert.deepEqual(results, [{
    id: 'online:qa-source:track-1',
    sourceId: 'qa-source',
    sourceName: 'QA Source',
    trackId: 'track-1',
    title: 'Alpha',
    artist: 'Artist',
    album: 'Album',
    duration: 120
  }])
  assert.equal(invalidCount, 2)
  assert.equal('url' in results[0], false)
  assert.equal('cover' in results[0], false)
})

test('结果映射限制为每个音源最多二十条，并接受空的可选展示字段', () => {
  const rawResults = Array.from({ length: 22 }, (_, index) => ({
    trackId: `track-${index}`,
    title: `Result ${index}`
  }))
  const { results, invalidCount } = mapOnlineSearchResults(source, rawResults)

  assert.equal(results.length, 20)
  assert.equal(invalidCount, 0)
  assert.deepEqual(results[0], {
    id: 'online:qa-source:track-0',
    sourceId: 'qa-source',
    sourceName: 'QA Source',
    trackId: 'track-0',
    title: 'Result 0',
    artist: '',
    album: '',
    duration: null
  })
})

test('播放地址只接受短小且不含凭据的 HTTPS 地址', () => {
  assert.equal(validatePlayUrl('https://media.example.test/track.mp3'), 'https://media.example.test/track.mp3')
  assert.equal(validatePlayUrl({ url: 'https://media.example.test/track.mp3' }), 'https://media.example.test/track.mp3')

  for (const value of [
    'http://media.example.test/track.mp3',
    'https://user:password@media.example.test/track.mp3',
    '',
    { url: 'https://media.example.test/' + 'a'.repeat(2049) }
  ]) {
    assert.throws(
      () => validatePlayUrl(value),
      (error) => error?.code === SOURCE_RUNTIME_ERROR_CODES.PLAY_URL_INVALID
    )
  }
})

test('下载地址遵循独立错误码，但同样只接受短小且不含凭据的 HTTPS 地址', () => {
  assert.equal(validateDownloadUrl('https://media.example.test/track.mp3'), 'https://media.example.test/track.mp3')
  assert.equal(validateDownloadUrl({ url: 'https://media.example.test/track.mp3' }), 'https://media.example.test/track.mp3')

  for (const value of [
    'http://media.example.test/track.mp3',
    'https://user:password@media.example.test/track.mp3',
    '',
    { url: 'https://media.example.test/' + 'a'.repeat(2049) }
  ]) {
    assert.throws(
      () => validateDownloadUrl(value),
      (error) => error?.code === SOURCE_RUNTIME_ERROR_CODES.DOWNLOAD_URL_INVALID
    )
  }
})
