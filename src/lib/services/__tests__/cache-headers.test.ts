import { describe, it, expect } from 'vitest'

import vercelConfig from '../../../../vercel.json'

/**
 * PIX-4062: Automated test confirming PHI routes are never cached.
 *
 * Imports vercel.json via Vite's JSON import and verifies:
 * 1. All PHI route patterns have no-store Cache-Control headers
 * 2. Static asset routes have immutable Cache-Control headers
 * 3. Public API routes have stale-while-revalidate headers
 * 4. The specific PHI routes from the acceptance criteria are present
 */

interface VercelHeader {
  key: string
  value: string
}

interface VercelHeaderRule {
  source: string
  headers: VercelHeader[]
}

const config = vercelConfig as { headers: VercelHeaderRule[] }

function getCacheControl(rule: VercelHeaderRule): string | undefined {
  return rule.headers.find((h) => h.key === 'Cache-Control')?.value
}

function isNoStoreRule(rule: VercelHeaderRule): boolean {
  const cc = getCacheControl(rule)
  return cc !== undefined && cc.includes('no-store')
}

function isImmutableRule(rule: VercelHeaderRule): boolean {
  const cc = getCacheControl(rule)
  return cc !== undefined && cc.includes('immutable')
}

function isSWRRule(rule: VercelHeaderRule): boolean {
  const cc = getCacheControl(rule)
  return cc !== undefined && cc.includes('stale-while-revalidate')
}

describe('PIX-4062: Vercel Edge Cache Rules', () => {
  describe('PHI routes are never cached', () => {
    const phiRoutePatterns = [
      '/api/sessions/(.*)',
      '/api/auth/(.*)',
      '/api/v1/memory/(.*)',
      '/api/memory/(.*)',
      '/api/v1/preferences/(.*)',
      '/api/v1/profile/(.*)',
      '/api/v1/admin/(.*)',
      '/api/graphql',
      '/api/chat',
      '/api/treatment-plans/(.*)',
      '/api/emotions/(.*)',
      '/api/agent-notes/(.*)',
      '/api/agent-note-collab/(.*)',
      '/api/ai/(.*)',
      '/api/dashboard',
      '/api/ingestion/(.*)',
      '/api/reprioritization/(.*)',
    ]

    it.each(phiRoutePatterns)(
      'route %s has no-store Cache-Control',
      (pattern) => {
        const rule = config.headers.find((r) => r.source === pattern)
        expect(
          rule,
          `No header rule found for PHI route: ${pattern}`,
        ).toBeDefined()
        expect(
          isNoStoreRule(rule!),
          `PHI route ${pattern} must have no-store`,
        ).toBe(true)
      },
    )

    it('all PHI routes also set Pragma: no-cache', () => {
      for (const pattern of phiRoutePatterns) {
        const rule = config.headers.find((r) => r.source === pattern)
        expect(rule, `No header rule for ${pattern}`).toBeDefined()
        const pragma = rule!.headers.find((h) => h.key === 'Pragma')
        expect(
          pragma,
          `PHI route ${pattern} must set Pragma: no-cache`,
        ).toBeDefined()
        expect(pragma!.value).toBe('no-cache')
      }
    })

    it('PHI route count matches expected (17 routes)', () => {
      const noStoreRules = config.headers.filter(isNoStoreRule)
      expect(noStoreRules.length).toBe(17)
    })
  })

  describe('Static assets return immutable headers', () => {
    const staticAssetPatterns = [
      '/_astro/(.*)',
      '/css/(.*)',
      '/fonts/(.*)',
      '/images/(.*)',
      '/js/(.*)',
      '/models/(.*)',
      '/optimized/(.*)',
      '/katex/(.*)',
      '/polyfills/(.*)',
    ]

    it.each(staticAssetPatterns)(
      'static asset %s has immutable Cache-Control',
      (pattern) => {
        const rule = config.headers.find((r) => r.source === pattern)
        expect(
          rule,
          `No header rule for static asset: ${pattern}`,
        ).toBeDefined()
        expect(
          isImmutableRule(rule!),
          `Static asset ${pattern} must be immutable`,
        ).toBe(true)
        expect(getCacheControl(rule!)).toContain('max-age=31536000')
      },
    )
  })

  describe('Public API routes use stale-while-revalidate', () => {
    const swrPatterns = [
      '/api/v1/health(.*)',
      '/api/health(.*)',
      '/api/developer/(.*)',
      '/api/v1/developer/(.*)',
      '/api/v1/search',
      '/docs/api/(.*)',
    ]

    it.each(swrPatterns)(
      'public route %s has stale-while-revalidate',
      (pattern) => {
        const rule = config.headers.find((r) => r.source === pattern)
        expect(
          rule,
          `No header rule for public route: ${pattern}`,
        ).toBeDefined()
        expect(isSWRRule(rule!), `Public route ${pattern} must use SWR`).toBe(
          true,
        )
      },
    )
  })

  describe('Service worker header is preserved', () => {
    it('/sw.js retains must-revalidate + Service-Worker-Allowed', () => {
      const rule = config.headers.find((r) => r.source === '/sw.js')
      expect(rule, 'SW header rule must exist').toBeDefined()
      const cc = getCacheControl(rule!)
      expect(cc).toContain('must-revalidate')
      const swa = rule!.headers.find((h) => h.key === 'Service-Worker-Allowed')
      expect(swa).toBeDefined()
      expect(swa!.value).toBe('/')
    })
  })

  describe('no PHI route is accidentally cacheable', () => {
    it('no PHI route has public or bare max-age', () => {
      const phiRoutes = config.headers.filter(isNoStoreRule)
      for (const route of phiRoutes) {
        const cc = getCacheControl(route)
        expect(cc).not.toContain('public')
        expect(cc).not.toMatch(/max-age=\d+$/)
      }
    })
  })
})
