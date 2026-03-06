(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
    typeof define === 'function' && define.amd ? define(['exports'], factory) :
      (factory((global.WHATWGFetch = {})));
}(this, (function (exports) {
  'use strict';

  /* eslint-disable no-prototype-builtins */
  const g =
    (typeof globalThis !== 'undefined' && globalThis) ||
    (typeof self !== 'undefined' && self) ||
    // eslint-disable-next-line no-undef
    (typeof global !== 'undefined' && global) ||
    {};

  const support = {
    searchParams: 'URLSearchParams' in g,
    iterable: 'Symbol' in g && 'iterator' in Symbol,
    blob:
      'FileReader' in g &&
      'Blob' in g &&
      (function () {
        try {
          new Blob();
          return true
        } catch (e) {
          return false
        }
      })(),
    formData: 'FormData' in g,
    arrayBuffer: 'ArrayBuffer' in g
  };

  const isDataView = function (obj) {
    return obj && DataView.prototype.isPrototypeOf(obj)
  };

  let isArrayBufferView;

  if (support.arrayBuffer) {
    const viewClasses = [
      '[object Int8Array]',
      '[object Uint8Array]',
      '[object Uint8ClampedArray]',
      '[object Int16Array]',
      '[object Uint16Array]',
      '[object Int32Array]',
      '[object Uint32Array]',
      '[object Float32Array]',
      '[object Float64Array]'
    ];

    isArrayBufferView =
      ArrayBuffer.isView
        ? function (obj) { return ArrayBuffer.isView(obj) }
        : function (obj) {
          return obj && viewClasses.indexOf(Object.prototype.toString.call(obj)) > -1
        };
  }

  const normalizeName = function (name) {
    const stringName = typeof name !== 'string' ? String(name) : name;
    if (/[^a-z0-9\-#$%&'*+.^_`|~!]/i.test(stringName) || stringName === '') {
      throw new TypeError(`Invalid character in header field name: "${stringName}"`)
    }
    return stringName.toLowerCase()
  };

  const normalizeValue = function (value) {
    return typeof value !== 'string' ? String(value) : value
  };

  // Build a destructive iterator for the value list
  const iteratorFor = function (items) {
    const iterator = {
      next: function () {
        const itemValue = items.shift();
        return { done: itemValue === undefined, value: itemValue }
      }
    };

    if (support.iterable) {
      iterator[Symbol.iterator] = function () {
        return iterator
      };
    }

    return iterator
  };

  const Headers = function (headers) {
    this.map = {};

    if (headers instanceof Headers) {
      headers.forEach(function (value, name) {
        this.append(name, value);
      }, this);
    } else if (Array.isArray(headers)) {
      headers.forEach(function (header) {
        if (header.length != 2) {
          throw new TypeError('Headers constructor: expected name/value pair to be length 2, found' + header.length)
        }
        this.append(header[0], header[1]);
      }, this);
    } else if (headers) {
      Object.getOwnPropertyNames(headers).forEach(function (name) {
        this.append(name, headers[name]);
      }, this);
    }
  };

  Headers.prototype.append = function (name, value) {
    const normalizedName = normalizeName(name);
    const normalizedValue = normalizeValue(value);
    const oldValue = this.map[normalizedName];
    this.map[normalizedName] = oldValue ? oldValue + ', ' + normalizedValue : normalizedValue;
  };

  Headers.prototype['delete'] = function (name) {
    delete this.map[normalizeName(name)];
  };

  Headers.prototype.get = function (name) {
    const normalizedName = normalizeName(name);
    return this.has(normalizedName) ? this.map[normalizedName] : null
  };

  Headers.prototype.has = function (name) {
    return this.map.hasOwnProperty(normalizeName(name))
  };

  Headers.prototype.set = function (name, value) {
    this.map[normalizeName(name)] = normalizeValue(value);
  };

  Headers.prototype.forEach = function (callback, thisArg) {
    for (const name in this.map) {
      if (this.map.hasOwnProperty(name)) {
        callback.call(thisArg, this.map[name], name, this);
      }
    }
  };

  Headers.prototype.keys = function () {
    const items = [];
    this.forEach(function (value, name) {
      items.push(name);
    });
    return iteratorFor(items)
  };

  Headers.prototype.values = function () {
    const items = [];
    this.forEach(function (value) {
      items.push(value);
    });
    return iteratorFor(items)
  };

  Headers.prototype.entries = function () {
    const items = [];
    this.forEach(function (value, name) {
      items.push([name, value]);
    });
    return iteratorFor(items)
  };

  if (support.iterable) {
    Headers.prototype[Symbol.iterator] = Headers.prototype.entries;
  }

  const consumed = function (body) {
    if (body._noBody) {
      return
    }
    if (body.bodyUsed) {
      return Promise.reject(new TypeError('Already read'))
    }
    body.bodyUsed = true;
  };

  const fileReaderReady = function (reader) {
    return new Promise(function (resolve, reject) {
      reader.onload = function () {
        resolve(reader.result);
      };
      reader.onerror = function () {
        reject(reader.error);
      };
    })
  };

  const readBlobAsArrayBuffer = function (blob) {
    const reader = new FileReader();
    const promise = fileReaderReady(reader);
    reader.readAsArrayBuffer(blob);
    return promise
  };

  const readBlobAsText = function (blob) {
    const reader = new FileReader();
    const promise = fileReaderReady(reader);
    const match = /charset=([A-Za-z0-9_-]+)/.exec(blob.type);
    const encoding = match ? match[1] : 'utf-8';
    reader.readAsText(blob, encoding);
    return promise
  };

  const readArrayBufferAsText = function (buf) {
    const view = new Uint8Array(buf);
    const chars = new Array(view.length);

    for (let i = 0; i < view.length; i++) {
      chars[i] = String.fromCharCode(view[i]);
    }
    return chars.join('')
  };

  const bufferClone = function (buf) {
    if (buf.slice) {
      return buf.slice()
    } else {
      const view = new Uint8Array(buf.byteLength);
      view.set(new Uint8Array(buf));
      return view.buffer
    }
  };

  const Body = function () {
    this.bodyUsed = false;

    this._initBody = function (body) {
      /*
        fetch-mock wraps the Response object in an ES6 Proxy to
        provide useful test harness features such as flush. However, on
        ES5 browsers without fetch or Proxy support pollyfills must be used;
        the proxy-pollyfill is unable to proxy an attribute unless it exists
        on the object before the Proxy is created. This change ensures
        Response.bodyUsed exists on the instance, while maintaining the
        semantic of setting Request.bodyUsed in the constructor before
        _initBody is called.
      */
      // eslint-disable-next-line no-self-assign
      ;
      this._bodyInit = body;
      let finalBody = body;
      if (!body) {
        this._noBody = true;
        this._bodyText = '';
        finalBody = '';
      } else if (typeof body === 'string') {
        this._bodyText = body;
      } else if (support.blob && Blob.prototype.isPrototypeOf(body)) {
        this._bodyBlob = body;
      } else if (support.formData && FormData.prototype.isPrototypeOf(body)) {
        this._bodyFormData = body;
      } else if (support.searchParams && URLSearchParams.prototype.isPrototypeOf(body)) {
        this._bodyText = body.toString();
        finalBody = this._bodyText;
      } else if (support.arrayBuffer && support.blob && isDataView(body)) {
        this._bodyArrayBuffer = bufferClone(body.buffer);
        // IE 10-11 can't handle a DataView body.
        this._bodyInit = new Blob([this._bodyArrayBuffer]);
      } else if (support.arrayBuffer && (ArrayBuffer.prototype.isPrototypeOf(body) || isArrayBufferView(body))) {
        this._bodyArrayBuffer = bufferClone(body);
      } else {
        finalBody = Object.prototype.toString.call(body);
        this._bodyText = finalBody;
      }

      if (!this.headers.get('content-type')) {
        if (typeof finalBody === 'string' && finalBody !== '') {
          this.headers.set('content-type', 'text/plain;charset=UTF-8');
        } else if (this._bodyBlob && this._bodyBlob.type) {
          this.headers.set('content-type', this._bodyBlob.type);
        } else if (support.searchParams && URLSearchParams.prototype.isPrototypeOf(body)) {
          this.headers.set('content-type', 'application/x-www-form-urlencoded;charset=UTF-8');
        }
      }
    };

    if (support.blob) {
      this.blob = function () {
        const rejected = consumed(this);
        if (rejected) {
          return rejected
        }

        if (this._bodyBlob) {
          return Promise.resolve(this._bodyBlob)
        } else if (this._bodyArrayBuffer) {
          return Promise.resolve(new Blob([this._bodyArrayBuffer]))
        } else if (this._bodyFormData) {
          throw new Error('could not read FormData body as blob')
        } else {
          return Promise.resolve(new Blob([this._bodyText]))
        }
      };
    }

    this.arrayBuffer = function () {
      if (this._bodyArrayBuffer) {
        const isConsumed = consumed(this);
        if (isConsumed) {
          return isConsumed
        } else if (ArrayBuffer.isView(this._bodyArrayBuffer)) {
          return Promise.resolve(
            this._bodyArrayBuffer.buffer.slice(
              this._bodyArrayBuffer.byteOffset,
              this._bodyArrayBuffer.byteOffset + this._bodyArrayBuffer.byteLength
            )
          )
        } else {
          return Promise.resolve(this._bodyArrayBuffer)
        }
      } else if (support.blob) {
        return this.blob().then(readBlobAsArrayBuffer)
      } else {
        throw new Error('could not read as ArrayBuffer')
      }
    };

    this.text = function () {
      const rejected = consumed(this);
      if (rejected) {
        return rejected
      }

      if (this._bodyBlob) {
        return readBlobAsText(this._bodyBlob)
      } else if (this._bodyArrayBuffer) {
        return Promise.resolve(readArrayBufferAsText(this._bodyArrayBuffer))
      } else if (this._bodyFormData) {
        throw new Error('could not read FormData body as text')
      } else {
        return Promise.resolve(this._bodyText)
      }
    };

    if (support.formData) {
      this.formData = function () {
        return this.text().then(decode)
      };
    }

    this.json = function () {
      return this.text().then(JSON.parse)
    };

    return this
  };

  // HTTP methods whose capitalization should be normalized
  const methods = ['CONNECT', 'DELETE', 'GET', 'HEAD', 'OPTIONS', 'PATCH', 'POST', 'PUT', 'TRACE'];

  const normalizeMethod = function (method) {
    const upcased = method.toUpperCase();
    return methods.indexOf(upcased) > -1 ? upcased : method
  };

  const Request = function (input, options) {
    if (!(this instanceof Request)) {
      throw new TypeError('Please use the "new" operator, this DOM object constructor cannot be called as a function.')
    }

    const requestOptions = options || {};
    let requestBody = requestOptions.body;

    if (input instanceof Request) {
      if (input.bodyUsed) {
        throw new TypeError('Already read')
      }
      this.url = input.url;
      this.credentials = input.credentials;
      if (!requestOptions.headers) {
        this.headers = new Headers(input.headers);
      }
      this.method = input.method;
      this.mode = input.mode;
      this.signal = input.signal;
      if (!requestBody && input._bodyInit != null) {
        requestBody = input._bodyInit;
        input.bodyUsed = true;
      }
    } else {
      this.url = String(input);
    }

    this.credentials = requestOptions.credentials || this.credentials || 'same-origin';
    if (requestOptions.headers || !this.headers) {
      this.headers = new Headers(requestOptions.headers);
    }
    this.method = normalizeMethod(requestOptions.method || this.method || 'GET');
    this.mode = requestOptions.mode || this.mode || null;
    this.signal = requestOptions.signal || this.signal || (function () {
      if ('AbortController' in g) {
        const ctrl = new AbortController();
        return ctrl.signal;
      }
    }());
    this.referrer = null;

    if ((this.method === 'GET' || this.method === 'HEAD') && requestBody) {
      throw new TypeError('Body not allowed for GET or HEAD requests')
    }
    this._initBody(requestBody);

    if ((this.method === 'GET' || this.method === 'HEAD') && (requestOptions.cache === 'no-store' || requestOptions.cache === 'no-cache')) {
      const reParamSearch = /([?&])_=[^&]*/;
      if (reParamSearch.test(this.url)) {
        // If it already exists then set the value with the current time
        this.url = this.url.replace(reParamSearch, '$1_=' + new Date().getTime());
      } else {
        // Otherwise add a new '_' parameter to the end with the current time
        const reQueryString = /\?/;
        this.url += (reQueryString.test(this.url) ? '&' : '?') + '_=' + new Date().getTime();
      }
    }
  };

  Request.prototype.clone = function () {
    return new Request(this, { body: this._bodyInit })
  };

  const decode = function (body) {
    const form = new FormData();
    body
      .trim()
      .split('&')
      .forEach(function (bytes) {
        if (bytes) {
          const split = bytes.split('=');
          const name = split.shift().replace(/\+/g, ' ');
          const value = split.join('=').replace(/\+/g, ' ');
          form.append(decodeURIComponent(name), decodeURIComponent(value));
        }
      });
    return form
  };

  const parseHeaders = function (rawHeaders) {
    const headers = new Headers();
    // Replace instances of \r\n and \n followed by at least one space or horizontal tab with a space
    // https://tools.ietf.org/html/rfc7230#section-3.2
    const preProcessedHeaders = rawHeaders.replace(/\r?\n[\t ]+/g, ' ');
    // Avoiding split via regex to work around a common IE11 bug with the core-js 3.6.0 regex polyfill
    // https://github.com/github/fetch/issues/748
    // https://github.com/zloirock/core-js/issues/751
    preProcessedHeaders
      .split('\r')
      .map(function (header) {
        return header.indexOf('\n') === 0 ? header.substr(1, header.length) : header
      })
      .forEach(function (line) {
        const parts = line.split(':');
        const key = parts.shift().trim();
        if (key) {
          const value = parts.join(':').trim();
          try {
            headers.append(key, value);
          } catch (error) {
            console.warn('Response ' + error.message);
          }
        }
      });
    return headers
  };

  Body.call(Request.prototype);

  const Response = function (bodyInit, options) {
    if (!(this instanceof Response)) {
      throw new TypeError('Please use the "new" operator, this DOM object constructor cannot be called as a function.')
    }
    const responseOptions = options || {};

    this.type = 'default';
    this.status = responseOptions.status === undefined ? 200 : responseOptions.status;
    if (this.status < 200 || this.status > 599) {
      throw new RangeError("Failed to construct 'Response': The status provided (0) is outside the range [200, 599].")
    }
    this.ok = this.status >= 200 && this.status < 300;
    this.statusText = responseOptions.statusText === undefined ? '' : '' + responseOptions.statusText;
    this.headers = new Headers(responseOptions.headers);
    this.url = responseOptions.url || '';
    this._initBody(bodyInit);
  };

  Body.call(Response.prototype);

  Response.prototype.clone = function () {
    return new Response(this._bodyInit, {
      status: this.status,
      statusText: this.statusText,
      headers: new Headers(this.headers),
      url: this.url
    })
  };

  Response.error = function () {
    const response = new Response(null, { status: 200, statusText: '' });
    response.ok = false;
    response.status = 0;
    response.type = 'error';
    return response
  };

  const redirectStatuses = [301, 302, 303, 307, 308];

  Response.redirect = function (url, status) {
    if (redirectStatuses.indexOf(status) === -1) {
      throw new RangeError('Invalid status code')
    }

    return new Response(null, { status: status, headers: { location: url } })
  };

  exports.DOMException = g.DOMException;
  try {
    new exports.DOMException();
  } catch (err) {
    exports.DOMException = function (message, name) {
      this.message = message;
      this.name = name;
      const error = Error(message);
      this.stack = error.stack;
    };
    exports.DOMException.prototype = Object.create(Error.prototype);
    exports.DOMException.prototype.constructor = exports.DOMException;
  }

  const fetch = function (input, init) {
    return new Promise(function (resolve, reject) {
      const request = new Request(input, init);

      if (request.signal && request.signal.aborted) {
        return reject(new exports.DOMException('Aborted', 'AbortError'))
      }

      const xhr = new XMLHttpRequest();

      const abortXhr = function () {
        xhr.abort();
      };

      xhr.onload = function () {
        const options = {
          statusText: xhr.statusText,
          headers: parseHeaders(xhr.getAllResponseHeaders() || '')
        };
        // This check if specifically for when a user fetches a file locally from the file system
        // Only if the status is out of a normal range
        if (request.url.indexOf('file://') === 0 && (xhr.status < 200 || xhr.status > 599)) {
          options.status = 200;
        } else {
          options.status = xhr.status;
        }
        options.url = 'responseURL' in xhr ? xhr.responseURL : options.headers.get('X-Request-URL');
        const body = 'response' in xhr ? xhr.response : xhr.responseText;
        setTimeout(function () {
          resolve(new Response(body, options));
        }, 0);
      };

      xhr.onerror = function () {
        setTimeout(function () {
          reject(new TypeError('Network request failed'));
        }, 0);
      };

      xhr.ontimeout = function () {
        setTimeout(function () {
          reject(new TypeError('Network request timed out'));
        }, 0);
      };

      xhr.onabort = function () {
        setTimeout(function () {
          reject(new exports.DOMException('Aborted', 'AbortError'));
        }, 0);
      };

      const fixUrl = function (url) {
        try {
          return url === '' && g.location.href ? g.location.href : url
        } catch (e) {
          return url
        }
      };

      xhr.open(request.method, fixUrl(request.url), true);

      if (request.credentials === 'include') {
        xhr.withCredentials = true;
      } else if (request.credentials === 'omit') {
        xhr.withCredentials = false;
      }

      if ('responseType' in xhr) {
        if (support.blob) {
          xhr.responseType = 'blob';
        } else if (
          support.arrayBuffer
        ) {
          xhr.responseType = 'arraybuffer';
        }
      }

      if (init && typeof init.headers === 'object' && !(init.headers instanceof Headers || (g.Headers && init.headers instanceof g.Headers))) {
        const names = [];
        Object.getOwnPropertyNames(init.headers).forEach(function (name) {
          names.push(normalizeName(name));
          xhr.setRequestHeader(name, normalizeValue(init.headers[name]));
        });
        request.headers.forEach(function (value, name) {
          if (names.indexOf(name) === -1) {
            xhr.setRequestHeader(name, value);
          }
        });
      } else {
        request.headers.forEach(function (value, name) {
          xhr.setRequestHeader(name, value);
        });
      }

      if (request.signal) {
        request.signal.addEventListener('abort', abortXhr);

        xhr.onreadystatechange = function () {
          // DONE (success or failure)
          if (xhr.readyState === 4) {
            request.signal.removeEventListener('abort', abortXhr);
          }
        };
      }

      xhr.send(typeof request._bodyInit === 'undefined' ? null : request._bodyInit);
    })
  };

  fetch.polyfill = true;

  if (!g.fetch) {
    g.fetch = fetch;
    g.Headers = Headers;
    g.Request = Request;
    g.Response = Response;
  }

  exports.Headers = Headers;
  exports.Request = Request;
  exports.Response = Response;
  exports.fetch = fetch;

  Object.defineProperty(exports, '__esModule', { value: true });

})));
!function () { try { const e = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof globalThis ? globalThis : "undefined" != typeof self ? self : {}, n = (new e.Error).stack; n && (e._sentryDebugIds = e._sentryDebugIds || {}, e._sentryDebugIds[n] = "e4c59632-941c-5fa2-b90f-a1952bb6b3c4") } catch (e) { } }();
//# debugId=e4c59632-941c-5fa2-b90f-a1952bb6b3c4
