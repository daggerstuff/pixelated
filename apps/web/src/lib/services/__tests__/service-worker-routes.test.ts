import { describe, it, expect } from 'vitest'

/**
 * PIX-4061: Service worker cache strategy tests.
 *
 * Tests the route classification logic that determines which requests
 * get CacheFirst, StaleWhileRevalidate, or pass-through (PHI routes).
 */

const STATIC_ASSET_PATTERNS = [
  /\/_astro\/.+\.(js|css|woff2?|ttf|otf|eot)$/,
  /\/css\/.+\.(css)$/,
  /\/fonts\/.+\.(woff2?|ttf|otf|eot|woff)$/,
  /\/js\/.+\.(js)$/,
  /\/models\/.+\.(json|bin|glb)$/,
  /\/optimized\/.+\.(jpg|jpeg|png|webp|avif|svg)$/,
  /\/katex\/.+\.(js|css|woff2?|ttf)$/,
  /\/polyfills\/.+\.(js)$/,
  /\/images\/.+\.(jpg|jpeg|png|webp|avif|svg|gif|ico)$/,
]

const SWR_API_PATTERNS = [
  /\/api\/v1\/health/,
  /\/api\/health/,
  /\/api\/developer\//,
  /\/api\/v1\/developer\//,
  /\/api\/v1\/search(\?|$)/,
  /\/docs\/api\//,
]

const PHI_ROUTE_PATTERNS = [
  /\/api\/sessions\//,
  /\/api\/auth\//,
  /\/api\/v1\/memory\//,
  /\/api\/memory\//,
  /\/api\/v1\/preferences\//,
  /\/api\/v1\/profile\//,
  /\/api\/v1\/admin\//,
  /\/api\/graphql/,
  /\/api\/chat/,
  /\/api\/treatment-plans\//,
  /\/api\/emotions\//,
  /\/api\/agent-notes\//,
  /\/api\/agent-note-collab\//,
  /\/api\/ai\//,
  /\/api\/dashboard/,
  /\/api\/ingestion\//,
  /\/api\/reprioritization\//,
]

function isStaticAsset(url: string) {
  return STATIC_ASSET_PATTERNS.some((p) => p.test(url))
}

function isSWRApiRoute(url: string) {
  return SWR_API_PATTERNS.some((p) => p.test(url))
}

function isPHIRoute(url: string) {
  return PHI_ROUTE_PATTERNS.some((p) => p.test(url))
}

describe('PIX-4061: Service Worker route classification', () => {
  describe('PHI routes are never cached', () => {
    const phiRoutes = [
      '/api/sessions/123',
      '/api/auth/refresh',
      '/api/v1/memory/recall',
      '/api/memory/store',
      '/api/v1/preferences/settings',
      '/api/v1/profile/user',
      '/api/v1/admin/users',
      '/api/graphql',
      '/api/chat',
      '/api/treatment-plans/456',
      '/api/emotions/log',
      '/api/agent-notes/note1',
      '/api/agent-note-collab/session1',
      '/api/ai/process',
      '/api/dashboard',
      '/api/ingestion/upload',
      '/api/reprioritization/run',
    ]

    it.each(phiRoutes)(
      'PHI route %s is classified as PHI (never cached)',
      (route) => {
        expect(isPHIRoute(route)).toBe(true)
        expect(isStaticAsset(route)).toBe(false)
        expect(isSWRApiRoute(route)).toBe(false)
      },
    )
  })

  describe('Static assets use CacheFirst', () => {
    const staticAssets = [
      '/_astro/components.abc123.js',
      '/_astro/styles.def456.css',
      '/_astro/font.ghi789.woff2',
      '/css/main.css',
      '/fonts/inter.woff2',
      '/js/app.js',
      '/models/model.json',
      '/optimized/hero.webp',
      '/katex/katex.min.js',
      '/polyfills/resize-observer.js',
      '/images/logo.png',
    ]

    it.each(staticAssets)(
      'static asset %s is classified for CacheFirst',
      (asset) => {
        expect(isStaticAsset(asset)).toBe(true)
        expect(isPHIRoute(asset)).toBe(false)
      },
    )
  })

  describe('Public API routes use StaleWhileRevalidate', () => {
    const swrRoutes = [
      '/api/v1/health',
      '/api/health',
      '/api/health/simple',
      '/api/developer/keys',
      '/api/v1/developer/keys',
      '/api/v1/search',
      '/api/v1/search?query=test',
      '/docs/api/getting-started',
    ]

    it.each(swrRoutes)('public route %s is classified for SWR', (route) => {
      expect(isSWRApiRoute(route)).toBe(true)
      expect(isPHIRoute(route)).toBe(false)
    })
  })

  describe('No PHI route matches static or SWR patterns', () => {
    const phiRoutes = [
      '/api/sessions/123',
      '/api/auth/refresh',
      '/api/v1/memory/recall',
      '/api/graphql',
      '/api/chat',
      '/api/dashboard',
    ]

    it.each(phiRoutes)('PHI route %s does not match static or SWR', (route) => {
      expect(isStaticAsset(route)).toBe(false)
      expect(isSWRApiRoute(route)).toBe(false)
    })
  })
})
