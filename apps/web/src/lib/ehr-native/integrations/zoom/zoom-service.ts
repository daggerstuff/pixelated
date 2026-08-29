/**
 * Zoom service — application-level coordination layer.
 *
 * @file Following the clearinghouse service pattern: wraps a ZoomAdapter
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
import type { ZoomAdapter } from './adapter'
import type {
  ZoomUser,
  ZoomMeeting,
  ZoomRecording,
  ZoomOAuthConfig,
} from './types'
import {
  zoomUserSchema,
  zoomMeetingSchema,
  zoomRecordingSchema,
  zoomWebhookPayloadSchema,
  zoomOAuthConfigSchema,
  zoomWebhookSignatureConfigSchema,
  zoomWebhookEventTypeSchema,
  ZOOM_PROVIDER_NAME,
  ZOOM_OAUTH_SCOPES,
  ZOOM_WEBHOOK_EVENTS,
} from './types'

// ---------------------------------------------------------------------------
// Service configuration
// ---------------------------------------------------------------------------

/**
 * Configuration for the ZoomService.
 */
export interface ZoomServiceConfig {
  adapter: ZoomAdapter
  oauthConfig: ZoomOAuthConfig
  webhookSecret: string
}

// ---------------------------------------------------------------------------
// Service implementation
// ---------------------------------------------------------------------------

/**
 * ZoomService — orchestrates Zoom integration with OAuth and audit.
 *
 * Responsibilities:
 * - Manage OAuth 2.0 authorization code flow (build authorize URL, exchange code for token)
 * - Validate all API responses with Zod schemas (ADR-002)
 * - Log all operations through EHRAuditService (F2.5 requirement)
 * - Process webhook events with signature verification and idempotency
 */
export class ZoomService {
  private readonly adapter: ZoomAdapter
  private readonly oauthConfig: ZoomOAuthConfig
  private readonly webhookSecret: string
  private readonly auditService: EHRAuditService

  constructor(config: ZoomServiceConfig) {
    this.adapter = config.adapter
    this.oauthConfig = zoomOAuthConfigSchema.parse(config.oauthConfig)
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
        `Zoom token exchange failed (${tokenResponse.status}): ${body}`,
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
        `Zoom token refresh failed (${tokenResponse.status}): ${body}`,
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
  ): Promise<ZoomUser> {
    const raw = await this.adapter.getCurrentUser(accessToken)
    const validated = zoomUserSchema.parse(raw)

    await this.auditService.log(
      EHRAuditAction.INTEGRATION_CONNECT,
      EHRResourceType.INTEGRATION,
      validated.id,
      {
        userId,
        status: 'success',
        metadata: {
          tenantId,
          integrationSource: ZOOM_PROVIDER_NAME,
          resourceId: validated.id,
        },
      },
    )

    return validated
  }

  /**
   * List meetings for the authenticated user. Validates response with Zod.
   */
  async listMeetings(
    accessToken: string,
    tenantId: string,
    userId: string,
    params?: Parameters<ZoomAdapter['listMeetings']>[1],
  ): Promise<{ data: ZoomMeeting[]; pagination: { count: number } }> {
    const raw = await this.adapter.listMeetings(accessToken, params)
    const validatedData = z.array(zoomMeetingSchema).parse(raw.data)

    return { data: validatedData, pagination: raw.pagination }
  }

  /**
   * Get a single meeting by ID. Validates response with Zod.
   */
  async getMeeting(
    accessToken: string,
    tenantId: string,
    userId: string,
    meetingId: string,
  ): Promise<ZoomMeeting> {
    const raw = await this.adapter.getMeeting(accessToken, meetingId)
    const validated = zoomMeetingSchema.parse(raw)

    await this.auditService.log(
      EHRAuditAction.INTEGRATION_WEBHOOK_RECEIVED,
      EHRResourceType.INTEGRATION,
      meetingId,
      {
        userId,
        status: 'success',
        metadata: {
          tenantId,
          integrationSource: ZOOM_PROVIDER_NAME,
          resourceId: meetingId,
        },
      },
    )

    return validated
  }

  /**
   * Create a new meeting. Validates response with Zod.
   */
  async createMeeting(
    accessToken: string,
    tenantId: string,
    userId: string,
    meetingData: Parameters<ZoomAdapter['createMeeting']>[1],
  ): Promise<ZoomMeeting> {
    const raw = await this.adapter.createMeeting(accessToken, meetingData)
    const validated = zoomMeetingSchema.parse(raw)

    await this.auditService.log(
      EHRAuditAction.INTEGRATION_CONNECT,
      EHRResourceType.INTEGRATION,
      String(validated.id),
      {
        userId,
        status: 'success',
        metadata: {
          tenantId,
          integrationSource: ZOOM_PROVIDER_NAME,
          resourceId: String(validated.id),
        },
      },
    )

    return validated
  }

  /**
   * Update an existing meeting. Logs the update.
   */
  async updateMeeting(
    accessToken: string,
    tenantId: string,
    userId: string,
    meetingId: string,
    updates: Parameters<ZoomAdapter['updateMeeting']>[2],
  ): Promise<void> {
    await this.adapter.updateMeeting(accessToken, meetingId, updates)

    await this.auditService.log(
      EHRAuditAction.INTEGRATION_WEBHOOK_RECEIVED,
      EHRResourceType.INTEGRATION,
      meetingId,
      {
        userId,
        status: 'success',
        metadata: {
          tenantId,
          integrationSource: ZOOM_PROVIDER_NAME,
          resourceId: meetingId,
        },
      },
    )
  }

  /**
   * Delete a meeting. Logs the deletion.
   */
  async deleteMeeting(
    accessToken: string,
    tenantId: string,
    userId: string,
    meetingId: string,
  ): Promise<void> {
    await this.adapter.deleteMeeting(accessToken, meetingId)

    await this.auditService.log(
      EHRAuditAction.INTEGRATION_WEBHOOK_RECEIVED,
      EHRResourceType.INTEGRATION,
      meetingId,
      {
        userId,
        status: 'success',
        metadata: {
          tenantId,
          integrationSource: ZOOM_PROVIDER_NAME,
          resourceId: meetingId,
        },
      },
    )
  }

  /**
   * List cloud recordings for the authenticated user. Validates response with Zod.
   */
  async listRecordings(
    accessToken: string,
    tenantId: string,
    userId: string,
    params?: Parameters<ZoomAdapter['listRecordings']>[1],
  ): Promise<{ data: ZoomRecording[]; pagination: { count: number } }> {
    const raw = await this.adapter.listRecordings(accessToken, params)
    const validatedData = z.array(zoomRecordingSchema).parse(raw.data)

    return { data: validatedData, pagination: raw.pagination }
  }

  // -----------------------------------------------------------------------
  // Webhook handling
  // -----------------------------------------------------------------------

  /**
   * Build the webhook signature config for Zoom.
   */
  getWebhookSignatureConfig(): WebhookSignatureConfig {
    return buildSignatureConfig(ZOOM_PROVIDER_NAME, this.webhookSecret)
  }

  /**
   * Process an incoming Zoom webhook event.
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
            integrationSource: ZOOM_PROVIDER_NAME,
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
    const isDuplicate = await checkIdempotency(
      ZOOM_PROVIDER_NAME,
      event.eventId,
    )
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
          integrationSource: ZOOM_PROVIDER_NAME,
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
