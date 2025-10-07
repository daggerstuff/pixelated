/**
 * Node.js built-in modules polyfills for browser/edge environments
 * This file provides safe fallbacks for Node.js built-ins to prevent bundling errors
 */

// Async Hooks polyfill
export const AsyncLocalStorage = class {
  constructor() {
    this.store = new Map()
  }

  run(store, callback, ...args) {
    return callback(...args)
  }

  getStore() {
    return undefined
  }

  enterWith(_store) {
    // No-op in browser environment
  }

  exit(callback, ...args) {
    return callback(...args)
  }
}

export const executionAsyncId = () => 0
export const triggerAsyncId = () => 0
export const createHook = () => ({
  enable: () => {},
  disable: () => {},
})

// Crypto polyfill
export const createHash = () => ({
  update: () => ({}),
  digest: () => '',
})

export const createHmac = () => ({
  update: () => ({}),
  digest: () => '',
})

export const randomBytes = (size) => new Uint8Array(size)
export const pbkdf2 = () => {}
export const pbkdf2Sync = () => new Uint8Array(32)
export const scrypt = () => {}
export const scryptSync = () => new Uint8Array(32)

// Buffer polyfill
export const Buffer = globalThis.Buffer || {
  from: (data) => new Uint8Array(Array.isArray(data) ? data : []),
  alloc: (size) => new Uint8Array(size),
  allocUnsafe: (size) => new Uint8Array(size),
  isBuffer: () => false,
  concat: (list) => {
    const totalLength = list.reduce((acc, item) => acc + item.length, 0)
    const result = new Uint8Array(totalLength)
    let offset = 0
    for (const item of list) {
      result.set(item, offset)
      offset += item.length
    }
    return result
  },
}

// Events polyfill
export class EventEmitter {
  constructor() {
    this.events = new Map()
  }

  on(event, listener) {
    if (!this.events.has(event)) {
      this.events.set(event, [])
    }
    this.events.get(event).push(listener)
    return this
  }

  emit(event, ...args) {
    const listeners = this.events.get(event) || []
    listeners.forEach((listener) => listener(...args))
    return listeners.length > 0
  }

  removeListener(event, listener) {
    const listeners = this.events.get(event) || []
    const index = listeners.indexOf(listener)
    if (index > -1) {
      listeners.splice(index, 1)
    }
    return this
  }

  removeAllListeners(event) {
    if (event) {
      this.events.delete(event)
    } else {
      this.events.clear()
    }
    return this
  }
}

// Stream polyfill
export class Readable extends EventEmitter {
  constructor() {
    super()
    this.readable = true
  }

  read() {
    return null
  }

  pipe(destination) {
    return destination
  }
}

export class Writable extends EventEmitter {
  constructor() {
    super()
    this.writable = true
  }

  write(chunk, encoding, callback) {
    if (typeof encoding === 'function') {
      callback = encoding
    }
    if (callback) {
      callback()
    }
    return true
  }

  end(chunk, encoding, callback) {
    if (typeof chunk === 'function') {
      callback = chunk
    } else if (typeof encoding === 'function') {
      callback = encoding
    }
    if (callback) {
      callback()
    }
  }
}

// Process polyfill
export const process = globalThis.process || {
  env: {},
  cwd: () => '/',
  chdir: () => {},
  platform: 'browser',
  arch: 'unknown',
  version: 'v18.0.0',
  versions: { node: '18.0.0' },
  nextTick: (callback, ...args) => {
    if (typeof setImmediate !== 'undefined') {
      setImmediate(callback, ...args)
    } else {
      setTimeout(callback, 0, ...args)
    }
  },
  exit: () => {},
  stderr: { write: () => {} },
  stdout: { write: () => {} },
  stdin: { read: () => null },
}

// Path polyfill
export const path = {
  join: (...paths) => paths.filter(Boolean).join('/').replace(/\/+/g, '/'),
  resolve: (...paths) =>
    '/' + paths.filter(Boolean).join('/').replace(/\/+/g, '/'),
  dirname: (p) => p.split('/').slice(0, -1).join('/') || '/',
  basename: (p, ext) => {
    const name = p.split('/').pop() || ''
    return ext && name.endsWith(ext) ? name.slice(0, -ext.length) : name
  },
  extname: (p) => {
    const name = p.split('/').pop() || ''
    const dotIndex = name.lastIndexOf('.')
    return dotIndex > 0 ? name.slice(dotIndex) : ''
  },
  isAbsolute: (p) => p.startsWith('/'),
  relative: () => '',
  sep: '/',
  delimiter: ':',
  parse: (p) => ({
    root: p.startsWith('/') ? '/' : '',
    dir: p.split('/').slice(0, -1).join('/') || '/',
    base: p.split('/').pop() || '',
    ext: '',
    name: '',
  }),
}

// File system polyfill
export const fs = {
  readFile: () => Promise.resolve(''),
  readFileSync: () => '',
  writeFile: () => Promise.resolve(),
  writeFileSync: () => {},
  existsSync: () => false,
  statSync: () => ({ isDirectory: () => false, isFile: () => false }),
  stat: () =>
    Promise.resolve({ isDirectory: () => false, isFile: () => false }),
  mkdir: () => Promise.resolve(),
  mkdirSync: () => {},
  readdir: () => Promise.resolve([]),
  readdirSync: () => [],
}

// Utilities polyfill
export const util = {
  promisify:
    (fn) =>
    (...args) =>
      Promise.resolve(fn(...args)),
  inspect: (obj) => JSON.stringify(obj),
  format: (f, ...args) => f.replace(/%[sdj%]/g, (_x) => args.shift()),
  inherits: () => {},
  isDeepStrictEqual: () => false,
  types: {
    isTypedArray: () => false,
    isArrayBuffer: () => false,
  },
}

// OS polyfill
export const os = {
  platform: () => 'browser',
  arch: () => 'unknown',
  release: () => '0.0.0',
  hostname: () => 'localhost',
  type: () => 'Browser',
  cpus: () => [],
  totalmem: () => 0,
  freemem: () => 0,
  loadavg: () => [0, 0, 0],
  networkInterfaces: () => ({}),
  homedir: () => '/',
  tmpdir: () => '/tmp',
}

// HTTP/HTTPS polyfill
export const http = {
  createServer: () => ({
    listen: () => {},
    on: () => {},
  }),
  request: () => ({
    on: () => {},
    write: () => {},
    end: () => {},
  }),
}

export const https = {
  ...http,
  request: () => ({
    on: () => {},
    write: () => {},
    end: () => {},
  }),
}

// Default export for compatibility
export default {
  AsyncLocalStorage,
  executionAsyncId,
  triggerAsyncId,
  createHook,
  createHash,
  createHmac,
  randomBytes,
  pbkdf2,
  pbkdf2Sync,
  scrypt,
  scryptSync,
  Buffer,
  EventEmitter,
  Readable,
  Writable,
  process,
  path,
  fs,
  util,
  os,
  http,
  https,
}
