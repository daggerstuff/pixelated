const CACHE_NAME = 'image-cache-v1'
const IMAGE_CACHE_DURATION = 7 * 24 * 60 * 60 * 1000 // 7 days

// Helper function to check if URL is an image
function isImageUrl(url) {
  return url.match(/\.(jpg|jpeg|png|webp|avif)$/i)
}

// Helper to check if cache entry is expired
async function isCacheExpired(response) {
  const cachedDate = response.headers.get('sw-cache-date')
  if (!cachedDate) {
    return true
  }

  const age = Date.now() - new Date(cachedDate).getTime()
  return age > IMAGE_CACHE_DURATION
}

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      // Clean up old caches
      caches.keys().then((keys) => {
        return Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        )
      }),
    ]),
  )
})

self.addEventListener('fetch', (event) => {
  if (!isImageUrl(event.request.url)) {
    return
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cachedResponse = await cache.match(event.request)

      if (cachedResponse && !(await isCacheExpired(cachedResponse))) {
        return cachedResponse
      }

      try {
        const response = await fetch(event.request)

        // Clone the response before caching
        const responseToCache = response.clone()

        // Add cache date header
        const headers = new Headers(responseToCache.headers)
        headers.append('sw-cache-date', new Date().toISOString())

        const modifiedResponse = new Response(await responseToCache.blob(), {
          status: responseToCache.status,
          statusText: responseToCache.statusText,
          headers,
        })

        cache.put(event.request, modifiedResponse)

        return response
      } catch (error) {
        // Return expired cached response if fetch fails
        if (cachedResponse) {
          return cachedResponse
        }
        throw error
      }
    }),
  )
})
