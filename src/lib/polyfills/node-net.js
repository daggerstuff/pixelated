/**
 * Polyfill for node:net module
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
      (e._sentryDebugIds[n] = '9efc4c05-f9eb-5fc8-b1d6-84263e6e1224'))
  } catch (e) {}
})()
//# debugId=9efc4c05-f9eb-5fc8-b1d6-84263e6e1224
