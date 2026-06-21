/** @typedef {{ values?: unknown }} SentryException */
/** @typedef {{ message?: unknown, exception?: SentryException }} SentryEvent */

/** @param {unknown} value @returns {value is Record<string, unknown>} */
const isRecord = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

/** @param {unknown} value @returns {string | undefined} */
const optionalString = (value) =>
  typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined

/**
 * @param {unknown} event
 * @returns {string[]}
 */
export const sentryEventTitles = (event) => {
  if (!isRecord(event)) {
    return []
  }

  const titles = [optionalString(event.message)]
  const exception = isRecord(event.exception) ? event.exception : undefined
  const values = Array.isArray(exception?.values) ? exception.values : []

  for (const value of values) {
    if (!isRecord(value)) {
      continue
    }

    titles.push(optionalString(value.value))
  }

  return titles.filter((title) => title !== undefined)
}

/** @param {unknown} event @returns {boolean} */
export const isSyntheticSentryTestEvent = (event) =>
  sentryEventTitles(event).some((title) => /^Test:/i.test(title))
