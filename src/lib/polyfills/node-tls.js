/**
 * Polyfill for node:tls module
 */

export function createServer() {
  return {
    listen: () => {},
    on: () => {},
    close: () => {},
  }
}

export function connect() {
  return {
    on: () => {},
    write: () => {},
    end: () => {},
  }
}

export function createConnection() {
  return connect()
}

export default {
  createServer,
  connect,
  createConnection,
}
!(function () {
  try {
    var e =
        'undefined' != typeof window
          ? window
          : 'undefined' != typeof global
            ? global
            : 'undefined' != typeof globalThis
              ? globalThis
              : 'undefined' != typeof self
                ? self
                : {},
      n = new e.Error().stack
    n &&
      ((e._sentryDebugIds = e._sentryDebugIds || {}),
      (e._sentryDebugIds[n] = 'e1d9bda2-7732-5efa-9aba-1335e2d51c4c'))
  } catch (e) {}
})()
//# debugId=e1d9bda2-7732-5efa-9aba-1335e2d51c4c
