/**
 * Polyfill for node:path module
 */

export function join(...parts) {
  return parts.join('/').replace(/\/+/g, '/')
}

export function dirname(p) {
  return p.split('/').slice(0, -1).join('/') || '.'
}

export function basename(p, ext) {
  const base = p.split('/').pop() || ''
  return ext && base.endsWith(ext) ? base.slice(0, -ext.length) : base
}

export function extname(p) {
  const base = p.split('/').pop() || ''
  const idx = base.lastIndexOf('.')
  return idx !== -1 ? base.slice(idx) : ''
}

export const sep = '/'
export const delimiter = ':'
export const posix = { join, dirname, basename, extname, sep, delimiter }
export const win32 = {
  join,
  dirname,
  basename,
  extname,
  sep: '\\',
  delimiter: ';',
}

export default {
  join,
  dirname,
  basename,
  extname,
  sep,
  delimiter,
  posix,
  win32,
}
