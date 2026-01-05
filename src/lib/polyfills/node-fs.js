/**
 * Polyfill for node:fs module
 */

export function readFile() {
  return Promise.resolve('')
}

export function readFileSync() {
  return ''
}

export function writeFile() {
  return Promise.resolve()
}

export function writeFileSync() {}

export function existsSync() {
  return false
}

export function createReadStream() {
  throw new Error('Not implemented')
}

export function readdir() {
  return Promise.resolve([])
}

export const promises = {
  readFile: () => Promise.resolve(''),
  writeFile: () => Promise.resolve(),
  readdir: () => Promise.resolve([]),
}

export default {
  readFile,
  readFileSync,
  writeFile,
  writeFileSync,
  existsSync,
  createReadStream,
  readdir,
  promises,
}
