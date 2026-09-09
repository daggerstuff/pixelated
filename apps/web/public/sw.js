const CACHE_VERSION = '__SW_VERSION__'
const STATIC_CACHE = `static-${CACHE_VERSION}`
const SWR_CACHE = `swr-${CACHE_VERSION}`
const SHELL_CACHE = `shell-${CACHE_VERSION}`

// Static asset patterns (CacheFirst)
const STATIC_PATTERNS = [
  /\/\/[^/]+\/_astro\//,
  /\/_astro\//,
  /\/css\//,
  /\/fonts\//,
  /\/js\//,
  /\/models\//,
  /\/optimized\//,
  /\/katex\//,
  /\/polyfills\//,
  /\/images\//,
  /\.(?:jpg|jpeg|png|webp|avif|gif|svg|ico|woff2?|ttf|otf|eot)$/i,
]

// Public API patterns (StaleWhileRevalidate)
const SWR_PATTERNS = [
  /\/api\/v1\/health/,
  /\/api\/health/,
  /\/api\/developer\//,
  /\/api\/v1\/developer\//,
  /\/api\/v1\/search$/,
  /\/docs\/api\//,
]

// PHI routes — NEVER intercept or cache (strictly direct to network, HIPAA Guardrail)
const PHI_PATTERNS = [
  /\/api\/sessions\//,
  /\/api\/auth\//,
  /\/api\/v1\/memory\//,
  /\/api\/memory\//,
  /\/api\/v1\/preferences\//,
  /\/api\/v1\/profile\//,
  /\/api\/v1\/admin\//,
  /\/api\/graphql$/,
  /\/api\/chat$/,
  /\/api\/treatment-plans\//,
  /\/api\/emotions\//,
  /\/api\/agent-notes\//,
  /\/api\/agent-note-collab\//,
  /\/api\/ai\//,
  /\/api\/dashboard$/,
  /\/api\/ingestion\//,
  /\/api\/reprioritization\//,
  /\/api\/ehr\//,
  /\/api\/portal\//,
  /\/fhir\//,
  /\/api\/telehealth\//,
]

// Protected navigation routes — NEVER cache page HTML (authenticated, may contain PHI)
// These pages are served fresh from the network on every visit.
const PROTECTED_NAV_PATTERNS = [
  /\/portal\//,
  /\/ehr\//,
  /\/fhir\//,
  /\/telehealth\//,
  /\/dashboard/,
  /\/treatment\//,
  /\/admin\//,
]

function isStaticAsset(url) {
  return STATIC_PATTERNS.some((p) => p.test(url))
}

function isSWRRoute(url) {
  return SWR_PATTERNS.some((p) => p.test(url))
}

function isPHIRoute(url) {
  return PHI_PATTERNS.some((p) => p.test(url))
}

function isProtectedNav(url) {
  const pathname = (() => {
    try {
      return new URL(url).pathname
    } catch {
      return url
    }
  })()
  return PROTECTED_NAV_PATTERNS.some((p) => p.test(pathname))
}

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then(async (keys) => {
        return Promise.all(
          keys
            .filter(
              (key) =>
                key !== STATIC_CACHE &&
                key !== SWR_CACHE &&
                key !== SHELL_CACHE,
            )
            .map(async (key) => caches.delete(key)),
        )
      }),
    ]),
  )
})

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = request.url

  // Only handle GET requests
  if (request.method !== 'GET') {
    return
  }

  // NEVER intercept PHI routes — always go straight to network
  if (isPHIRoute(url)) {
    return
  }

  // CacheFirst for static assets
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(request)
        if (cached) {
          return cached
        }
        try {
          const response = await fetch(request)
          if (response.ok) {
            void cache.put(request, response.clone())
          }
          return response
        } catch {
          return cached ?? Response.error()
        }
      }),
    )
    return
  }

  // StaleWhileRevalidate for public API routes
  if (isSWRRoute(url)) {
    event.respondWith(
      caches.open(SWR_CACHE).then(async (cache) => {
        const cached = await cache.match(request)
        const fetchPromise = fetch(request)
          .then((response) => {
            if (response.ok) {
              void cache.put(request, response.clone())
            }
            return response
          })
          .catch(() => cached)
        return cached ?? fetchPromise
      }),
    )
    return
  }

  // Navigation requests: NetworkFirst with cached shell fallback
  if (request.mode === 'navigate') {
    const protectedNav = isProtectedNav(url)

    event.respondWith(
      fetch(request)
        .then((response) => {
          // Never cache protected/authenticated page HTML (PHI risk)
          if (response.ok && !protectedNav) {
            const copy = response.clone()
            void caches
              .open(SHELL_CACHE)
              .then((cache) => cache.put(request, copy))
          }
          return response
        })
        .catch(async () => {
          // Protected routes: no shell cache fallback — return network error
          if (protectedNav) {
            return Response.error()
          }
          const cache = await caches.open(SHELL_CACHE)
          const match = await cache.match(request)
          return match ?? (await cache.match('/')) ?? Response.error()
        }),
    )
  }
})
