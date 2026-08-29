// Integration Marketplace Routes
// OAuth callbacks, webhook endpoints, status dashboard, feature flags

import crypto from 'crypto'

import express, { Router, Request, Response } from 'express'

import { EHRAuditService } from '../../lib/ehr-native/audit/ehr-audit-service'
import {
  EHRAuditAction,
  EHRResourceType,
} from '../../lib/ehr-native/audit/events'
import {
  buildMarketplaceDashboard,
  connections,
  featureFlags,
  MARKETPLACE_PROVIDERS,
  PROVIDER_MAP,
} from '../../lib/ehr-native/integrations/marketplace'
import {
  integrationProviderSchema,
  oAuthConfigSchema,
  type IntegrationProvider,
  type OAuthConfig,
  type OAuthConnection,
  type WebhookEvent,
} from '../../lib/ehr-native/integrations/types'
import {
  buildSignatureConfig,
  logWebhookAudit,
  processWebhook,
} from '../../lib/ehr-native/integrations/webhooks'
import { oauthCredentials } from '../../lib/ehr-native/integrations/oauth-credentials'
import { redis } from '../../lib/redis'

const router: Router = express.Router()

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

function parseProvider(param: string | undefined): IntegrationProvider | null {
  if (!param) return null
  const result = integrationProviderSchema.safeParse(param)
  return result.success ? result.data : null
}

function getOAuthConfig(provider: IntegrationProvider): OAuthConfig | null {
  // In production these come from env / secret manager
  const envPrefix = provider.toUpperCase()
  const clientId = process.env[`${envPrefix}_CLIENT_ID`] ?? ''
  const clientSecret = process.env[`${envPrefix}_CLIENT_SECRET`] ?? ''
  const redirectUri =
    process.env[`${envPrefix}_REDIRECT_URI`] ??
    `http://localhost:5000/api/integrations/oauth/${provider}/callback`

  const providerMeta = PROVIDER_MAP.get(provider)
  if (!providerMeta) return null

  const config = {
    provider,
    clientId,
    clientSecret,
    redirectUri,
    scopes: providerMeta.defaultScopes,
    authorizeUrl: OAUTH_AUTHORIZE_URLS[provider],
    tokenUrl: OAUTH_TOKEN_URLS[provider],
  }

  const parsed = oAuthConfigSchema.safeParse(config)
  return parsed.success ? parsed.data : null
}

const OAUTH_AUTHORIZE_URLS: Record<IntegrationProvider, string> = {
  calendly: 'https://auth.calendly.com/oauth/authorize',
  zoom: 'https://zoom.us/oauth/authorize',
  stripe: 'https://connect.stripe.com/oauth/authorize',
  twilio: 'https://accounts.twilio.com/oauth/authorize',
}

const OAUTH_TOKEN_URLS: Record<IntegrationProvider, string> = {
  calendly: 'https://auth.calendly.com/oauth/token',
  zoom: 'https://zoom.us/oauth/token',
  stripe: 'https://connect.stripe.com/oauth/token',
  twilio: 'https://accounts.twilio.com/oauth/token',
}

function getWebhookSecret(provider: IntegrationProvider): string {
  const key = `${provider.toUpperCase()}_WEBHOOK_SECRET`
  const secret = process.env[key]
  if (!secret) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
  return secret
}

// ============================================================================
// STATUS DASHBOARD
// ============================================================================

router.get(
  '/status/:tenantId',
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const tenantId = req.params['tenantId']
      if (!tenantId) {
        return res.status(400).json({ error: 'tenantId is required' })
      }
      const dashboard = buildMarketplaceDashboard(tenantId)
      return res.json({ dashboard })
    } catch (error: unknown) {
      return res.status(500).json({
        error: 'Failed to build dashboard',
        message: (error as Error).message,
      })
    }
  },
)

// ============================================================================
// OAUTH FLOWS
// ============================================================================

router.get(
  '/oauth/:provider/authorize',
  async (req: Request, res: Response): Promise<Response> => {
    const provider = parseProvider(req.params['provider'])
    if (!provider) {
      return res.status(400).json({ error: 'Invalid or unknown provider' })
    }

    const config = getOAuthConfig(provider)
    if (!config) {
      return res.status(503).json({
        error: `OAuth is not configured for ${provider}`,
        hint: `Set ${provider.toUpperCase()}_CLIENT_ID and ${provider.toUpperCase()}_CLIENT_SECRET`,
      })
    }

    const tenantId = (req.query['tenantId'] as string | undefined) ?? ''
    const returnUrl = (req.query['returnUrl'] as string | undefined) ?? ''
    const nonce = crypto.randomUUID()
    const state = Buffer.from(
      JSON.stringify({ tenantId, provider, returnUrl, ts: Date.now(), nonce }),
    ).toString('base64url')

    const STATE_TTL_SECONDS = 600
    await redis.setex(`oauth:state:${nonce}`, STATE_TTL_SECONDS, state)

    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: config.scopes.join(' '),
      state,
    })

    return res.redirect(`${config.authorizeUrl}?${params.toString()}`)
  },
)

router.get(
  '/oauth/:provider/callback',
  async (req: Request, res: Response): Promise<Response> => {
    const provider = parseProvider(req.params['provider'])
    if (!provider) {
      return res.status(400).json({ error: 'Invalid or unknown provider' })
    }

    const code = req.query['code'] as string | undefined
    const state = req.query['state'] as string | undefined
    const error = req.query['error'] as string | undefined

    if (error) {
      return res
        .status(400)
        .json({ error: 'OAuth authorization denied', detail: error })
    }
    if (!code || !state) {
      return res.status(400).json({ error: 'Missing code or state parameter' })
    }

    let stateData: { tenantId: string; returnUrl?: string; nonce?: string }
    try {
      stateData = JSON.parse(
        Buffer.from(state, 'base64url').toString('utf8'),
      ) as { tenantId: string; returnUrl?: string; nonce?: string }
    } catch {
      return res.status(400).json({ error: 'Invalid state parameter' })
    }

    if (!stateData.nonce) {
      return res.status(400).json({ error: 'Missing CSRF token in state' })
    }

    const stateKey = `oauth:state:${stateData.nonce}`
    const storedState = await redis.get(stateKey)
    if (!storedState) {
      return res.status(400).json({ error: 'Invalid or expired OAuth state' })
    }
    await redis.del(stateKey)

    if (storedState !== state) {
      return res.status(400).json({ error: 'OAuth state mismatch' })
    }

    const config = getOAuthConfig(provider)
    if (!config) {
      return res.status(503).json({
        error: `OAuth is not configured for ${provider}`,
        hint: `Set ${provider.toUpperCase()}_CLIENT_ID and ${provider.toUpperCase()}_CLIENT_SECRET`,
      })
    }

    try {
      const tokenResp = await fetch(config.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`,
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: config.redirectUri,
        }),
      })

      if (!tokenResp.ok) {
        const body = await tokenResp.text()
        return res.status(502).json({
          error: 'Token exchange failed',
          detail: body,
        })
      }

      const tokenData = (await tokenResp.json()) as Record<string, unknown>

      const expiresIn = tokenData['expires_in'] as number | undefined
      const expiresAt = expiresIn
        ? new Date(Date.now() + expiresIn * 1000).toISOString()
        : undefined

      const connection: OAuthConnection = {
        tenantId: stateData.tenantId,
        provider,
        accessToken: tokenData['access_token'] as string,
        refreshToken: tokenData['refresh_token'] as string | undefined,
        tokenType: (tokenData['token_type'] as string) ?? 'Bearer',
        expiresAt,
        scope: tokenData['scope'] as string | undefined,
        connectedAt: new Date().toISOString(),
        connectedBy: (req.headers['x-user-id'] as string) ?? 'system',
      }
      await oauthCredentials.store(connection)

      connections.set(
        stateData.tenantId,
        provider,
        'connected',
        new Date().toISOString(),
        undefined,
        req.headers['x-user-id'] as string | undefined,
      )

      const auditService = EHRAuditService.getInstance()
      void auditService.log(
        EHRAuditAction.INTEGRATION_OAUTH_CALLBACK,
        EHRResourceType.INTEGRATION,
        provider,
        {
          userId: req.headers['x-user-id'] ?? 'system',
          status: 'success',
          metadata: {
            tenantId: stateData.tenantId,
            integrationSource: provider,
            tokenType: tokenData['token_type'] as string,
          },
        },
      )

      if (stateData.returnUrl) {
        return res.redirect(stateData.returnUrl)
      }
      return res.json({
        status: 'connected',
        provider,
        tenantId: stateData.tenantId,
      })
    } catch (err: unknown) {
      return res.status(500).json({
        error: 'OAuth callback failed',
        message: (err as Error).message,
      })
    }
  },
)

router.post(
  '/oauth/:provider/refresh',
  async (req: Request, res: Response): Promise<Response> => {
    const provider = parseProvider(req.params['provider'])
    if (!provider) {
      return res.status(400).json({ error: 'Invalid or unknown provider' })
    }

    const { refreshToken, tenantId } = req.body as {
      refreshToken?: string
      tenantId?: string
    }
    if (!refreshToken || !tenantId) {
      return res
        .status(400)
        .json({ error: 'refreshToken and tenantId are required' })
    }

    const config = getOAuthConfig(provider)
    if (!config) {
      return res.status(503).json({
        error: `OAuth is not configured for ${provider}`,
        hint: `Set ${provider.toUpperCase()}_CLIENT_ID and ${provider.toUpperCase()}_CLIENT_SECRET`,
      })
    }

    try {
      const tokenResp = await fetch(config.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: config.clientId,
          client_secret: config.clientSecret,
        }),
      })

      if (!tokenResp.ok) {
        const body = await tokenResp.text()
        return res.status(502).json({
          error: 'Token refresh failed',
          detail: body,
        })
      }

      const tokenData = (await tokenResp.json()) as Record<string, unknown>

      const expiresIn = tokenData['expires_in'] as number | undefined
      const expiresAt = expiresIn
        ? new Date(Date.now() + expiresIn * 1000).toISOString()
        : undefined

      await oauthCredentials.updateTokens(tenantId, provider, {
        accessToken: tokenData['access_token'] as string,
        refreshToken: tokenData['refresh_token'] as string | undefined,
        expiresAt,
      })

      const auditService = EHRAuditService.getInstance()
      void auditService.log(
        EHRAuditAction.INTEGRATION_TOKEN_REFRESH,
        EHRResourceType.INTEGRATION,
        provider,
        {
          userId: req.headers['x-user-id'] ?? 'system',
          status: 'success',
          metadata: { tenantId, integrationSource: provider },
        },
      )

      return res.json({
        status: 'refreshed',
        provider,
        accessToken: tokenData['access_token'],
        refreshToken: tokenData['refresh_token'],
        expiresIn: tokenData['expires_in'],
      })
    } catch (err: unknown) {
      return res.status(500).json({
        error: 'Token refresh failed',
        message: (err as Error).message,
      })
    }
  },
)

// ============================================================================
// WEBHOOK ENDPOINTS
// ============================================================================

router.post(
  '/webhooks/:provider',
  async (req: Request, res: Response): Promise<Response> => {
    const provider = parseProvider(req.params['provider'])
    if (!provider) {
      return res.status(400).json({ error: 'Invalid or unknown provider' })
    }

    const secret = getWebhookSecret(provider)
    const sigConfig = buildSignatureConfig(provider, secret)

    // Determine signature header per provider
    const signatureHeader =
      provider === 'calendly'
        ? (req.headers['calendly-webhook-signature'] as string)
        : provider === 'zoom'
          ? (req.headers['x-zm-signature'] as string)
          : provider === 'stripe'
            ? (req.headers['stripe-signature'] as string)
            : (req.headers['x-twilio-signature'] as string)

    if (!signatureHeader) {
      return res.status(401).json({ error: 'Missing webhook signature header' })
    }

    const rawBody =
      (req as Request & { rawBody?: string }).rawBody ??
      JSON.stringify(req.body)
    const body = req.body as Record<string, unknown>

    const eventId =
      (body['id'] as string) ??
      (body['event_id'] as string) ??
      (body['uuid'] as string) ??
      ((body['payload'] as Record<string, unknown> | undefined)?.['uri'] as
        | string
        | undefined) ??
      (body['MessageSid'] as string) ??
      (body['SmsSid'] as string) ??
      (body['CallSid'] as string) ??
      crypto.randomUUID()

    const eventType =
      (body['event'] as string) ?? (body['type'] as string) ?? 'unknown'

    const event: WebhookEvent = {
      provider,
      eventId,
      eventType,
      payload: body,
      signature: signatureHeader,
      receivedAt: new Date().toISOString(),
      rawBody,
    }

    const requestUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`
    const tenantId =
      (req.query['tenantId'] as string) ??
      (body['tenant_id'] as string) ??
      (body['tenantId'] as string)
    if (!tenantId) {
      return res
        .status(400)
        .json({ error: 'tenantId is required for webhook processing' })
    }
    const userId = (req.headers['x-user-id'] as string) ?? 'webhook-system'

    try {
      const result = await processWebhook(
        event,
        sigConfig,
        tenantId,
        userId,
        requestUrl,
      )

      if (result.processed) {
        await logWebhookAudit(
          tenantId,
          provider,
          eventId,
          eventType,
          'success',
          userId,
        )
      }

      if (result.processed || result.duplicate) {
        connections.recordWebhook(tenantId, provider, new Date().toISOString())
      }

      return res.status(result.httpStatus).json(result)
    } catch (err: unknown) {
      return res.status(500).json({
        processed: false,
        eventId,
        duplicate: false,
        error: 'Webhook processing failed',
        message: (err as Error).message,
        httpStatus: 500,
      })
    }
  },
)

// ============================================================================
// FEATURE FLAGS
// ============================================================================

router.get(
  '/feature-flags/:tenantId',
  (req: Request, res: Response): Response => {
    const tenantId = req.params['tenantId']
    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId is required' })
    }
    const flags = featureFlags.listForTenant(tenantId)
    return res.json({ tenantId, featureFlags: flags })
  },
)

router.put(
  '/feature-flags/:tenantId/:provider',
  (req: Request, res: Response): Response => {
    const tenantId = req.params['tenantId']
    const provider = parseProvider(req.params['provider'])
    if (!tenantId || !provider) {
      return res
        .status(400)
        .json({ error: 'tenantId and valid provider are required' })
    }

    const { enabled, capabilities, updatedBy } = req.body as {
      enabled?: boolean
      capabilities?: string[]
      updatedBy?: string
    }

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled (boolean) is required' })
    }

    featureFlags.set(
      tenantId,
      provider,
      enabled,
      updatedBy ?? 'system',
      capabilities,
    )

    return res.json({
      status: 'updated',
      tenantId,
      provider,
      enabled,
    })
  },
)

// ============================================================================
// DISCONNECT
// ============================================================================

router.post(
  '/disconnect/:tenantId/:provider',
  (req: Request, res: Response): Response => {
    const tenantId = req.params['tenantId']
    const provider = parseProvider(req.params['provider'])
    if (!tenantId || !provider) {
      return res
        .status(400)
        .json({ error: 'tenantId and valid provider are required' })
    }

    connections.set(
      tenantId,
      provider,
      'disconnected',
      undefined,
      undefined,
      req.headers['x-user-id'] as string | undefined,
    )

    const auditService = EHRAuditService.getInstance()
    void auditService.log(
      EHRAuditAction.INTEGRATION_DISCONNECT,
      EHRResourceType.INTEGRATION,
      provider,
      {
        userId: req.headers['x-user-id'] ?? 'system',
        status: 'success',
        metadata: { tenantId, integrationSource: provider },
      },
    )

    return res.json({ status: 'disconnected', tenantId, provider })
  },
)

// ============================================================================
// PROVIDER CATALOG
// ============================================================================

router.get('/providers', (_req: Request, res: Response) => {
  res.json({ providers: MARKETPLACE_PROVIDERS })
})

export default router
