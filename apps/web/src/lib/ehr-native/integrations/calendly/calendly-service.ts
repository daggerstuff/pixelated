/**
 * Calendly service — application-level coordination layer.
 *
 * @file Following the clearinghouse service pattern: wraps a CalendlyAdapter
 *       instance and adds OAuth flow management, audit logging, and
 *       application-level validation before calling adapter methods.
 */

import { z } from 'zod'

import { EHRAuditService } from '../../audit/ehr-audit-service'
import { EHRAuditAction, EHRResourceType } from '../../audit/events'
import type {
  OAuthTokenResponse,
  OAuthConfig,
  OAuthConnection,
  WebhookEvent,
  WebhookResult,
  WebhookSignatureConfig,
} from '../types'
import { oAuthTokenResponseSchema } from '../types'
import {
  verifyWebhookSignature,
  checkIdempotency,
  buildSignatureConfig,
} from '../webhooks'
import type { CalendlyAdapter } from './adapter'
import type {
  CalendlyUser,
  CalendlyEventType,
  CalendlyScheduledEvent,
  CalendlyInvitee,
  CalendlyOAuthConfig,
} from './types'
import {
  calendlyUserSchema,
  calendlyEventTypeSchema,
  calendlyScheduledEventSchema,
  calendlyInviteeSchema,
  calendlyOAuthConfigSchema,
} from './types'

// ---------------------------------------------------------------------------
// Service configuration
// ---------------------------------------------------------------------------

/**
 * Configuration for the CalendlyService.
 */
export interface CalendlyServiceConfig {
  adapter: CalendlyAdapter
  oauthConfig: CalendlyOAuthConfig
  webhookSecret: string
}

// ---------------------------------------------------------------------------
// Service implementation
// ---------------------------------------------------------------------------

/**
 * CalendlyService — orchestrates Calendly integration with OAuth and audit.
 *
 * Responsibilities:
 * - Manage OAuth 2.0 authorization code flow (build authorize URL, exchange code for token)
 * - Validate all API responses with Zod schemas (ADR-002)
 * - Log all operations through EHRAuditService (F2.5 requirement)
 * - Process webhook events with signature verification and idempotency
 */
export class CalendlyService {
  private readonly adapter: CalendlyAdapter
  private readonly oauthConfig: CalendlyOAuthConfig
  private readonly webhookSecret: string
  private readonly auditService: EHRAuditService

  constructor(config: CalendlyServiceConfig) {
    this.adapter = config.adapter
    this.oauthConfig = calendlyOAuthConfigSchema.parse(config.oauthConfig)
    this.webhookSecret = config.webhookSecret
    this.auditService = EHRAuditService.getInstance()
  }

  // -----------------------------------------------------------------------
  // OAuth 2.0 Authorization Code Flow
  // -----------------------------------------------------------------------

  /**
   * Build the authorization URL for the OAuth code flow.
   * The user visits this URL to grant access, then is redirected back
   * with an authorization code.
   */
  buildAuthorizeUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.oauthConfig.clientId,
      redirect_uri: this.oauthConfig.redirectUri,
      response_type: 'code',
      scope: this.oauthConfig.scopes.join(' '),
      state,
    })
    return `${this.oauthConfig.authorizeUrl}?${params.toString()}`
  }

  /**
   * Exchange an authorization code for an access token.
   * @returns Validated OAuth token response.
   * @throws On network error, invalid code, or schema validation failure.
   */
  async exchangeCodeForToken(code: string): Promise<OAuthTokenResponse> {
    const tokenResponse = await fetch(this.oauthConfig.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: this.oauthConfig.clientId,
        client_secret: this.oauthConfig.clientSecret,
        redirect_uri: this.oauthConfig.redirectUri,
        code,
      }),
    })

    if (!tokenResponse.ok) {
      const body = await tokenResponse.text()
      throw new Error(
        `Calendly token exchange failed (${tokenResponse.status}): ${body}`,
      )
    }

    const json: unknown = await tokenResponse.json()
    return oAuthTokenResponseSchema.parse(json)
  }

  /**
   * Refresh an expired access token using a refresh token.
   * @returns Validated OAuth token response with new access token.
   */
  async refreshToken(refreshToken: string): Promise<OAuthTokenResponse> {
    const tokenResponse = await fetch(this.oauthConfig.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: this.oauthConfig.clientId,
        client_secret: this.oauthConfig.clientSecret,
        refresh_token: refreshToken,
      }),
    })

    if (!tokenResponse.ok) {
      const body = await tokenResponse.text()
      throw new Error(
        `Calendly token refresh failed (${tokenResponse.status}): ${body}`,
      )
    }

    const json: unknown = await tokenResponse.json()
    return oAuthTokenResponseSchema.parse(json)
  }

  // -----------------------------------------------------------------------
  // Adapter operations with audit logging
  // -----------------------------------------------------------------------

  /**
   * Get the authenticated user's profile. Validates response with Zod.
   */
  async getCurrentUser(
    accessToken: string,
    tenantId: string,
    userId: string,
  ): Promise<CalendlyUser> {
    const raw = await this.adapter.getCurrentUser(accessToken)
    const validated = calendlyUserSchema.parse(raw)

    await this.auditService.log(
      EHRAuditAction.INTEGRATION_CONNECT,
      EHRResourceType.INTEGRATION,
      validated.uri,
      {
        userId,
        status: 'success',
        metadata: {
          tenantId,
          integrationSource: 'calendly',
          resourceId: validated.uri,
        },
      },
    )

    return validated
  }

  /**
   * List event types (meeting templates). Validates response with Zod.
   */
  async listEventTypes(
    accessToken: string,
    tenantId: string,
    userId: string,
    params?: Parameters<CalendlyAdapter['listEventTypes']>[1],
  ): Promise<{ data: CalendlyEventType[]; pagination: { count: number } }> {
    const raw = await this.adapter.listEventTypes(accessToken, params)
    const validatedData = z.array(calendlyEventTypeSchema).parse(raw.data)

    return { data: validatedData, pagination: raw.pagination }
  }

  /**
   * Get a single scheduled event. Validates response with Zod.
   */
  async getScheduledEvent(
    accessToken: string,
    tenantId: string,
    userId: string,
    eventUri: string,
  ): Promise<CalendlyScheduledEvent> {
    const raw = await this.adapter.getScheduledEvent(accessToken, eventUri)
    const validated = calendlyScheduledEventSchema.parse(raw)

    await this.auditService.log(
      EHRAuditAction.INTEGRATION_WEBHOOK_RECEIVED,
      EHRResourceType.INTEGRATION,
      eventUri,
      {
        userId,
        status: 'success',
        metadata: {
          tenantId,
          integrationSource: 'calendly',
          resourceId: eventUri,
        },
      },
    )

    return validated
  }

  /**
   * List scheduled events. Validates response with Zod.
   */
  async listScheduledEvents(
    accessToken: string,
    tenantId: string,
    userId: string,
    params?: Parameters<CalendlyAdapter['listScheduledEvents']>[1],
  ): Promise<{
    data: CalendlyScheduledEvent[]
    pagination: { count: number }
  }> {
    const raw = await this.adapter.listScheduledEvents(accessToken, params)
    const validatedData = z.array(calendlyScheduledEventSchema).parse(raw.data)

    return { data: validatedData, pagination: raw.pagination }
  }

  /**
   * List invitees for a scheduled event. Validates response with Zod.
   */
  async listInvitees(
    accessToken: string,
    tenantId: string,
    userId: string,
    eventUri: string,
    params?: Parameters<CalendlyAdapter['listInvitees']>[2],
  ): Promise<{ data: CalendlyInvitee[]; pagination: { count: number } }> {
    const raw = await this.adapter.listInvitees(accessToken, eventUri, params)
    const validatedData = z.array(calendlyInviteeSchema).parse(raw.data)

    return { data: validatedData, pagination: raw.pagination }
  }

  /**
   * Cancel a scheduled event. Logs the cancellation.
   */
  async cancelScheduledEvent(
    accessToken: string,
    tenantId: string,
    userId: string,
    eventUri: string,
    cancellationReason?: string,
  ): Promise<{ canceled: boolean; eventUri: string }> {
    const result = await this.adapter.cancelScheduledEvent(
      accessToken,
      eventUri,
      cancellationReason,
    )

    await this.auditService.log(
      EHRAuditAction.INTEGRATION_WEBHOOK_RECEIVED,
      EHRResourceType.INTEGRATION,
      eventUri,
      {
        userId,
        status: 'success',
        metadata: {
          tenantId,
          integrationSource: 'calendly',
          resourceId: eventUri,
        },
      },
    )

    return result
  }

  // -----------------------------------------------------------------------
  // Webhook handling
  // -----------------------------------------------------------------------

  /**
   * Build the webhook signature config for Calendly.
   */
  getWebhookSignatureConfig(): WebhookSignatureConfig {
    return buildSignatureConfig('calendly', this.webhookSecret)
  }

  /**
   * Process an incoming Calendly webhook event.
   * Handles signature verification and idempotency checking.
   */
  async processWebhook(
    event: WebhookEvent,
    tenantId: string,
    userId: string,
    requestUrl?: string,
  ): Promise<WebhookResult> {
    const sigConfig = this.getWebhookSignatureConfig()

    // 1) Verify signature
    const isValid = verifyWebhookSignature(
      sigConfig,
      event.rawBody,
      event.signature,
      requestUrl,
    )
    if (!isValid) {
      await this.auditService.log(
        EHRAuditAction.INTEGRATION_WEBHOOK_RECEIVED,
        EHRResourceType.INTEGRATION,
        event.eventId,
        {
          userId,
          status: 'failure',
          errorMessage: 'Webhook signature verification failed',
          metadata: {
            tenantId,
            integrationSource: 'calendly',
            resourceId: event.eventId,
          },
        },
      )
      return {
        processed: false,
        eventId: event.eventId,
        duplicate: false,
        error: 'Signature verification failed',
        httpStatus: 401,
      }
    }

    // 2) Check idempotency
    const isDuplicate = await checkIdempotency('calendly', event.eventId)
    if (isDuplicate) {
      return {
        processed: false,
        eventId: event.eventId,
        duplicate: true,
        httpStatus: 200,
      }
    }

    // 3) Audit log
    await this.auditService.log(
      EHRAuditAction.INTEGRATION_WEBHOOK_RECEIVED,
      EHRResourceType.INTEGRATION,
      event.eventId,
      {
        userId,
        status: 'success',
        metadata: {
          tenantId,
          integrationSource: 'calendly',
          resourceId: event.eventId,
          eventType: event.eventType,
        },
      },
    )

    return {
      processed: true,
      eventId: event.eventId,
      duplicate: false,
      httpStatus: 200,
    }
  }
}
