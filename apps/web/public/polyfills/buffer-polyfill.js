// Buffer polyfill for browsers
(function() {
  // Only create Buffer polyfill if it doesn't already exist
  if (typeof window !== 'undefined' && typeof Buffer === 'undefined') {
    window.Buffer = {
      from: function(data, encoding) {
        if (typeof data === 'string') {
          if (encoding === 'base64') {
            const binary = atob(data);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
              bytes[i] = binary.charCodeAt(i);
            }
            return bytes;
          } else {
            // Default to utf8
            return new TextEncoder().encode(data);
          }
        } else if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
          return new Uint8Array(data);
        } else {
          throw new Error('Buffer.from: Unsupported data type');
        }
      },
      alloc: function(size, fill = 0) {
        const buffer = new Uint8Array(size);
        if (fill !== 0) {
          buffer.fill(fill);
        }
        return buffer;
      },
      isBuffer: function(obj) {
        return obj instanceof Uint8Array;
      }
    };

    // Add toString method for compatibility
    window.Buffer.prototype = {
      toString: function(encoding) {
        if (this instanceof Uint8Array) {
          if (encoding === 'base64') {
            let binary = '';
            const bytes = new Uint8Array(this);
            for (let i = 0; i < bytes.byteLength; i++) {
              binary += String.fromCharCode(bytes[i]);
            }
            return btoa(binary);
          } else {
            // Default to utf8
            return new TextDecoder().decode(this);
          }
        }
        return '';
      }
    };
  }
})();
