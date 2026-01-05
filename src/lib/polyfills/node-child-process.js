/**
 * Polyfill for node:child_process module
 */

export function exec() {
  throw new Error('Not supported in browser environment')
}

export function execFile() {
  throw new Error('Not supported in browser environment')
}

export function spawn() {
  throw new Error('Not supported in browser environment')
}

export function fork() {
  throw new Error('Not supported in browser environment')
}

export default {
  exec,
  execFile,
  spawn,
  fork,
}
