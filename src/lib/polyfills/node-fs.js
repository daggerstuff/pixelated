/**
 * Polyfill for node:fs module
 */

export async function readFile() {
  return Promise.resolve('')
}

export function readFileSync() {
  return ''
}

export async function writeFile() {
  return Promise.resolve()
}

export function writeFileSync() {}

export function existsSync() {
  return false
}

export function createReadStream() {
  throw new Error('Not implemented')
}

export async function readdir() {
  return Promise.resolve([])
}

export const promises = {
  readFile: async () => Promise.resolve(''),
  writeFile: async () => Promise.resolve(),
  readdir: async () => Promise.resolve([]),
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
