export default function BufferPolyfill(arg, encodingOrOffset, length) {
  if (!(this instanceof BufferPolyfill)) {
    return new BufferPolyfill(arg, encodingOrOffset, length)
  }

  if (typeof arg === 'string') {
    const encoder = new TextEncoder()
    this._data = encoder.encode(arg)
  } else if (Array.isArray(arg) || arg instanceof Uint8Array) {
    this._data = new Uint8Array(arg)
  } else if (arg instanceof ArrayBuffer) {
    this._data = new Uint8Array(arg)
  } else if (typeof arg === 'number') {
    this._data = new Uint8Array(arg)
  } else {
    this._data = new Uint8Array(0)
  }
}

BufferPolyfill.prototype.toString = function (encoding) {
  const decoder = new TextDecoder(encoding || 'utf-8')
  return decoder.decode(this._data)
}

BufferPolyfill.prototype.slice = function (start, end) {
  return new BufferPolyfill(this._data.slice(start, end))
}

BufferPolyfill.from = function (data, encodingOrOffset, length) {
  return new BufferPolyfill(data, encodingOrOffset, length)
}

BufferPolyfill.alloc = function (size, fill) {
  const buffer = new BufferPolyfill(new Uint8Array(size))
  if (fill !== undefined) {
    const fillValue =
      typeof fill === 'string'
        ? new TextEncoder().encode(fill)[0]
        : typeof fill === 'number'
          ? fill
          : 0
    for (let i = 0; i < size; i++) {
      buffer._data[i] = fillValue
    }
  }
  return buffer
}

BufferPolyfill.isBuffer = function (obj) {
  return obj instanceof BufferPolyfill
}
