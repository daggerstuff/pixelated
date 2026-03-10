/**
 * Polyfill for node:http module
 */

export function createServer() {
  return {
    listen: () => {},
    on: () => {},
    close: () => {},
  }
}

export function request() {
  return {
    on: () => {},
    write: () => {},
    end: () => {},
  }
}

export function get() {
  return {
    on: () => {},
    end: () => {},
  }
}

export default {
  createServer,
  request,
  get,
}
