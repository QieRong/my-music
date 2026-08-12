import { createAndroidScanStats, mapAndroidMediaStoreRows } from './androidMediaStoreMapper.js'

const READ_MEDIA_AUDIO = 'android.permission.READ_MEDIA_AUDIO'
const READ_EXTERNAL_STORAGE = 'android.permission.READ_EXTERNAL_STORAGE'
const MEDIA_STORE_NULL_CURSOR_ERROR_CODE = 'MEDIA_STORE_NULL_CURSOR'

const ANDROID_AUDIO_FIELD_KEYS = [
  '_id',
  'title',
  'artist',
  'album',
  '_display_name',
  '_size',
  'mime_type',
  'duration',
  'date_modified'
]

const ANDROID_AUDIO_CORE_FILTER_KEYS = [
  'is_music',
  'is_notification',
  'is_ringtone',
  'is_alarm',
  'is_podcast'
]

function getAndroidAudioOptionalFilterKeys(apiLevel) {
  const keys = [...ANDROID_AUDIO_CORE_FILTER_KEYS]
  if (apiLevel >= 29) {
    keys.push('is_audiobook')
  }
  if (apiLevel >= 31) {
    keys.push('is_recording')
  }
  return keys
}

function logAndroidScan(message, payload) {
  if (typeof console === 'undefined' || typeof console.log !== 'function') {
    return
  }

  if (payload === undefined) {
    console.log(`[MyMusicShellUni][android-scan] ${message}`)
    return
  }

  console.log(`[MyMusicShellUni][android-scan] ${message}`, payload)
}

function createAndroidScanResult(status, overrides = {}) {
  return {
    cancelled: false,
    files: [],
    tracks: [],
    mode: 'android-media-store',
    status,
    stats: createAndroidScanStats(),
    ...overrides
  }
}

function notifyStatus(options, status) {
  if (typeof options?.onStatus === 'function') {
    options.onStatus(status)
  }
}

function isAndroidRuntime() {
  // #ifdef APP-PLUS
  return typeof plus !== 'undefined'
    && plus.android
    && String(plus.os?.name || '').toLowerCase() === 'android'
  // #endif

  return false
}

function getAndroidApiLevel() {
  try {
    const Version = plus.android.importClass('android.os.Build$VERSION')
    return Number(Version.SDK_INT) || 0
  } catch (error) {
    return 0
  }
}

function getRequiredAudioPermission() {
  return getAndroidApiLevel() >= 33 ? READ_MEDIA_AUDIO : READ_EXTERNAL_STORAGE
}

function getPermissionStatus(permission) {
  if (!plus.android || typeof plus.android.checkPermission !== 'function') {
    return 'not_requested'
  }

  const status = String(plus.android.checkPermission(permission) || '').toLowerCase()
  if (status === 'authorized') {
    return 'granted'
  }
  if (status === 'denied' || status === 'deniedalways') {
    return 'denied'
  }
  return 'not_requested'
}

function hasPermission(list, permission) {
  return Array.isArray(list) && list.includes(permission)
}

function requestAudioPermission(permission) {
  const existingStatus = getPermissionStatus(permission)
  if (existingStatus === 'granted') {
    return Promise.resolve('granted')
  }

  return new Promise((resolve) => {
    if (!plus.android || typeof plus.android.requestPermissions !== 'function') {
      resolve('scan_failed')
      return
    }

    plus.android.requestPermissions(
      [permission],
      (result) => {
        if (hasPermission(result?.granted, permission)) {
          resolve('granted')
          return
        }
        if (hasPermission(result?.deniedAlways, permission)) {
          resolve('blocked_settings')
          return
        }
        resolve('denied')
      },
      () => {
        resolve('scan_failed')
      }
    )
  })
}

function importAndroidClass(target) {
  try {
    plus.android.importClass(target)
  } catch (error) {
    // 部分 plus.android 对象不需要显式 importClass。
  }
  return target
}

function getMediaColumn(AudioMedia, key) {
  const constantNameMap = {
    _id: '_ID',
    title: 'TITLE',
    artist: 'ARTIST',
    album: 'ALBUM',
    _display_name: 'DISPLAY_NAME',
    _size: 'SIZE',
    mime_type: 'MIME_TYPE',
    duration: 'DURATION',
    date_modified: 'DATE_MODIFIED',
    is_music: 'IS_MUSIC',
    is_notification: 'IS_NOTIFICATION',
    is_ringtone: 'IS_RINGTONE',
    is_alarm: 'IS_ALARM',
    is_recording: 'IS_RECORDING',
    is_podcast: 'IS_PODCAST',
    is_audiobook: 'IS_AUDIOBOOK'
  }
  const constantName = constantNameMap[key]
  return constantName && AudioMedia[constantName] ? AudioMedia[constantName] : key
}

function createProjection(AudioMedia, keys) {
  return keys.map((key) => getMediaColumn(AudioMedia, key))
}

export function readAndroidCursorValue(cursor, fieldName, columnIndex) {
  if (columnIndex < 0) {
    return undefined
  }

  if (typeof cursor.isNull === 'function' && cursor.isNull(columnIndex)) {
    return undefined
  }

  if (fieldName === '_id'
    || fieldName === '_size'
    || fieldName === 'duration'
    || fieldName === 'date_modified'
    || fieldName.startsWith('is_')) {
    return Number(cursor.getLong(columnIndex))
  }

  return String(cursor.getString(columnIndex) || '')
}

export function assertMediaStoreCursor(cursor) {
  if (!cursor) {
    const error = new Error('MediaStore query returned no cursor')
    error.code = MEDIA_STORE_NULL_CURSOR_ERROR_CODE
    throw error
  }
  return cursor
}

function cursorToRows(cursor, columnMap) {
  const rows = []
  importAndroidClass(cursor)
  const fields = Object.keys(columnMap).map((fieldKey) => ({
    fieldKey,
    fieldName: columnMap[fieldKey],
    columnIndex: cursor.getColumnIndex(columnMap[fieldKey])
  }))

  while (cursor.moveToNext()) {
    const row = {}
    fields.forEach(({ fieldKey, fieldName, columnIndex }) => {
      const value = readAndroidCursorValue(cursor, fieldName, columnIndex)
      if (value !== undefined) {
        row[fieldKey] = value
      }
    })
    rows.push(row)
  }

  return rows
}

function queryAudioRows(AudioMedia, projectionKeys) {
  let cursor = null
  try {
    const activity = importAndroidClass(plus.android.runtimeMainActivity())
    const resolver = importAndroidClass(activity.getContentResolver())
    const uri = AudioMedia.EXTERNAL_CONTENT_URI
    const projection = createProjection(AudioMedia, projectionKeys)
    const columnMap = projectionKeys.reduce((map, key, index) => {
      map[key] = projection[index]
      return map
    }, {})
    cursor = resolver.query(
      uri,
      projection,
      null,
      null,
      null
    )

    assertMediaStoreCursor(cursor)
    return cursorToRows(cursor, columnMap)
  } finally {
    if (cursor && typeof cursor.close === 'function') {
      cursor.close()
    }
  }
}

function queryAndroidAudioRows() {
  const AudioMedia = plus.android.importClass('android.provider.MediaStore$Audio$Media')
  const apiLevel = getAndroidApiLevel()
  const fullProjection = [
    ...ANDROID_AUDIO_FIELD_KEYS,
    ...getAndroidAudioOptionalFilterKeys(apiLevel)
  ]

  let rows
  try {
    rows = queryAudioRows(AudioMedia, fullProjection)
  } catch (error) {
    if (error?.code === MEDIA_STORE_NULL_CURSOR_ERROR_CODE) {
      throw error
    }
    logAndroidScan('media store full projection failed, fallback to base projection', {
      message: String(error?.message || error || '')
    })
    rows = queryAudioRows(AudioMedia, ANDROID_AUDIO_FIELD_KEYS)
  }
  return rows.sort((left, right) => Number(right.date_modified || 0) - Number(left.date_modified || 0))
}

function createRowDiagnostics(rows) {
  return rows.slice(0, 10).map((row) => ({
    fileName: row._display_name || '',
    mimeType: row.mime_type || '',
    duration: row.duration || 0,
    size: row._size || 0,
    isMusic: row.is_music,
    isNotification: row.is_notification,
    isRingtone: row.is_ringtone,
    isAlarm: row.is_alarm,
    isRecording: row.is_recording,
    isPodcast: row.is_podcast,
    isAudiobook: row.is_audiobook
  }))
}

export async function requestAndroidLocalMusicScan(options = {}) {
  if (!isAndroidRuntime()) {
    logAndroidScan('runtime unavailable')
    return createAndroidScanResult('scan_failed')
  }

  notifyStatus(options, 'requesting')
  const permission = getRequiredAudioPermission()
  logAndroidScan('request permission', {
    apiLevel: getAndroidApiLevel(),
    permission
  })
  const permissionStatus = await requestAudioPermission(permission)
  logAndroidScan('permission result', { permissionStatus })

  if (permissionStatus !== 'granted') {
    return createAndroidScanResult(permissionStatus)
  }

  try {
    notifyStatus(options, 'scanning')
    const rows = queryAndroidAudioRows()
    logAndroidScan('media store rows queried', { count: rows.length })
    logAndroidScan('media store row diagnostics', createRowDiagnostics(rows))
    const mapped = mapAndroidMediaStoreRows(rows, {
      existingTracks: options.existingTracks,
      now: options.now
    })
    logAndroidScan('media store rows mapped', {
      indexedCount: mapped.tracks.length,
      stats: mapped.stats
    })
    notifyStatus(options, 'completed')
    const status = mapped.tracks.length ? 'has_results' : 'empty'
    return createAndroidScanResult(status, {
      files: mapped.tracks,
      tracks: mapped.tracks,
      stats: mapped.stats
    })
  } catch (error) {
    logAndroidScan('scan failed', {
      message: String(error?.message || error || '')
    })
    return createAndroidScanResult('scan_failed', {
      stats: createAndroidScanStats({ failedCount: 1 })
    })
  }
}

export function openAndroidLocalMusicSettings() {
  if (!isAndroidRuntime()) {
    return false
  }

  try {
    const activity = plus.android.runtimeMainActivity()
    const Intent = plus.android.importClass('android.content.Intent')
    const Settings = plus.android.importClass('android.provider.Settings')
    const Uri = plus.android.importClass('android.net.Uri')
    const intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
    intent.setData(Uri.parse(`package:${activity.getPackageName()}`))
    activity.startActivity(intent)
    return true
  } catch (error) {
    return false
  }
}
