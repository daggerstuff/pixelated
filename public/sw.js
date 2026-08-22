/**
 * Pixelated Empathy Service Worker
 *
 * Strategies:
 *   - Cache-first  for static assets (CSS, JS, fonts, images)
 *   - Network-first for API calls with offline fallback
 *   - Background sync for queued mutations (notes, appointments, messages)
 */

var CACHE_NAME = 'pixelated-empathy-v1'
var OFFLINE_URL = '/offline'

var PRECACHE_URLS = [
  '/',
  '/manifest.json',
  OFFLINE_URL,
]

// --- Classification helpers -----------------------------------------------

function isStaticAsset(request) {
  var url = new URL(request.url)
  var pathname = url.pathname

  // Same-origin only
  if (url.origin !== self.location.origin) return false

  return (
    /\.(?:css|js|woff2?|ttf|otf|eot)$/i.test(pathname) ||
    /\.(?:jpg|jpeg|png|webp|avif|gif|svg|ico)$/i.test(pathname) ||
    /^\/_astro\//.test(pathname) ||
    /^\/css\//.test(pathname) ||
    /^\/js\//.test(pathname) ||
    /^\/fonts\//.test(pathname) ||
    /^\/images\//.test(pathname) ||
    /^\/optimized\//.test(pathname) ||
    /^\/polyfills\//.test(pathname)
  )
}

function isImageRequest(request) {
  var url = new URL(request.url)
  return (
    url.origin === self.location.origin &&
    /\.(?:jpg|jpeg|png|webp|avif|gif|svg|ico)$/i.test(url.pathname)
  )
}

function isApiRequest(request) {
  var url = new URL(request.url)
  return url.pathname.startsWith('/api/') || url.pathname.startsWith('/api/v1/')
}

// --- Cache-first (static assets) -----------------------------------------

function cacheFirst(request) {
  return caches.open(CACHE_NAME).then(function (cache) {
    return cache.match(request).then(function (cached) {
      if (cached) {
        // Revalidate in background
        void fetch(request).then(function (response) {
          if (response?.ok) {
            void cache.put(request, response.clone())
          }
        }).catch(function () {
          // offline — keep cached version
        })
        return cached
      }

      return fetch(request).then(function (response) {
        if (response?.ok) {
          void cache.put(request, response.clone())
        }
        return response
      }).catch(function () {
        return new Response('Offline: resource not cached', {
          status: 503,
          statusText: 'Service Unavailable',
        })
      })
    })
  })
}

// --- Network-first (API calls) --------------------------------------------

function networkFirst(request) {
  return caches.open(CACHE_NAME).then(function (cache) {
    return fetch(request)
      .then(function (response) {
        if (response?.ok) {
          void cache.put(request, response.clone())
        }
        return response
      })
      .catch(function () {
        return cache.match(request).then(function (cached) {
          if (cached) return cached
          return new Response(
            JSON.stringify({ error: 'offline', message: 'Network unavailable' }),
            {
              status: 503,
              headers: { 'Content-Type': 'application/json' },
            },
          )
        })
      })
  })
}

// --- Image: cache-first with network fallback -----------------------------

function imageStrategy(request) {
  return caches.open(CACHE_NAME).then(function (cache) {
    return cache.match(request).then(function (cached) {
      if (cached) return cached
      return fetch(request).then(function (response) {
        if (response?.ok) {
          void cache.put(request, response.clone())
        }
        return response
      }).catch(function () {
        return new Response('', { status: 503 })
      })
    })
  })
}

// --- Install: precache ----------------------------------------------------

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(PRECACHE_URLS).catch(function () {
        // If offline page doesn't exist yet, precache what we can
        return Promise.all(
          PRECACHE_URLS.map(function (url) {
            return cache.add(url).catch(function () {
              // skip individual failures
            })
          }),
        )
      })
    }),
  )
})

// --- Activate: clean old caches ------------------------------------------

self.addEventListener('activate', function (event) {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then(function (keys) {
        return Promise.all(
          keys
            .filter(function (key) {
              return key !== CACHE_NAME
            })
            .map(function (key) {
              return caches.delete(key)
            }),
        )
      }),
    ]),
  )
})

// --- Message handler ------------------------------------------------------

self.addEventListener('message', function (event) {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

// --- Fetch handler: route by type ----------------------------------------

self.addEventListener('fetch', function (event) {
  var request = event.request

  // Only handle GET
  if (request.method !== 'GET') return

  // Route by type
  if (isApiRequest(request)) {
    event.respondWith(networkFirst(request))
    return
  }

  if (isImageRequest(request)) {
    event.respondWith(imageStrategy(request))
    return
  }

  if (isStaticAsset(request)) {
    event.respondWith(cacheFirst(request))
    return
  }

  // Navigation requests: network-first with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(function () {
        return caches.match(request).then(function (cached) {
          return cached ?? caches.match(OFFLINE_URL)
        })
      }),
    )
    return
  }
})

// --- Sync handler: replay queued mutations --------------------------------

self.addEventListener('sync', function (event) {
  if (event.tag === 'pixelated-sync') {
    event.waitUntil(replayQueuedMutations())
  }
})

/**
 * Replay queued mutations from IndexedDB when connectivity is restored.
 * Reads from the "offline_queue" object store and attempts each via fetch.
 */
function replayQueuedMutations() {
  return new Promise(function (resolve, reject) {
    if (typeof indexedDB === 'undefined') {
      resolve()
      return
    }

    var openReq = indexedDB.open('pixelated-empathy-db', 1)

    openReq.onupgradeneeded = function () {
      var db = openReq.result
      if (!db.objectStoreNames.contains('offline_queue')) {
        db.createObjectStore('offline_queue', { keyPath: 'id' })
      }
    }

    openReq.onsuccess = function () {
      var db = openReq.result
      var tx = db.transaction('offline_queue', 'readwrite')
      var store = tx.objectStore('offline_queue')
      var getAllReq = store.getAll()

      getAllReq.onsuccess = function () {
        var actions = getAllReq.result || []
        var completed = 0
        var total = actions.length

        if (total === 0) {
          db.close()
          resolve()
          return
        }

        actions.forEach(function (action) {
          var endpoint = getEndpointForAction(action.type)
          var fetchOpts = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(action.payload),
          }

          fetch(endpoint, fetchOpts)
            .then(function (response) {
              if (response.ok) {
                var deleteTx = db.transaction('offline_queue', 'readwrite')
                deleteTx.objectStore('offline_queue').delete(action.id)
                deleteTx.oncomplete = function () {
                  completed++
                  if (completed === total) {
                    db.close()
                    resolve()
                  }
                }
              } else {
                handleRetry(db, action, completed, total, resolve)
              }
            })
            .catch(function () {
              handleRetry(db, action, completed, total, resolve)
            })
        })
      }

      getAllReq.onerror = function () {
        db.close()
        resolve()
      }
    }

    openReq.onerror = function () {
      resolve()
    }
  })
}

function handleRetry(db, action, completed, total, resolve) {
  action.retryCount = (action.retryCount ?? 0) + 1
  if (action.retryCount >= 3) {
    // Max retries reached — remove from queue
    var deleteTx = db.transaction('offline_queue', 'readwrite')
    deleteTx.objectStore('offline_queue').delete(action.id)
    deleteTx.oncomplete = function () {
      completed++
      if (completed === total) {
        db.close()
        resolve()
      }
    }
  } else {
    // Update retry count
    var updateTx = db.transaction('offline_queue', 'readwrite')
    updateTx.objectStore('offline_queue').put(action)
    updateTx.oncomplete = function () {
      completed++
      if (completed === total) {
        db.close()
        resolve()
      }
    }
  }
}

function getEndpointForAction(type) {
  switch (type) {
    case 'note':
      return '/api/notes'
    case 'appointment':
      return '/api/appointments'
    case 'message':
      return '/api/messages'
    default:
      return '/api/sync'
  }
}
