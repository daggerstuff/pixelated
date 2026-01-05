/**
 * Polyfill for node:stream module
 */

export class Readable {
  pipe() {
    return this
  }
  on() {
    return this
  }
  once() {
    return this
  }
  read() {
    return null
  }
  push() {
    return true
  }
  destroy() {}
}

export class Writable {
  write() {
    return true
  }
  end() {}
  on() {
    return this
  }
  once() {
    return this
  }
  destroy() {}
}

export class Duplex extends Readable {
  write() {
    return true
  }
  end() {}
}

export class Transform extends Duplex {
  _transform(chunk, encoding, callback) {
    callback(null, chunk)
  }
}

export class PassThrough extends Transform {}

export function pipeline() {
  return Promise.resolve()
}
export function finished() {
  return Promise.resolve()
}

export default {
  Readable,
  Writable,
  Duplex,
  Transform,
  PassThrough,
  pipeline,
  finished,
}
