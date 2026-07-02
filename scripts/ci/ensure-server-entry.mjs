#!/usr/bin/env node
/**
 * Ensure dist/server/entry.mjs exists and exports the Node adapter handler.
 *
 * Astro preview and @astrojs/node expect build.serverEntry (entry.mjs). Custom
 * Vite rolldown bridging can leave the adapter bundle at index.js/entry2.mjs
 * while middleware occupies entry.mjs — this script normalizes the layout.
 */
import { existsSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const serverDir = path.resolve(process.cwd(), 'dist/server')
const targetName = 'entry.mjs'
const targetPath = path.join(serverDir, targetName)

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

async function main() {
  const handlerFile = await findHandlerEntryFile()
  if (!handlerFile) {
    throw new Error('No SSR handler module found under dist/server')
  }

  if (handlerFile === targetName) {
    const exports = await moduleExports(targetName)
    if (typeof exports.handler !== 'function') {
      throw new Error(`${targetName} exists but does not export handler`)
    }
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
