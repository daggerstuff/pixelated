/**
 * Polyfill for node:zlib module
 */

export function createGzip() {
  throw new Error('zlib not supported in browser')
}

export function createGunzip() {
  throw new Error('zlib not supported in browser')
}

export function createDeflate() {
  throw new Error('zlib not supported in browser')
}

export function createInflate() {
  throw new Error('zlib not supported in browser')
}

export async function gzip() {
  return Promise.resolve(new Uint8Array())
}

export async function gunzip() {
  return Promise.resolve(new Uint8Array())
}

export async function deflate() {
  return Promise.resolve(new Uint8Array())
}

export async function inflate() {
  return Promise.resolve(new Uint8Array())
}

export default {
  createGzip,
  createGunzip,
  createDeflate,
  createInflate,
  gzip,
  gunzip,
  deflate,
  inflate,
}
