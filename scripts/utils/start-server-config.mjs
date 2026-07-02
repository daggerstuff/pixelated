import fs from 'node:fs'
import process from 'process'
import { existsSync, readdirSync } from 'node:fs'
import path from 'path'
import { pathToFileURL } from 'url'

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
    isFallbackDisabled: reasons.length > 0,
    reasons,
  }
}

/** @returns {Promise<string | null>} */
async function findHandlerEntryPath(serverDir) {
  if (!existsSync(serverDir)) {
    return null
  }

  const candidates = readdirSync(serverDir).filter(
    (file) => file.endsWith('.mjs') || file.endsWith('.js'),
  )

  for (const file of candidates) {
    const moduleUrl = pathToFileURL(path.join(serverDir, file)).href
    const exports = await import(moduleUrl)
    if (typeof exports.handler === 'function') {
      return path.join(serverDir, file)
    }
  }

  return null
}

export async function resolveSsrEntryModuleUrl({
  cwd = process.cwd(),
  env = process.env,
} = {}) {
  if (hasConfiguredValue(env.SSR_ENTRY_FILE)) {
    return pathToFileURL(path.resolve(String(env.SSR_ENTRY_FILE))).href
  }

  const serverDir = path.resolve(cwd, 'dist/server')
  const defaultEntry = path.join(serverDir, 'entry2.mjs')

  if (existsSync(defaultEntry)) {
    try {
      const exports = await import(pathToFileURL(defaultEntry).href)
      if (typeof exports.handler === 'function') {
        return pathToFileURL(defaultEntry).href
      }
    } catch {
      // Fall through to handler discovery.
    }
  }

  const handlerEntry = await findHandlerEntryPath(serverDir)
  if (handlerEntry) {
    return pathToFileURL(handlerEntry).href
  }

  return pathToFileURL(defaultEntry).href
}
