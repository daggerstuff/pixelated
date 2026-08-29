/**
 * Twilio service — application-level coordination layer.
 *
 * @file Following the clearinghouse service pattern: wraps a TwilioAdapter
 *       instance and adds OAuth flow management, audit logging, and
 *       application-level validation before calling adapter methods.
 */

import { z } from 'zod'

import { EHRAuditService } from '../../audit/ehr-audit-service'
import { EHRAuditAction, EHRResourceType } from '../../audit/events'
import type {
  OAuthTokenResponse,
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
import type { TwilioAdapter } from './adapter'
import type {
  TwilioAccount,
  TwilioMessage,
  TwilioCall,
  TwilioPhoneNumber,
  TwilioOAuthConfig,
} from './types'
import {
  twilioAccountSchema,
  twilioMessageSchema,
  twilioCallSchema,
  twilioPhoneNumberSchema,
  twilioOAuthConfigSchema,
} from './types'

// ---------------------------------------------------------------------------
// Service configuration
// ---------------------------------------------------------------------------

/**
 * Configuration for the TwilioService.
 */
export interface TwilioServiceConfig {
  adapter: TwilioAdapter
  oauthConfig: TwilioOAuthConfig
  webhookSecret: string
}

// ---------------------------------------------------------------------------
// Service implementation
// ---------------------------------------------------------------------------

/**
 * TwilioService — orchestrates Twilio integration with OAuth and audit.
 *
 * Responsibilities:
 * - Manage OAuth 2.0 authorization code flow (build authorize URL, exchange code for token)
 * - Validate all API responses with Zod schemas (ADR-002)
 * - Log all operations through EHRAuditService (F2.5 requirement)
 * - Process webhook events with signature verification and idempotency
 */
export class TwilioService {
  private readonly adapter: TwilioAdapter
  private readonly oauthConfig: TwilioOAuthConfig
  private readonly webhookSecret: string
  private readonly auditService: EHRAuditService

  constructor(config: TwilioServiceConfig) {
    this.adapter = config.adapter
    this.oauthConfig = twilioOAuthConfigSchema.parse(config.oauthConfig)
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
        `Twilio token exchange failed (${tokenResponse.status}): ${body}`,
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
        `Twilio token refresh failed (${tokenResponse.status}): ${body}`,
      )
    }

    const json: unknown = await tokenResponse.json()
    return oAuthTokenResponseSchema.parse(json)
  }

  // -----------------------------------------------------------------------
  // Adapter operations with audit logging
  // -----------------------------------------------------------------------

  /**
   * Get the account details. Validates response with Zod.
   */
  async getAccount(
    accessToken: string,
    accountSid: string,
    tenantId: string,
    userId: string,
  ): Promise<TwilioAccount> {
    const raw = await this.adapter.getAccount(accessToken, accountSid)
    const validated = twilioAccountSchema.parse(raw)

    await this.auditService.log(
      EHRAuditAction.INTEGRATION_CONNECT,
      EHRResourceType.INTEGRATION,
      validated.sid,
      {
        userId,
        status: 'success',
        metadata: {
          tenantId,
          integrationSource: 'twilio',
          resourceId: validated.sid,
        },
      },
    )

    return validated
  }

  /**
   * List messages. Validates response with Zod.
   */
  async listMessages(
    accessToken: string,
    _tenantId: string,
    _userId: string,
    params?: Parameters<TwilioAdapter['listMessages']>[1],
  ): Promise<{ data: TwilioMessage[]; pagination: { count: number } }> {
    const raw = await this.adapter.listMessages(accessToken, params)
    const validatedData = z.array(twilioMessageSchema).parse(raw.data)

    return { data: validatedData, pagination: raw.pagination }
  }

  /**
   * Get a single message by SID. Validates response with Zod.
   */
  async getMessage(
    accessToken: string,
    tenantId: string,
    userId: string,
    messageSid: string,
  ): Promise<TwilioMessage> {
    const raw = await this.adapter.getMessage(accessToken, messageSid)
    const validated = twilioMessageSchema.parse(raw)

    await this.auditService.log(
      EHRAuditAction.INTEGRATION_WEBHOOK_RECEIVED,
      EHRResourceType.INTEGRATION,
      messageSid,
      {
        userId,
        status: 'success',
        metadata: {
          tenantId,
          integrationSource: 'twilio',
          resourceId: messageSid,
        },
      },
    )

    return validated
  }

  /**
   * Send a new message. Validates response with Zod.
   */
  async sendMessage(
    accessToken: string,
    tenantId: string,
    userId: string,
    data: Parameters<TwilioAdapter['sendMessage']>[1],
  ): Promise<TwilioMessage> {
    const raw = await this.adapter.sendMessage(accessToken, data)
    const validated = twilioMessageSchema.parse(raw)

    await this.auditService.log(
      EHRAuditAction.INTEGRATION_CONNECT,
      EHRResourceType.INTEGRATION,
      validated.sid,
      {
        userId,
        status: 'success',
        metadata: {
          tenantId,
          integrationSource: 'twilio',
          resourceId: validated.sid,
        },
      },
    )

    return validated
  }

  /**
   * List calls. Validates response with Zod.
   */
  async listCalls(
    accessToken: string,
    _tenantId: string,
    _userId: string,
    params?: Parameters<TwilioAdapter['listCalls']>[1],
  ): Promise<{ data: TwilioCall[]; pagination: { count: number } }> {
    const raw = await this.adapter.listCalls(accessToken, params)
    const validatedData = z.array(twilioCallSchema).parse(raw.data)

    return { data: validatedData, pagination: raw.pagination }
  }

  /**
   * Get a single call by SID. Validates response with Zod.
   */
  async getCall(
    accessToken: string,
    tenantId: string,
    userId: string,
    callSid: string,
  ): Promise<TwilioCall> {
    const raw = await this.adapter.getCall(accessToken, callSid)
    const validated = twilioCallSchema.parse(raw)

    await this.auditService.log(
      EHRAuditAction.INTEGRATION_WEBHOOK_RECEIVED,
      EHRResourceType.INTEGRATION,
      callSid,
      {
        userId,
        status: 'success',
        metadata: {
          tenantId,
          integrationSource: 'twilio',
          resourceId: callSid,
        },
      },
    )

    return validated
  }

  /**
   * Make a new call. Validates response with Zod.
   */
  async makeCall(
    accessToken: string,
    tenantId: string,
    userId: string,
    data: Parameters<TwilioAdapter['makeCall']>[1],
  ): Promise<TwilioCall> {
    const raw = await this.adapter.makeCall(accessToken, data)
    const validated = twilioCallSchema.parse(raw)

    await this.auditService.log(
      EHRAuditAction.INTEGRATION_CONNECT,
      EHRResourceType.INTEGRATION,
      validated.sid,
      {
        userId,
        status: 'success',
        metadata: {
          tenantId,
          integrationSource: 'twilio',
          resourceId: validated.sid,
        },
      },
    )

    return validated
  }

  /**
   * Get a phone number by SID. Validates response with Zod.
   */
  async getPhoneNumber(
    accessToken: string,
    tenantId: string,
    userId: string,
    phoneNumberSid: string,
  ): Promise<TwilioPhoneNumber> {
    const raw = await this.adapter.getPhoneNumber(accessToken, phoneNumberSid)
    const validated = twilioPhoneNumberSchema.parse(raw)

    await this.auditService.log(
      EHRAuditAction.INTEGRATION_WEBHOOK_RECEIVED,
      EHRResourceType.INTEGRATION,
      phoneNumberSid,
      {
        userId,
        status: 'success',
        metadata: {
          tenantId,
          integrationSource: 'twilio',
          resourceId: phoneNumberSid,
        },
      },
    )

    return validated
  }

  /**
   * List phone numbers. Validates response with Zod.
   */
  async listPhoneNumbers(
    accessToken: string,
    _tenantId: string,
    _userId: string,
    params?: Parameters<TwilioAdapter['listPhoneNumbers']>[1],
  ): Promise<{ data: TwilioPhoneNumber[]; pagination: { count: number } }> {
    const raw = await this.adapter.listPhoneNumbers(accessToken, params)
    const validatedData = z.array(twilioPhoneNumberSchema).parse(raw.data)

    return { data: validatedData, pagination: raw.pagination }
  }

  // -----------------------------------------------------------------------
  // Webhook handling
  // -----------------------------------------------------------------------

  /**
   * Build the webhook signature config for Twilio.
   */
  getWebhookSignatureConfig(): WebhookSignatureConfig {
    return buildSignatureConfig('twilio', this.webhookSecret)
  }

  /**
   * Process an incoming Twilio webhook event.
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
            integrationSource: 'twilio',
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
    const isDuplicate = await checkIdempotency('twilio', event.eventId)
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
          integrationSource: 'twilio',
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
