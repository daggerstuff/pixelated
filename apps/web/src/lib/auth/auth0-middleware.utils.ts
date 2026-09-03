/**
 * Auth0 middleware request utilities.
 * Extracted from auth0-middleware.ts; pure request-parsing helpers, no service deps.
 */

export interface ClientInfo {
  ip?: string
  userAgent?: string
  deviceId?: string
}

/**
 * Extract token from request headers or query parameters
 * Works with Web API Request type
 */
export function extractTokenFromRequest(req: Request): string | null {
  // Check Authorization header first (Web API Request uses headers.get())
  const authHeader = (req.headers.get?.('Authorization') ??
    (req.headers as unknown as Record<string, unknown> | undefined)?.[
      'authorization'
    ] ??
    (req.headers as unknown as Record<string, unknown> | undefined)?.[
      'Authorization'
    ]) as string | null | undefined

  if (
    authHeader &&
    typeof authHeader === 'string' &&
    authHeader.startsWith('Bearer ')
  ) {
    return authHeader.substring(7) // Remove 'Bearer ' prefix
  }

  // Check query parameters for WebSocket connections
  try {
    const url = new URL(req.url)
    const tokenParam = url.searchParams.get('token')
    if (tokenParam) {
      return tokenParam
    }
  } catch {
    // URL parsing failed
  }

  // Check cookie for fallback
  const cookieHeader = (req.headers.get?.('cookie') ??
    (req.headers as unknown as Record<string, unknown> | undefined)?.[
      'cookie'
    ]) as string | null | undefined
  if (cookieHeader) {
    const cookies = cookieHeader.split(';').map((c: string) => c.trim())
    for (const cookie of cookies) {
      const [name, value] = cookie.split('=')
      if ((name === 'auth_token' || name === 'auth-token') && value) {
        return decodeURIComponent(value)
      }
    }
  }

  return null
}

/**
 * Get client IP address
 * Works with Web API Request type
 */
export function getClientIp(req: Request): string {
  const xForwardedFor = (req.headers.get?.('x-forwarded-for') ??
    req.headers.get?.('X-Forwarded-For') ??
    (req.headers as unknown as Record<string, unknown> | undefined)?.[
      'x-forwarded-for'
    ] ??
    (req.headers as unknown as Record<string, unknown> | undefined)?.[
      'X-Forwarded-For'
    ]) as string | null | undefined

  const xRealIp = (req.headers.get?.('x-real-ip') ??
    req.headers.get?.('X-Real-Ip') ??
    (req.headers as unknown as Record<string, unknown> | undefined)?.[
      'x-real-ip'
    ] ??
    (req.headers as unknown as Record<string, unknown> | undefined)?.[
      'X-Real-Ip'
    ]) as string | null | undefined

  return (
    ((req as unknown as { ip?: unknown }).ip as string | undefined) ??
    (typeof xForwardedFor === 'string' && xForwardedFor !== null
      ? xForwardedFor.split(',')[0]?.trim()
      : null) ??
    (typeof xRealIp === 'string' ? xRealIp : null) ??
    'unknown'
  )
}

/**
 * Get client information from request
 */
export function getClientInfo(req: Request): { ip: string; userAgent: string } {
  const ip = getClientIp(req)

  const userAgent = (req.headers.get?.('user-agent') ??
    req.headers.get?.('User-Agent') ??
    (req.headers as unknown as Record<string, unknown> | undefined)?.[
      'user-agent'
    ] ??
    (req.headers as unknown as Record<string, unknown> | undefined)?.[
      'User-Agent'
    ] ??
    'unknown') as string

  return { ip, userAgent }
}
