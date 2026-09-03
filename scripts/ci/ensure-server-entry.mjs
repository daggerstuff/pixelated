#!/usr/bin/env node
/**
 * Ensure dist/server/entry2.mjs exists and exports the Node adapter handler.
 *
 * Astro preview and @astrojs/node use build.serverEntry (entry2.mjs). Custom
 * Vite rolldown bridging can leave the adapter bundle at index.js while
 * middleware occupies entry.mjs — this script normalizes the layout.
 */
import { existsSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const serverDir = path.resolve(process.cwd(), 'dist/server')

/** @param {string} fileName */
async function moduleExports(fileName) {
  const moduleUrl = pathToFileURL(path.join(serverDir, fileName)).href
  return import(moduleUrl)
}

/** @returns {Promise<string | null>} */
async function findHandlerEntryFile() {
  if (!existsSync(serverDir)) {
    return null
  }

  const candidates = readdirSync(serverDir).filter(
    (file) => file.endsWith('.mjs') || file.endsWith('.js'),
  )

  for (const file of candidates) {
    const exports = await moduleExports(file)
    if (typeof exports.handler === 'function') {
      return file
    }
  }

  return null
}

/** @returns {Promise<string>} */
async function resolveServerEntryName() {
  if (process.env.SSR_SERVER_ENTRY?.trim()) {
    return process.env.SSR_SERVER_ENTRY.trim()
  }

  try {
    const configUrl = pathToFileURL(path.resolve(process.cwd(), 'astro.config.mjs')).href
    const astroConfig = await import(configUrl)
    const serverEntry = astroConfig.default?.build?.serverEntry
    if (typeof serverEntry === 'string' && serverEntry.trim().length > 0) {
      return serverEntry.trim()
    }
  } catch (error) {
    console.warn(
      '[ensure-server-entry] Could not read astro.config.mjs serverEntry:',
      error instanceof Error ? error.message : error,
    )
  }

  return 'entry2.mjs'
}

async function main() {
  // Vercel adapter writes SSR output to .vercel/output/, not dist/server/.
  // This normalization step only applies to @astrojs/node middleware builds.
  if (process.env.VERCEL) {
    console.log(
      '[ensure-server-entry] Skipping: Vercel adapter uses .vercel/output instead of dist/server',
    )
    return
  }

  const targetName = await resolveServerEntryName()
  const targetPath = path.join(serverDir, targetName)
  const handlerFile = await findHandlerEntryFile()
  if (!handlerFile) {
    throw new Error('No SSR handler module found under dist/server')
  }

  if (handlerFile === targetName) {
    const exports = await moduleExports(targetName)
    if (typeof exports.handler !== 'function') {
      throw new Error(`${targetName} exists but does not export handler`)
    }
    console.log(`[ensure-server-entry] ${targetName} already exports handler`)
    return
  }

  const reexportSource = handlerFile.startsWith('.') ? handlerFile : `./${handlerFile}`
  writeFileSync(targetPath, `export * from '${reexportSource}';\n`, 'utf8')
  console.log(`[ensure-server-entry] Wrote ${targetName} re-exporting ${handlerFile}`)
}

main().catch((error) => {
  console.error('[ensure-server-entry] Failed:', error)
  process.exit(1)
})
