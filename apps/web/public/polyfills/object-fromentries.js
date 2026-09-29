// Object.fromEntries polyfill
if (!Object.fromEntries) {
  Object.fromEntries = function fromEntries(entries) {
    if (!entries || typeof entries[Symbol.iterator] !== 'function') {
      throw new Error('Object.fromEntries requires a single iterable argument')
    }
    const obj = {}
    for (const [key, value] of entries) {
      obj[key] = value
    }
    return obj
  }
}
