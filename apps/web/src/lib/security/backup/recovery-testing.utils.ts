/**
 * Recovery testing utilities — UUID generation and lazy Node module loading.
 * Extracted from recovery-testing.ts.
 */

import { createBuildSafeLogger } from '../../logging/build-safe-logger'

const logger = createBuildSafeLogger('recovery-testing')

export const isBrowser =
  typeof window !== 'undefined' && typeof document !== 'undefined'

// Node.js module references - initialized lazily
let nodeModulesLoaded = false
let nodeRandomUUIDFunction: (() => string) | undefined
export let nodeCryptoCreateHash: typeof import('node:crypto').createHash | undefined
export let pathModule: typeof import('node:path') | undefined
export let fsPromisesModule: typeof import('node:fs/promises') | undefined

export async function loadNodeModules() {
  if (isBrowser || nodeModulesLoaded) {
    return
  }

  try {
    // Dynamically import Node.js modules only on server
    const cryptoMod = await import('node:crypto')
    const pathMod = await import('node:path')
    const fsPromisesMod = await import('node:fs/promises')

    nodeRandomUUIDFunction = cryptoMod.randomUUID
    nodeCryptoCreateHash = cryptoMod.createHash
    pathModule = pathMod
    fsPromisesModule = fsPromisesMod
    nodeModulesLoaded = true
  } catch {
    // Modules not available, will use fallbacks
    logger.warn('Node.js modules not available, using fallbacks')
  }
}

// Helper to synchronously require Node modules in Node-only environments without
// triggering static bundlers or TypeScript/ESLint `no-require-imports` errors.
function tryRequireNode(moduleName: string): any {
  try {
    if (!isBrowser && typeof process !== 'undefined') {
      // Use eval to avoid bundlers rewriting/including the require call.
      const globalRequire = (globalThis as Record<string, unknown>)[
        'require'
      ] as (name: string) => unknown
      if (typeof globalRequire === 'function') {
        return globalRequire(moduleName)
      }

      // Try to access via global scope
      const mod = (globalThis as Record<string, unknown>)[moduleName]
      if (mod) return mod
    }
  } catch (e) {
    logger.debug(`Failed to require ${moduleName}:`, e)
    // return null to trigger fallback logic
  }
  return null
}

export function generateUUID(): string {
  if (!isBrowser && nodeRandomUUIDFunction) {
    return nodeRandomUUIDFunction()
  }
  // Browser or fallback for Node.js if crypto failed to load
  if (
    isBrowser &&
    typeof window.crypto !== 'undefined' &&
    typeof window.crypto.randomUUID === 'function'
  ) {
    return window.crypto.randomUUID()
  }
  // Fallback for older browsers or if Node.js crypto is unavailable
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    // Use secure random byte for fallback UUID generation
    let r = 0
    try {
      if (!isBrowser) {
        // Use guarded require helper to avoid bundler inclusion
        const nodeCrypto = tryRequireNode('crypto') as {
          randomBytes: (size: number) => Uint8Array
        } | null
        if (nodeCrypto) {
          r = nodeCrypto.randomBytes(1)[0] & 0xf
        } else {
          throw new Error('Node crypto not available')
        }
      } else if (
        window.crypto &&
        typeof window.crypto.getRandomValues === 'function'
      ) {
        const arr = new Uint8Array(1)
        window.crypto.getRandomValues(arr)
        if (arr?.[0] !== undefined) {
          r = arr[0] & 0xf
        } else {
          throw new Error('Failed to generate secure random bytes')
        }
      } else {
        throw new Error('Secure random not available in browser environment')
      }
    } catch {
      throw new Error('Failed to generate secure random for UUID')
    }
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

