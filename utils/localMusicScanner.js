import { AUDIO_EXTENSIONS } from './localTrackMapper.js'
import {
  openAndroidLocalMusicSettings,
  requestAndroidLocalMusicScan
} from './androidLocalMusicScanner.js'

export const LOCAL_SCAN_MODE_H5_PICKER = 'h5-picker'
export const LOCAL_SCAN_MODE_ANDROID_MEDIA_STORE = 'android-media-store'

export const LOCAL_SCAN_STATUSES = {
  IDLE: 'idle',
  EXPLAIN: 'explain',
  REQUESTING: 'requesting',
  SCANNING: 'scanning',
  COMPLETED: 'completed',
  HAS_RESULTS: 'has_results',
  EMPTY: 'empty',
  DENIED: 'denied',
  BLOCKED_SETTINGS: 'blocked_settings',
  SCAN_FAILED: 'scan_failed'
}

export const LOCAL_SCAN_ERROR_CODES = {
  UNSUPPORTED: 'SCAN_UNSUPPORTED',
  FAILED: 'SCAN_FAILED'
}

function createScanError(code, message, cause) {
  const error = new Error(message)
  error.code = code
  error.cause = cause
  return error
}

function isCancelError(error) {
  return String(error?.errMsg || error?.message || '').toLowerCase().includes('cancel')
}

function requestH5FilePicker(options = {}) {
  return new Promise((resolve, reject) => {
    if (typeof uni === 'undefined' || typeof uni.chooseFile !== 'function') {
      reject(createScanError(
        LOCAL_SCAN_ERROR_CODES.UNSUPPORTED,
        'Local music scanning is not supported in this runtime.'
      ))
      return
    }

    uni.chooseFile({
      // DCloud H5 会按 count 截断返回数组；使用 JS 安全整数上限只开启多选，
      // 让最终数量以浏览器实际返回的文件为准，不设置项目业务上限。
      count: Number.MAX_SAFE_INTEGER,
      type: 'file',
      extension: (options.extensions || AUDIO_EXTENSIONS).map((extension) => `.${extension}`),
      success: (res) => {
        const files = Array.isArray(res?.tempFiles) ? res.tempFiles : []
        resolve({
          cancelled: false,
          files,
          tracks: files,
          mode: LOCAL_SCAN_MODE_H5_PICKER,
          status: files.length ? LOCAL_SCAN_STATUSES.HAS_RESULTS : LOCAL_SCAN_STATUSES.EMPTY
        })
      },
      fail: (error) => {
        if (isCancelError(error)) {
          resolve({
            cancelled: true,
            files: [],
            tracks: [],
            mode: LOCAL_SCAN_MODE_H5_PICKER,
            status: LOCAL_SCAN_STATUSES.IDLE
          })
          return
        }

        reject(createScanError(
          LOCAL_SCAN_ERROR_CODES.FAILED,
          'Local music scanning failed.',
          error
        ))
      }
    })
  })
}

export function requestLocalMusicScan(options = {}) {
  // #ifdef H5
  return requestH5FilePicker(options)
  // #endif

  // #ifdef APP-PLUS
  return requestAndroidLocalMusicScan(options)
  // #endif

  return Promise.reject(createScanError(
    LOCAL_SCAN_ERROR_CODES.UNSUPPORTED,
    'Local music scanning is not supported in this runtime.'
  ))
}

export function openLocalMusicScanSettings() {
  // #ifdef APP-PLUS
  return Promise.resolve(openAndroidLocalMusicSettings()).catch(() => false)
  // #endif

  return Promise.resolve(false)
}
