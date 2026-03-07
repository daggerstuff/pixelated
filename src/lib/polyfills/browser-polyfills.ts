/**
 * Browser-compatible polyfills for Node.js modules
 * This file provides browser-friendly versions of Node.js modules
 * that are being used in browser code.
 */

// Process polyfill
export const process = {
  env: {
    NODE_ENV: import.meta.env.MODE || 'development',
    // Add any other environment variables needed in browser context
    BROWSER: 'true',
  },
  nextTick: (callback: (...args: unknown[]) => void, ...args: unknown[]) => {
    setTimeout(() => callback(...args), 0)
  },
  // Add platform info for compatibility checks
  platform: 'browser',
  version: '16.0.0', // Mock version
  versions: {
    node: '16.0.0',
  },
}

// MongoDB polyfill (stub implementation for client-side)
export const mongodb = {
  ObjectId: class MockObjectId {
    id: string
    constructor(id?: string) {
      this.id = id || 'mock-object-id'
    }
    toString() {
      return this.id
    }
    toHexString() {
      return this.id
    }
    static isValid(id: string) {
      return (
        typeof id === 'string' &&
        id.length === 24 &&
        /^[a-fA-F0-9]{24}$/.test(id)
      )
    }
  },
  MongoClient: class MockMongoClient {
    static connect() {
      console.warn('MongoDB is not supported in browser environment')
      throw new Error('MongoDB is not supported in browser environment')
    }
    connect() {
      console.warn('MongoDB is not supported in browser environment')
      throw new Error('MongoDB is not supported in browser environment')
    }
  },
  Collection: function MockCollection() {
    console.warn('MongoDB Collection is not supported in browser environment')
  },
  Db: function MockDb() {
    console.warn('MongoDB Db is not supported in browser environment')
  },
}

// Named export for MongoDB ObjectId
export const { ObjectId } = mongodb

// Crypto polyfill (using Web Crypto API)
export const crypto = {
  randomUUID: () => {
    // Use the Web Crypto API if available
    if (
      typeof window !== 'undefined' &&
      window.crypto &&
      window.crypto.randomUUID
    ) {
      return window.crypto.randomUUID()
    }

    // Fallback implementation
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0
      const v = c === 'x' ? r : (r & 0x3) | 0x8
      return v.toString(16)
    })
  },

  // Add other crypto methods as needed
  createHash: (_algorithm: string) => {
    console.warn(
      'crypto.createHash is not fully supported in browser environment',
    )
    return {
      update: (data: string) => ({
        digest: (_encoding: string) =>
          `browser-polyfill-hash-${data.substring(0, 8)}`,
      }),
    }
  },

  // Add subtle crypto API for modern browsers
  subtle:
    typeof window !== 'undefined' && window.crypto
      ? window.crypto.subtle
      : {
          digest: async (_algorithm: string, _data: BufferSource) => {
            console.warn(
              'crypto.subtle.digest fallback used - limited functionality',
            )
            return new Uint8Array(32) // Return dummy hash
          },
        },

  // Add randomBytes implementation
  randomBytes: (size: number) => {
    if (typeof window !== 'undefined' && window.crypto) {
      const bytes = new Uint8Array(size)
      window.crypto.getRandomValues(bytes)
      return {
        toString: (encoding?: string) => {
          if (encoding === 'hex') {
            return Array.from(bytes)
              .map((b) => b.toString(16).padStart(2, '0'))
              .join('')
          }
          return String.fromCharCode.apply(null, Array.from(bytes))
        },
      }
    }

    // Fallback
    const result = new Uint8Array(size)
    for (let i = 0; i < size; i++) {
      result[i] = Math.floor(Math.random() * 256)
    }
    return {
      toString: (encoding?: string) => {
        if (encoding === 'hex') {
          return Array.from(result)
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('')
        }
        return String.fromCharCode.apply(null, Array.from(result))
      },
    }
  },
}

// Path polyfill with basic functionality
export const path = {
  join: (...paths: string[]) => paths.join('/').replace(/\/+/g, '/'),
  resolve: (...paths: string[]) => paths.join('/').replace(/\/+/g, '/'),
  basename: (path: string) => path.split('/').pop() || '',
  dirname: (path: string) => {
    const parts = path.split('/')
    parts.pop()
    return parts.join('/') || '.'
  },
  extname: (path: string) => {
    const match = /\.[^.]+$/.exec(path)
    return match ? match[0] : ''
  },
  sep: '/',
  delimiter: ':',
  parse: (pathString: string) => {
    const basename = pathString.split('/').pop() || ''
    const extname = basename.includes('.')
      ? '.' + basename.split('.').pop()
      : ''
    const name = extname ? basename.slice(0, -extname.length) : basename

    return {
      root: pathString.startsWith('/') ? '/' : '',
      dir: pathString.split('/').slice(0, -1).join('/'),
      base: basename,
      ext: extname,
      name: name,
    }
  },
  format: (pathObject: Record<string, string | undefined>) => {
    const { dir, root, base, name, ext } = pathObject
    const rootPath = dir || root || ''
    const fileName = base || name + (ext || '')
    return rootPath ? `${rootPath}/${fileName}` : fileName
  },
}

// FS promises polyfill (stub implementation)
export const fs = {
  promises: {
    readFile: async (path: string, _options?: unknown) => {
      console.warn(
        `fs.promises.readFile called with path: ${path} - not supported in browser`,
      )
      throw new Error(
        'fs.promises.readFile is not supported in browser environment',
      )
    },
    writeFile: async (path: string, _data: unknown, _options?: unknown) => {
      console.warn(
        `fs.promises.writeFile called with path: ${path} - not supported in browser`,
      )
      throw new Error(
        'fs.promises.writeFile is not supported in browser environment',
      )
    },
    mkdir: async (path: string, _options?: unknown) => {
      console.warn(
        `fs.promises.mkdir called with path: ${path} - not supported in browser`,
      )
      throw new Error(
        'fs.promises.mkdir is not supported in browser environment',
      )
    },
    stat: async (path: string) => {
      console.warn(
        `fs.promises.stat called with path: ${path} - not supported in browser`,
      )
      throw new Error(
        'fs.promises.stat is not supported in browser environment',
      )
    },
    access: async (path: string, _mode?: number) => {
      console.warn(
        `fs.promises.access called with path: ${path} - not supported in browser`,
      )
      throw new Error(
        'fs.promises.access is not supported in browser environment',
      )
    },
  },
  readFileSync: (path: string, _options?: unknown) => {
    console.warn(
      `fs.readFileSync called with path: ${path} - not supported in browser`,
    )
    throw new Error('fs.readFileSync is not supported in browser environment')
  },
  existsSync: (path: string) => {
    console.warn(
      `fs.existsSync called with path: ${path} - not supported in browser`,
    )
    return false
  },
}

// Child process polyfill (stub implementation)
export const child_process = {
  spawn: (command: string, _args?: string[], _options?: unknown) => {
    console.warn(
      `child_process.spawn called with command: ${command} - not supported in browser`,
    )
    return {
      on: (_event: string, _callback: (...args: unknown[]) => void) => {},
      stdout: {
        on: (_event: string, _callback: (...args: unknown[]) => void) => {},
        pipe: (destination: unknown) => destination,
      },
      stderr: {
        on: (_event: string, _callback: (...args: unknown[]) => void) => {},
        pipe: (destination: unknown) => destination,
      },
      kill: () => {},
    }
  },
  exec: (
    command: string,
    _options?: unknown,
    callback?: (...args: unknown[]) => void,
  ) => {
    console.warn(
      `child_process.exec called with command: ${command} - not supported in browser`,
    )
    if (callback) {
      callback(
        new Error('child_process.exec is not supported in browser environment'),
        '',
        '',
      )
    }
    throw new Error(
      'child_process.exec is not supported in browser environment',
    )
  },
  execSync: (command: string, _options?: unknown) => {
    console.warn(
      `child_process.execSync called with command: ${command} - not supported in browser`,
    )
    throw new Error(
      'child_process.execSync is not supported in browser environment',
    )
  },
}

// Stream polyfill (minimal implementation)
export const stream = {
  Readable: class {
    on(_event: string, _listener: (...args: unknown[]) => void) {
      return this
    }
    pipe(destination: unknown): void {
      return destination
    }
    read() {
      return null
    }
  },
  Writable: class {
    on(_event: string, _listener: (...args: unknown[]) => void) {
      return this
    }
    write(_chunk: unknown): void {
      return true
    }
    end() {}
  },
  Transform: class {
    on(_event: string, _listener: (...args: unknown[]) => void) {
      return this
    }
    write(_chunk: unknown): void {
      return true
    }
    end() {}
    pipe(destination: unknown): void {
      return destination
    }
  },
}

// Events polyfill
export const events = {
  EventEmitter: class {
    private listeners: Record<string, ((...args: unknown[]) => void)[]> = {}

    on(event: string, listener: (...args: unknown[]) => void) {
      if (!this.listeners[event]) {
        this.listeners[event] = []
      }
      this.listeners[event].push(listener)
      return this
    }

    emit(event: string, ...args: unknown[]): void {
      if (!this.listeners[event]) {
        return false
      }
      this.listeners[event].forEach((listener) => listener(...args))
      return true
    }

    removeListener(event: string, listener: (...args: unknown[]) => void) {
      if (!this.listeners[event]) {
        return this
      }
      this.listeners[event] = this.listeners[event].filter(
        (l) => l !== listener,
      )
      return this
    }

    once(event: string, listener: (...args: unknown[]) => void) {
      const onceWrapper = (...args: unknown[]) => {
        listener(...args)
        this.removeListener(event, onceWrapper)
      }
      return this.on(event, onceWrapper)
    }
  },
}

// Util polyfill
export const util = {
  promisify: (fn: (...args: unknown[]) => unknown) => {
    return (...args: unknown[]) => {
      return new Promise((resolve, reject) => {
        fn(...args, (err: Error | null, ...results: unknown[]) => {
          if (err) {
            return reject(err)
          }
          if (results.length === 1) {
            return resolve(results[0])
          }
          resolve(results)
        })
      })
    }
  },
  inspect: (obj: unknown) => JSON.stringify(obj, null, 2),
  types: {
    isPromise: (value: unknown): value is Promise<unknown> =>
      value instanceof Promise,
    isDate: (value: unknown): value is Date => value instanceof Date,
    isRegExp: (value: unknown): value is RegExp => value instanceof RegExp,
  },
}

// OS polyfill
export const os = {
  platform: () => 'browser',
  arch: () => 'wasm32',
  cpus: () => [],
  totalmem: () => 8 * 1024 * 1024 * 1024, // 8GB mock
  freemem: () => 4 * 1024 * 1024 * 1024, // 4GB mock
  tmpdir: () => '/tmp',
  EOL: '\n',
}

// HTTP polyfill (minimal implementation)
export const http = {
  createServer: () => {
    console.warn('http.createServer is not supported in browser environment')
    return {
      listen: () => {},
      on: () => {},
    }
  },
  request: (_options: unknown, callback?: (...args: unknown[]) => void) => {
    console.warn('http.request is not supported in browser environment')
    if (callback) {
      callback(new Error('http.request not supported'))
    }
    return {
      on: (_event: string, _cb: (...args: unknown[]) => void) => {
        return {}
      },
      write: (_chunk: unknown) => {},
      end: () => {},
    }
  },
}

// HTTPS polyfill (minimal implementation)
export const https = {
  createServer: () => {
    console.warn('https.createServer is not supported in browser environment')
    return {
      listen: () => {},
      on: () => {},
    }
  },
  request: (_options: unknown, callback?: (...args: unknown[]) => void) => {
    console.warn('https.request is not supported in browser environment')
    if (callback) {
      callback(new Error('https.request not supported'))
    }
    return {
      on: (_event: string, _cb: (...args: unknown[]) => void) => {
        return {}
      },
      write: (_chunk: unknown) => {},
      end: () => {},
    }
  },
}

// Default export for all polyfills
export default {
  process,
  crypto,
  path,
  fs,
  child_process,
  stream,
  events,
  util,
  os,
  http,
  https,
}
