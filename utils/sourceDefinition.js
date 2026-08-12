export const SOURCE_CAPABILITIES = [
  'search',
  'play',
  'lyric',
  'cover',
  'download'
]

export const SOURCE_DEFINITION_ERROR_CODES = {
  EMPTY_SCRIPT: 'SOURCE_EMPTY_SCRIPT',
  MISSING_HEADER: 'SOURCE_MISSING_HEADER',
  MISSING_FIELD: 'SOURCE_MISSING_FIELD',
  INVALID_CAPABILITY: 'SOURCE_INVALID_CAPABILITY'
}

const REQUIRED_SOURCE_FIELDS = [
  'id',
  'name',
  'version',
  'author',
  'description',
  'capabilities'
]

function createSourceDefinitionError(code, message, details = {}) {
  const error = new Error(message)
  error.code = code
  Object.assign(error, details)
  return error
}

function readSourceHeader(script) {
  const match = script.match(/^\s*\/\*\*([\s\S]*?)\*\//)
  if (!match) {
    throw createSourceDefinitionError(
      SOURCE_DEFINITION_ERROR_CODES.MISSING_HEADER,
      'Source manifest header is required.'
    )
  }

  return match[1].split('\n').reduce((manifest, line) => {
    const normalizedLine = line.trim().replace(/^\*\s?/, '')
    const fieldMatch = normalizedLine.match(/^@([a-zA-Z][\w-]*)\s+(.+)$/)
    if (fieldMatch) {
      manifest[fieldMatch[1]] = fieldMatch[2].trim()
    }
    return manifest
  }, {})
}

function parseCapabilities(rawCapabilities) {
  const capabilities = rawCapabilities
    .split(',')
    .map((capability) => capability.trim())
    .filter(Boolean)

  const normalizedCapabilities = []
  for (const capability of capabilities) {
    if (!SOURCE_CAPABILITIES.includes(capability)) {
      throw createSourceDefinitionError(
        SOURCE_DEFINITION_ERROR_CODES.INVALID_CAPABILITY,
        `Unsupported source capability: ${capability}`,
        { capability }
      )
    }
    if (!normalizedCapabilities.includes(capability)) {
      normalizedCapabilities.push(capability)
    }
  }

  if (!normalizedCapabilities.length) {
    throw createSourceDefinitionError(
      SOURCE_DEFINITION_ERROR_CODES.MISSING_FIELD,
      'Source manifest field is required: capabilities',
      { field: 'capabilities' }
    )
  }

  return normalizedCapabilities
}

export function parseSourceDefinition(script, now = Date.now()) {
  const normalizedScript = typeof script === 'string' ? script : ''
  if (!normalizedScript.trim()) {
    throw createSourceDefinitionError(
      SOURCE_DEFINITION_ERROR_CODES.EMPTY_SCRIPT,
      'Source script cannot be empty.'
    )
  }

  const manifest = readSourceHeader(normalizedScript)
  for (const field of REQUIRED_SOURCE_FIELDS) {
    if (!manifest[field]) {
      throw createSourceDefinitionError(
        SOURCE_DEFINITION_ERROR_CODES.MISSING_FIELD,
        `Source manifest field is required: ${field}`,
        { field }
      )
    }
  }

  return {
    id: manifest.id,
    name: manifest.name,
    version: manifest.version,
    author: manifest.author,
    description: manifest.description,
    homepage: manifest.homepage || '',
    capabilities: parseCapabilities(manifest.capabilities),
    enabled: false,
    script: normalizedScript,
    importedAt: now,
    updatedAt: now
  }
}
