import { describe, it, expect, vi } from 'vitest'

vi.mock('astro:middleware', () => ({
  sequence:
    (...handlers: any[]) =>
    async (context: any, next: any) => {
      let index = 0
      const dispatch: any = async () => {
        if (index >= handlers.length) return next()
        const handler = handlers[index++]
        return handler(context, dispatch)
      }
      return dispatch()
    },
  defineMiddleware: (fn: any) => fn,
}))

import { onRequest } from '../../../middleware'

describe('Admin middleware redirect', () => {
  it('redirects unauthenticated /admin/dashboard requests to /login', async () => {
    const request = new Request('http://localhost:5173/admin/dashboard')
    const context: any = {
      request,
      url: new URL('http://localhost:5173/admin/dashboard'),
      locals: {},
      redirect: (path: string, status = 302) =>
        new Response(null, { status, headers: { Location: path } }),
    }

    let nextCalled = false
    const next = async () => {
      nextCalled = true
      return new Response('ok', { status: 200 })
    }

    const response = await onRequest(context, next)
    expect(nextCalled).toBe(false)
    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe(
      '/login?redirect=%2Fadmin%2Fdashboard',
    )
  })

  it('handles immutable headers on Response.redirect safely in securityHeaders', async () => {
    const request = new Request('http://localhost:5173/some-redirect')
    const context: any = {
      request,
      url: new URL('http://localhost:5173/some-redirect'),
      locals: {},
    }

    const next = async () =>
      Response.redirect('https://pixelatedempathy.com/login', 302)
    const response = await onRequest(context, next)
    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe(
      'https://pixelatedempathy.com/login',
    )
    expect(response.headers.get('X-Frame-Options')).toBe('DENY')
  })
})
