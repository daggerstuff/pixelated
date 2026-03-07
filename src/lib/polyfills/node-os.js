/**
 * Polyfill for node:os module
 */

export function hostname() {
  return 'browser'
}

export function platform() {
  return 'browser'
}

export function release() {
  return '1.0.0'
}

export function type() {
  return 'Browser'
}

export function uptime() {
  return 0
}

export function totalmem() {
  return 0
}

export function freemem() {
  return 0
}

export function cpus() {
  return []
}

export default {
  hostname,
  platform,
  release,
  type,
  uptime,
  totalmem,
  freemem,
  cpus,
}
