/**
 * Stripe service — application-level coordination layer.
 *
 * @file Following the clearinghouse service pattern: wraps a StripeAdapter
 *       instance and adds OAuth flow management, audit logging, and
 *       application-level validation before calling adapter methods.
 */

import { z } from 'zod';
import type { StripeAdapter } from './adapter';
import type {
  StripeCustomer,
  StripeCharge,
  StripePaymentIntent,
  StripeInvoice,
  StripeCheckoutSession,
  StripeOAuthConfig,
} from './types';
import {
  stripeCustomerSchema,
  stripeChargeSchema,
  stripePaymentIntentSchema,
  stripeInvoiceSchema,
  stripeCheckoutSessionSchema,
  stripeOAuthConfigSchema,
} from './types';
import type {
  OAuthTokenResponse,
  WebhookEvent,
  WebhookResult,
  WebhookSignatureConfig,
} from '../types';
import { oAuthTokenResponseSchema } from '../types';
import { EHRAuditService } from '../../audit/ehr-audit-service';
import { EHRAuditAction, EHRResourceType } from '../../audit/events';
import { verifyWebhookSignature, checkIdempotency, buildSignatureConfig } from '../webhooks';

// ---------------------------------------------------------------------------
// Service configuration
// ---------------------------------------------------------------------------

/**
 * Configuration for the StripeService.
 */
export interface StripeServiceConfig {
  adapter: StripeAdapter;
  oauthConfig: StripeOAuthConfig;
  webhookSecret: string;
}

// ---------------------------------------------------------------------------
// Service implementation
// ---------------------------------------------------------------------------

/**
 * StripeService — orchestrates Stripe integration with OAuth and audit.
 *
 * Responsibilities:
 * - Manage OAuth 2.0 authorization code flow (build authorize URL, exchange code for token)
 * - Validate all API responses with Zod schemas (ADR-002)
 * - Log all operations through EHRAuditService (F2.5 requirement)
 * - Process webhook events with signature verification and idempotency
 */
export class StripeService {
  private readonly adapter: StripeAdapter;
  private readonly oauthConfig: StripeOAuthConfig;
  private readonly webhookSecret: string;
  private readonly auditService: EHRAuditService;

  constructor(config: StripeServiceConfig) {
    this.adapter = config.adapter;
    this.oauthConfig = stripeOAuthConfigSchema.parse(config.oauthConfig);
    this.webhookSecret = config.webhookSecret;
    this.auditService = EHRAuditService.getInstance();
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
    });
    return `${this.oauthConfig.authorizeUrl}?${params.toString()}`;
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
        Accept: 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: this.oauthConfig.clientId,
        client_secret: this.oauthConfig.clientSecret,
        redirect_uri: this.oauthConfig.redirectUri,
        code,
      }),
    });

    if (!tokenResponse.ok) {
      const body = await tokenResponse.text();
      throw new Error(`Stripe token exchange failed (${tokenResponse.status}): ${body}`);
    }

    const json: unknown = await tokenResponse.json();
    return oAuthTokenResponseSchema.parse(json);
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
        Accept: 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: this.oauthConfig.clientId,
        client_secret: this.oauthConfig.clientSecret,
        refresh_token: refreshToken,
      }),
    });

    if (!tokenResponse.ok) {
      const body = await tokenResponse.text();
      throw new Error(`Stripe token refresh failed (${tokenResponse.status}): ${body}`);
    }

    const json: unknown = await tokenResponse.json();
    return oAuthTokenResponseSchema.parse(json);
  }

  // -----------------------------------------------------------------------
  // Adapter operations with audit logging
  // -----------------------------------------------------------------------

  /**
   * Get a customer by ID. Validates response with Zod.
   */
  async getCustomer(
    accessToken: string,
    tenantId: string,
    userId: string,
    customerId: string,
  ): Promise<StripeCustomer> {
    const raw = await this.adapter.getCustomer(accessToken, customerId);
    const validated = stripeCustomerSchema.parse(raw);

    await this.auditService.log(
      EHRAuditAction.INTEGRATION_CONNECT,
      EHRResourceType.INTEGRATION,
      validated.id,
      {
        userId,
        status: 'success',
        metadata: {
          tenantId,
          integrationSource: 'stripe',
          resourceId: validated.id,
        },
      },
    );

    return validated;
  }

  /**
   * List customers. Validates response with Zod.
   */
  async listCustomers(
    accessToken: string,
    tenantId: string,
    userId: string,
    params?: Parameters<StripeAdapter['listCustomers']>[1],
  ): Promise<{ data: StripeCustomer[]; has_more: boolean }> {
    const raw = await this.adapter.listCustomers(accessToken, params);
    const validatedData = z.array(stripeCustomerSchema).parse(raw.data);

    await this.auditService.log(
      EHRAuditAction.INTEGRATION_CONNECT,
      EHRResourceType.INTEGRATION,
      'list_customers',
      {
        userId,
        status: 'success',
        metadata: {
          tenantId,
          integrationSource: 'stripe',
          count: validatedData.length,
        },
      },
    );

    return { data: validatedData, has_more: raw.has_more };
  }

  /**
   * Create a new customer. Validates response with Zod.
   */
  async createCustomer(
    accessToken: string,
    tenantId: string,
    userId: string,
    data: Parameters<StripeAdapter['createCustomer']>[1],
  ): Promise<StripeCustomer> {
    const raw = await this.adapter.createCustomer(accessToken, data);
    const validated = stripeCustomerSchema.parse(raw);

    await this.auditService.log(
      EHRAuditAction.INTEGRATION_CONNECT,
      EHRResourceType.INTEGRATION,
      validated.id,
      {
        userId,
        status: 'success',
        metadata: {
          tenantId,
          integrationSource: 'stripe',
          resourceId: validated.id,
        },
      },
    );

    return validated;
  }

  /**
   * Update an existing customer. Validates response with Zod.
   */
  async updateCustomer(
    accessToken: string,
    tenantId: string,
    userId: string,
    customerId: string,
    updates: Parameters<StripeAdapter['updateCustomer']>[2],
  ): Promise<StripeCustomer> {
    const raw = await this.adapter.updateCustomer(accessToken, customerId, updates);
    const validated = stripeCustomerSchema.parse(raw);

    await this.auditService.log(
      EHRAuditAction.INTEGRATION_CONNECT,
      EHRResourceType.INTEGRATION,
      validated.id,
      {
        userId,
        status: 'success',
        metadata: {
          tenantId,
          integrationSource: 'stripe',
          resourceId: validated.id,
        },
      },
    );

    return validated;
  }

  /**
   * Get a charge by ID. Validates response with Zod.
   */
  async getCharge(
    accessToken: string,
    tenantId: string,
    userId: string,
    chargeId: string,
  ): Promise<StripeCharge> {
    const raw = await this.adapter.getCharge(accessToken, chargeId);
    const validated = stripeChargeSchema.parse(raw);

    await this.auditService.log(
      EHRAuditAction.INTEGRATION_CONNECT,
      EHRResourceType.INTEGRATION,
      validated.id,
      {
        userId,
        status: 'success',
        metadata: {
          tenantId,
          integrationSource: 'stripe',
          resourceId: validated.id,
        },
      },
    );

    return validated;
  }

  /**
   * List charges. Validates response with Zod.
   */
  async listCharges(
    accessToken: string,
    tenantId: string,
    userId: string,
    params?: Parameters<StripeAdapter['listCharges']>[1],
  ): Promise<{ data: StripeCharge[]; has_more: boolean }> {
    const raw = await this.adapter.listCharges(accessToken, params);
    const validatedData = z.array(stripeChargeSchema).parse(raw.data);

    await this.auditService.log(
      EHRAuditAction.INTEGRATION_CONNECT,
      EHRResourceType.INTEGRATION,
      'list_charges',
      {
        userId,
        status: 'success',
        metadata: {
          tenantId,
          integrationSource: 'stripe',
          count: validatedData.length,
        },
      },
    );

    return { data: validatedData, has_more: raw.has_more };
  }

  /**
   * Create a refund. Validates response with Zod.
   */
  async createRefund(
    accessToken: string,
    tenantId: string,
    userId: string,
    data: Parameters<StripeAdapter['createRefund']>[1],
  ): Promise<StripeCharge> {
    const raw = await this.adapter.createRefund(accessToken, data);
    const validated = stripeChargeSchema.parse(raw);

    await this.auditService.log(
      EHRAuditAction.INTEGRATION_CONNECT,
      EHRResourceType.INTEGRATION,
      validated.id,
      {
        userId,
        status: 'success',
        metadata: {
          tenantId,
          integrationSource: 'stripe',
          resourceId: validated.id,
          action: 'refund',
        },
      },
    );

    return validated;
  }

  /**
   * Get a payment intent by ID. Validates response with Zod.
   */
  async getPaymentIntent(
    accessToken: string,
    tenantId: string,
    userId: string,
    intentId: string,
  ): Promise<StripePaymentIntent> {
    const raw = await this.adapter.getPaymentIntent(accessToken, intentId);
    const validated = stripePaymentIntentSchema.parse(raw);

    await this.auditService.log(
      EHRAuditAction.INTEGRATION_CONNECT,
      EHRResourceType.INTEGRATION,
      validated.id,
      {
        userId,
        status: 'success',
        metadata: {
          tenantId,
          integrationSource: 'stripe',
          resourceId: validated.id,
        },
      },
    );

    return validated;
  }

  /**
   * Get an invoice by ID. Validates response with Zod.
   */
  async getInvoice(
    accessToken: string,
    tenantId: string,
    userId: string,
    invoiceId: string,
  ): Promise<StripeInvoice> {
    const raw = await this.adapter.getInvoice(accessToken, invoiceId);
    const validated = stripeInvoiceSchema.parse(raw);

    await this.auditService.log(
      EHRAuditAction.INTEGRATION_CONNECT,
      EHRResourceType.INTEGRATION,
      validated.id,
      {
        userId,
        status: 'success',
        metadata: {
          tenantId,
          integrationSource: 'stripe',
          resourceId: validated.id,
        },
      },
    );

    return validated;
  }

  /**
   * List invoices. Validates response with Zod.
   */
  async listInvoices(
    accessToken: string,
    tenantId: string,
    userId: string,
    params?: Parameters<StripeAdapter['listInvoices']>[1],
  ): Promise<{ data: StripeInvoice[]; has_more: boolean }> {
    const raw = await this.adapter.listInvoices(accessToken, params);
    const validatedData = z.array(stripeInvoiceSchema).parse(raw.data);

    await this.auditService.log(
      EHRAuditAction.INTEGRATION_CONNECT,
      EHRResourceType.INTEGRATION,
      'list_invoices',
      {
        userId,
        status: 'success',
        metadata: {
          tenantId,
          integrationSource: 'stripe',
          count: validatedData.length,
        },
      },
    );

    return { data: validatedData, has_more: raw.has_more };
  }

  /**
   * Create a checkout session. Validates response with Zod.
   */
  async createCheckoutSession(
    accessToken: string,
    tenantId: string,
    userId: string,
    data: Parameters<StripeAdapter['createCheckoutSession']>[1],
  ): Promise<StripeCheckoutSession> {
    const raw = await this.adapter.createCheckoutSession(accessToken, data);
    const validated = stripeCheckoutSessionSchema.parse(raw);

    await this.auditService.log(
      EHRAuditAction.INTEGRATION_CONNECT,
      EHRResourceType.INTEGRATION,
      validated.id,
      {
        userId,
        status: 'success',
        metadata: {
          tenantId,
          integrationSource: 'stripe',
          resourceId: validated.id,
          action: 'checkout_session',
        },
      },
    );

    return validated;
  }

  // -----------------------------------------------------------------------
  // Webhook handling
  // -----------------------------------------------------------------------

  /**
   * Build the webhook signature config for Stripe.
   * Stripe uses the stripe-composite format (t=...,v1=...).
   */
  getWebhookSignatureConfig(): WebhookSignatureConfig {
    return buildSignatureConfig('stripe', this.webhookSecret);
  }

  /**
   * Process an incoming Stripe webhook event.
   * Handles signature verification and idempotency checking.
   */
  async processWebhook(
    event: WebhookEvent,
    tenantId: string,
    userId: string,
    requestUrl?: string,
  ): Promise<WebhookResult> {
    const sigConfig = this.getWebhookSignatureConfig();

    // 1) Verify signature
    const isValid = verifyWebhookSignature(
      sigConfig,
      event.rawBody,
      event.signature,
      requestUrl,
    );
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
            integrationSource: 'stripe',
            resourceId: event.eventId,
          },
        },
      );
      return {
        processed: false,
        eventId: event.eventId,
        duplicate: false,
        error: 'Signature verification failed',
        httpStatus: 401,
      };
    }

    // 2) Check idempotency
    const isDuplicate = await checkIdempotency('stripe', event.eventId);
    if (isDuplicate) {
      return {
        processed: false,
        eventId: event.eventId,
        duplicate: true,
        httpStatus: 200,
      };
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
          integrationSource: 'stripe',
          resourceId: event.eventId,
          eventType: event.eventType,
        },
      },
    );

    return {
      processed: true,
      eventId: event.eventId,
      duplicate: false,
      httpStatus: 200,
    };
  }
}
