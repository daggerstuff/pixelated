import { readFileSync as readFileSyncFs } from 'node:fs'

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

  const titles = []
  const msg = optionalString(event.message)
  if (msg !== undefined) {
    titles.push(msg)
  }

  const exception = isRecord(event.exception) ? event.exception : undefined
  const values = Array.isArray(exception?.values) ? exception.values : []

  for (const value of values) {
    if (!isRecord(value)) {
      continue
    }

    const title = optionalString(value.value)
    if (title !== undefined) {
      titles.push(title)
    }
  }

  return titles
}

/** @param {unknown} event @returns {boolean} */
export const isSyntheticSentryTestEvent = (event) =>
  sentryEventTitles(event).some((title) => /^Test:/i.test(title))

/**
 * Detect a local development machine (as opposed to a containerized deploy).
 *
 * Production runs inside Docker/Kubernetes and therefore exposes at least one
 * container signal (/.dockerenv, a /proc/1/cgroup line, or
 * KUBERNETES_SERVICE_HOST / VERCEL / DOCKER_BUILD). A local `pnpm build &&
 * node start-server.mjs` run on a developer's bare-metal machine has none of
 * those, which lets us drop its events from the production project even when
 * it is started with NODE_ENV=production (a "production-mode local run").
 *
 * Detection reads the filesystem only once and caches the result, so the
 * per-event beforeSend filter stays allocation-free.
 *
 * Set SENTRY_ALLOW_LOCAL_EVENTS=1 to disable this filter entirely (e.g. when
 * you want to verify telemetry from a local run).
 *
 * @param {{ env?: NodeJS.ProcessEnv, readFileSync?: (p: string, e: string) => string }} [options]
 * @returns {boolean} true when running on a local dev machine
 */
export const isLocalDevelopmentRun = (options = {}) => {
  const env = options.env ?? process.env
  if (String(env.SENTRY_ALLOW_LOCAL_EVENTS ?? '') === '1') {
    return false
  }

  if (String(env.KUBERNETES_SERVICE_HOST ?? '').trim() !== '') {
    return false
  }
  if (String(env.VERCEL ?? '').trim() !== '') {
    return false
  }
  if (String(env.DOCKER_BUILD ?? '').trim() !== '') {
    return false
  }

  // A supplied readFileSync override (used by tests) is always honored and
  // never cached; production calls without an override cache the result.
  if (options.readFileSync) {
    return computeLocalDevRun(options.readFileSync)
  }
  localDevRunState ??= computeLocalDevRun(readFileSyncFs)
  return localDevRunState
}

/** @type {boolean | null} */
let localDevRunState = null

/**
 * @param {(p: string, e: string) => string | undefined} readFileSyncOverride
 * @returns {boolean}
 */
function computeLocalDevRun(readFileSyncOverride) {
  try {
    const readFileSync = readFileSyncOverride ?? readFileSyncFs

    // Docker sets /.dockerenv in the container root.
    try {
      readFileSync('/.dockerenv', 'utf8')
      return false
    } catch {
      // Not a (plain) Docker container.
    }

    // Kubernetes / systemd containers expose a cgroup v2 unified-hierarchy
    // line; bare-metal hosts carry the plain "/init.scope" marker.
    const cgroup = readFileSync('/proc/1/cgroup', 'utf8')
    if (/^0::/.test(cgroup) && !/^0::\/init\.scope\s*$/.test(cgroup.trim())) {
      return false
    }
  } catch {
    // /proc or /.dockerenv unreadable: treat as containerized (do not drop).
    return false
  }

  return true
}
