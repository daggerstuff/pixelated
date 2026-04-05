import path from 'node:path'
import { pathToFileURL } from 'node:url'

function hasConfiguredValue(value) {
  return value !== undefined && value !== null && String(value).trim().length > 0
}

export function getPortFallbackPolicy(env = process.env) {
  const reasons = []

  if (hasConfiguredValue(env.PORT)) {
    reasons.push('PORT is explicitly configured')
  }

  if (hasConfiguredValue(env.WEBSITES_PORT)) {
    reasons.push('WEBSITES_PORT is explicitly configured')
  }

  if (hasConfiguredValue(env.NO_PORT_FALLBACK)) {
    reasons.push('NO_PORT_FALLBACK is set')
  }

  if (hasConfiguredValue(env.FORCE_EXIT_ON_EADDRINUSE)) {
    reasons.push('FORCE_EXIT_ON_EADDRINUSE is set')
  }

  if (env.NODE_ENV === 'production') {
    reasons.push('NODE_ENV=production')
  }

  return {
    disabled: reasons.length > 0,
    reasons,
  }
}

export function resolveSsrEntryModuleUrl({
  cwd = process.cwd(),
  env = process.env,
} = {}) {
  const entryPath = hasConfiguredValue(env.SSR_ENTRY_FILE)
    ? path.resolve(String(env.SSR_ENTRY_FILE))
    : path.resolve(cwd, 'dist/server/entry.mjs')

  return pathToFileURL(entryPath).href
}
