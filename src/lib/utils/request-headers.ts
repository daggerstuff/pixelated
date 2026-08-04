type HeaderRecordValue = string | string[] | number | boolean | null | undefined
type HeaderRecord = Record<string, HeaderRecordValue>
type HeaderGetter = {
  get: (name: string) => string | null
  entries?: () => IterableIterator<[string, string]>
}
type HeaderSource =
  | HeaderGetter
  | HeaderRecord
  | { headers?: HeaderGetter | HeaderRecord | null }
  | null
  | undefined

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function resolveHeaders(source: HeaderSource): HeaderGetter | HeaderRecord | null {
  if (!source) {
    return null
  }

  if (
    isRecord(source) &&
    'headers' in source &&
    !('get' in source && typeof source['get'] === 'function')
  ) {
    const headers = source['headers']
    return isRecord(headers) ? (headers as HeaderGetter | HeaderRecord) : null
  }

  return source as HeaderGetter | HeaderRecord
}

function stringifyHeaderValue(value: HeaderRecordValue): string | undefined {
  if (value === undefined || value === null) {
    return undefined
  }

  if (Array.isArray(value)) {
    return value[0]
  }

  return String(value)
}

export function getRequestHeader(
  source: HeaderSource,
  name: string,
): string | undefined {
  const headers = resolveHeaders(source)
  if (!headers) {
    return undefined
  }

  if ('get' in headers && typeof headers.get === 'function') {
    return headers.get(name) ?? undefined
  }

  const record = headers as HeaderRecord
  const directValue = stringifyHeaderValue(record[name])
  if (directValue !== undefined) {
    return directValue
  }

  const lowerName = name.toLowerCase()
  const lowerValue = stringifyHeaderValue(record[lowerName])
  if (lowerValue !== undefined) {
    return lowerValue
  }

  for (const [key, value] of Object.entries(record)) {
    if (key.toLowerCase() === lowerName) {
      return stringifyHeaderValue(value)
    }
  }

  return undefined
}

export function getRequestHeaderEntries(source: HeaderSource): [string, string][] {
  const headers = resolveHeaders(source)
  if (!headers) {
    return []
  }

  if ('entries' in headers && typeof headers.entries === 'function') {
    return Array.from(headers.entries())
  }

  return Object.entries(headers as HeaderRecord).flatMap(([key, value]) => {
    const normalizedValue = stringifyHeaderValue(value)
    return normalizedValue === undefined ? [] : [[key, normalizedValue]]
  })
}

export function normalizeRequestHeaders<T extends { headers?: unknown }>(
  request: T,
): T {
  if (!request.headers || !isRecord(request.headers)) {
    return request
  }

  if (
    'get' in request.headers &&
    typeof request.headers['get'] === 'function'
  ) {
    return request
  }

  Object.defineProperty(request, 'headers', {
    value: new Headers(getRequestHeaderEntries(request.headers as HeaderRecord)),
    writable: true,
    enumerable: true,
    configurable: true,
  })

  return request
}
