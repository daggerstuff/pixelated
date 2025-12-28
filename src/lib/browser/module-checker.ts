/**
 * Module Checker
 *
 * Utility to safely check for and import Node.js modules in a way that's
 * compatible with both server and browser environments.
 *
 * This helps prevent errors during build time when Node.js-specific modules
 * are imported in browser code.
 */

/**
 * Check if we're in a browser environment
 */
export const isBrowser =
  typeof window !== 'undefined' && typeof document !== 'undefined'

/**
 * Check if a specific Node.js module is available
 *
 * @param moduleName The name of the module to check
 * @returns Promise resolving to true if the module is available, false otherwise
 */
export async function isModuleAvailable(moduleName: string): Promise<boolean> {
  if (isBrowser) {
    // Browser environment - Node.js modules are never available
    return false
  }

  try {
    // In Node.js, attempt to dynamically import the module
    await import(moduleName)
    return true
  } catch {
    return false
  }
}

/**
 * Safely import a Node.js module
 *
 * @param moduleName The name of the module to import
 * @returns Promise resolving to the module if available, null otherwise
 */
export async function safeImport<T = unknown>(
  moduleName: string,
): Promise<T | null> {
  if (isBrowser) {
    // Browser environment - return null for Node.js modules
    return null
  }

  try {
    // In Node.js, attempt to dynamically import the module
    const module = await import(moduleName)
    return module.default || module
  } catch (error: unknown) {
    console.warn(`Module ${moduleName} is not available:`, error)
    return null
  }
}

/**
 * Common Node.js modules that might be used in the application
 */
export const NodeModules = {
  fs: 'fs/promises',
  fsSync: 'fs',
  path: 'path',
  crypto: 'crypto',
  http: 'http',
  https: 'https',
  zlib: 'zlib',
  util: 'util',
  os: 'os',
  stream: 'stream',
  child_process: 'child_process',
  buffer: 'buffer',
  events: 'events',
}

/**
 * Import common Node.js modules safely all at once
 *
 * @returns Promise resolving to an object with all available modules
 */
export async function importCommonModules() {
  if (isBrowser) {
    // In browser, return empty objects for all modules
    return Object.fromEntries(Object.keys(NodeModules).map((key) => [key, {}]))
  }

  const modules: Record<string, unknown> = {}

  // Import each module in parallel
  const imports = Object.entries(NodeModules).map(async ([key, name]) => {
    modules[key] = await safeImport(name)
  })

  await Promise.all(imports)
  return modules
}

export default {
  isBrowser,
  isModuleAvailable,
  safeImport,
  NodeModules,
  importCommonModules,
}
