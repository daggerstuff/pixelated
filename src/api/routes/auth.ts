import { Router, Request, Response } from 'express'

const router = Router()

/**
 * Auth0 Login Endpoint
 * Redirects to Auth0 hosted login page
 *
 * Note: In production, this logic is typically handled by Auth0 SDK
 * or through frontend-initiated OAuth flows. This is a placeholder
 * for Express-based auth flows if needed.
 */
router.get('/login', (req: Request, res: Response) => {
  const auth0Domain = process.env.AUTH0_DOMAIN
  const clientId = process.env.AUTH0_CLIENT_ID
  const redirectUri =
    process.env.AUTH0_CALLBACK_URL ||
    `${req.protocol}://${req.get('host')}/api/auth/callback`

  if (!auth0Domain || !clientId) {
    res.status(500).json({
      error: 'Auth0 configuration missing',
      code: 'CONFIG_ERROR',
    })
    return
  }

  const authUrl =
    `https://${auth0Domain}/authorize?` +
    `response_type=code&` +
    `client_id=${clientId}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `scope=openid%20profile%20email%20offline_access`

  res.redirect(authUrl)
})

/**
 * Auth0 Callback Endpoint
 *
 * Full OAuth 2.0 authorization code exchange flow:
 *   1. Exchange the `code` query param for Auth0 tokens
 *   2. Decode the ID token to extract the Auth0 `sub` claim and profile
 *   3. Call resolveIdentity() to:
 *      - look up or create the internal `users` row
 *      - write/confirm the `auth_accounts` link (sub → uuid) in a transaction
 *      - cache the sub→uuid mapping in Redis for fast subsequent lookups
 *   4. Return tokens + internal UUID so the frontend can use the platform ID
 */
router.get('/callback', async (req: Request, res: Response) => {
  const { code } = req.query

  if (!code || typeof code !== 'string') {
    res.status(400).json({
      error: 'Authorization code missing',
      code: 'INVALID_REQUEST',
    })
    return
  }

  const auth0Domain = process.env.AUTH0_DOMAIN
  const clientId = process.env.AUTH0_CLIENT_ID
  const clientSecret = process.env.AUTH0_CLIENT_SECRET
  const redirectUri =
    process.env.AUTH0_CALLBACK_URL ||
    `${req.protocol}://${req.get('host')}/api/auth/callback`

  if (!auth0Domain || !clientId || !clientSecret) {
    res.status(500).json({
      error: 'Auth0 configuration missing',
      code: 'CONFIG_ERROR',
    })
    return
  }

  try {
    // ── Step 1: Exchange auth code for tokens ─────────────────────────────

    const tokenEndpointRes = await fetch(
      `https://${auth0Domain}/oauth/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: redirectUri,
        }),
      },
    )

    if (!tokenEndpointRes.ok) {
      const errorBody = await tokenEndpointRes.json().catch(() => ({}))
      res.status(502).json({
        error: 'Failed to exchange authorization code',
        code: 'TOKEN_EXCHANGE_FAILED',
        detail: errorBody,
      })
      return
    }

    const tokens = (await tokenEndpointRes.json()) as {
      access_token: string
      id_token?: string
      refresh_token?: string
      token_type: string
      expires_in: number
    }

    // ── Step 2: Extract Auth0 profile from ID token ───────────────────────

    let sub: string
    let email: string
    let emailVerified = false
    let name: string | undefined
    let picture: string | undefined

    if (tokens.id_token) {
      // Lightweight base64 decode of the JWT payload section.
      // Full cryptographic signature verification of the *access* token
      // happens inside validateToken() on each subsequent API request.
      const [, payloadB64] = tokens.id_token.split('.')
      const rawPayload = Buffer.from(
        payloadB64.replace(/-/g, '+').replace(/_/g, '/'),
        'base64',
      ).toString('utf8')

      const idClaims = JSON.parse(rawPayload) as Record<string, unknown>
      sub = idClaims['sub'] as string
      email = (idClaims['email'] as string) ?? ''
      emailVerified = (idClaims['email_verified'] as boolean) ?? false
      name = idClaims['name'] as string | undefined
      picture = idClaims['picture'] as string | undefined
    } else {
      // Fallback: fetch profile from /userinfo (opaque access token case)
      const userInfoRes = await fetch(`https://${auth0Domain}/userinfo`, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      })
      if (!userInfoRes.ok) {
        res.status(502).json({
          error: 'Failed to fetch user profile',
          code: 'USERINFO_FAILED',
        })
        return
      }
      const userInfo = (await userInfoRes.json()) as {
        sub: string
        email: string
        email_verified?: boolean
        name?: string
        picture?: string
      }
      sub = userInfo.sub
      email = userInfo.email
      emailVerified = userInfo.email_verified ?? false
      name = userInfo.name
      picture = userInfo.picture
    }

    if (!sub || !email) {
      res.status(502).json({
        error: 'Auth0 profile missing required claims (sub, email)',
        code: 'INVALID_PROFILE',
      })
      return
    }

    // ── Step 3: Resolve internal UUID ────────────────────────────────────
    // resolveIdentity() upserts the users row + auth_accounts link atomically
    // inside a Postgres transaction and caches the mapping in Redis.
    const { resolveIdentity } = await import('../../lib/auth/user-identity')
    const identity = await resolveIdentity({
      sub,
      email,
      emailVerified,
      name,
      picture,
    })

    // ── Step 4: Respond ───────────────────────────────────────────────────
    res.json({
      success: true,
      // Internal platform UUID — use this for ALL subsequent API calls
      userId: identity.internalId,
      isNewUser: identity.isNewUser,
      // Auth0 tokens — the access_token goes in Authorization: Bearer headers
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? null,
      tokenType: tokens.token_type,
      expiresIn: tokens.expires_in,
    })
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Authentication failed'
    res.status(500).json({
      error: errorMessage,
      code: 'AUTH_ERROR',
    })
  }
})

/**
 * Logout Endpoint
 * Returns the Auth0 logout URL; the client must redirect to it.
 */
router.post('/logout', (req: Request, res: Response) => {
  const auth0Domain = process.env.AUTH0_DOMAIN
  const clientId = process.env.AUTH0_CLIENT_ID
  const returnTo =
    process.env.AUTH0_LOGOUT_URL || `${req.protocol}://${req.get('host')}`

  if (!auth0Domain || !clientId) {
    res.status(500).json({
      error: 'Auth0 configuration missing',
      code: 'CONFIG_ERROR',
    })
    return
  }

  const logoutUrl =
    `https://${auth0Domain}/v2/logout?` +
    `client_id=${clientId}&` +
    `returnTo=${encodeURIComponent(returnTo)}`

  res.json({
    success: true,
    logoutUrl,
  })
})

/**
 * Get Current User
 *
 * Returns the authenticated user. `id` is the **internal platform UUID**,
 * not the Auth0 sub. The sub never surfaces outside the auth layer.
 */
router.get('/me', (req: Request, res: Response) => {
  const user = (req as any).user

  if (!user) {
    res.status(401).json({
      error: 'Not authenticated',
      code: 'UNAUTHORIZED',
    })
    return
  }

  res.json({
    success: true,
    user: {
      // Internal UUID — do NOT expose user.sub or user.auth0Sub here
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture,
      emailVerified: user.emailVerified,
      role: user.role,
      roles: user.roles || [user.role].filter(Boolean),
      permissions: user.permissions || [],
    },
  })
})

/**
 * Token Refresh Endpoint
 *
 * Exchanges a valid Auth0 refresh token for a new access token.
 * The sub → internal UUID mapping is already stored and cached, so
 * no re-resolution is needed — just return fresh Auth0 tokens.
 *
 * Body: { refreshToken: string }
 */
router.post('/refresh', async (req: Request, res: Response) => {
  const { refreshToken } = req.body as { refreshToken?: unknown }

  if (!refreshToken || typeof refreshToken !== 'string') {
    res.status(400).json({
      error: 'refreshToken is required in the request body',
      code: 'INVALID_REQUEST',
    })
    return
  }

  const auth0Domain = process.env.AUTH0_DOMAIN
  const clientId = process.env.AUTH0_CLIENT_ID
  const clientSecret = process.env.AUTH0_CLIENT_SECRET

  if (!auth0Domain || !clientId || !clientSecret) {
    res.status(500).json({
      error: 'Auth0 configuration missing',
      code: 'CONFIG_ERROR',
    })
    return
  }

  try {
    const tokenEndpointRes = await fetch(
      `https://${auth0Domain}/oauth/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
        }),
      },
    )

    if (!tokenEndpointRes.ok) {
      const errorBody = await tokenEndpointRes.json().catch(() => ({}))
      res.status(401).json({
        error:
          'Token refresh failed — the refresh token may be expired or revoked',
        code: 'REFRESH_FAILED',
        detail: errorBody,
      })
      return
    }

    const tokens = (await tokenEndpointRes.json()) as {
      access_token: string
      refresh_token?: string
      token_type: string
      expires_in: number
    }

    res.json({
      success: true,
      accessToken: tokens.access_token,
      // Auth0 may rotate the refresh token; always return the latest one
      refreshToken: tokens.refresh_token ?? refreshToken,
      tokenType: tokens.token_type,
      expiresIn: tokens.expires_in,
    })
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Token refresh failed'
    res.status(500).json({
      error: errorMessage,
      code: 'REFRESH_ERROR',
    })
  }
})

export default router
