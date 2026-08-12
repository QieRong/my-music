export const SOURCE_FILE_ERROR_CODES = {
  PICK_UNSUPPORTED: 'SOURCE_PICK_UNSUPPORTED',
  PICK_FAILED: 'SOURCE_PICK_FAILED',
  READ_FAILED: 'SOURCE_READ_FAILED'
}

function createSourceFileError(code, message, cause) {
  const error = new Error(message)
  error.code = code
  error.cause = cause
  return error
}

function isCancelError(error) {
  return String(error?.errMsg || error?.message || '').toLowerCase().includes('cancel')
}

export function requestSourceScriptFile() {
  // #ifdef H5
  return new Promise((resolve, reject) => {
    if (typeof uni === 'undefined' || typeof uni.chooseFile !== 'function') {
      reject(createSourceFileError(
        SOURCE_FILE_ERROR_CODES.PICK_UNSUPPORTED,
        'Source file selection is not supported in this runtime.'
      ))
      return
    }

    uni.chooseFile({
      count: 1,
      type: 'file',
      extension: ['.js'],
      success: (result) => {
        const file = Array.isArray(result?.tempFiles) ? result.tempFiles[0] : null
        if (!file) {
          reject(createSourceFileError(
            SOURCE_FILE_ERROR_CODES.PICK_FAILED,
            'No source file was selected.'
          ))
          return
        }
        resolve({ cancelled: false, file })
      },
      fail: (error) => {
        if (isCancelError(error)) {
          resolve({ cancelled: true, file: null })
          return
        }
        reject(createSourceFileError(
          SOURCE_FILE_ERROR_CODES.PICK_FAILED,
          'Source file selection failed.',
          error
        ))
      }
    })
  })
  // #endif

  return Promise.reject(createSourceFileError(
    SOURCE_FILE_ERROR_CODES.PICK_UNSUPPORTED,
    'Source file selection is not supported in this runtime.'
  ))
}

export function readSourceScriptText(file) {
  if (file && typeof file.text === 'function') {
    return Promise.resolve(file.text()).then((text) => String(text))
  }

  if (file && typeof FileReader !== 'undefined') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ''))
      reader.onerror = () => reject(createSourceFileError(
        SOURCE_FILE_ERROR_CODES.READ_FAILED,
        'Source file text could not be read.',
        reader.error
      ))
      reader.readAsText(file, 'UTF-8')
    })
  }

  return Promise.reject(createSourceFileError(
    SOURCE_FILE_ERROR_CODES.READ_FAILED,
    'Source file text could not be read.'
  ))
}
