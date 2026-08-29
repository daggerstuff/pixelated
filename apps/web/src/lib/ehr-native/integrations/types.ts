/**
 * Shared types and Zod schemas for the Integration Marketplace (F2.5).
 *
 * Used by all provider integrations (Calendly, Zoom, Stripe, Twilio),
 * the webhook handler, and the marketplace registry.
 *
 * All external API responses are validated with Zod per ADR-002.
 */

import { z } from 'zod'

// ---------------------------------------------------------------------------
// Provider identifiers
// ---------------------------------------------------------------------------

/** Supported integration provider identifiers. */
export const integrationProviderSchema = z.enum([
  'calendly',
  'zoom',
  'stripe',
  'twilio',
])
export type IntegrationProvider = z.infer<typeof integrationProviderSchema>

/** Human-readable provider display names. */
export const PROVIDER_DISPLAY_NAMES: Record<IntegrationProvider, string> = {
  calendly: 'Calendly',
  zoom: 'Zoom',
  stripe: 'Stripe',
  twilio: 'Twilio',
}

// ---------------------------------------------------------------------------
// OAuth 2.0 Authorization Code flow
// ---------------------------------------------------------------------------

/** OAuth token response from a provider's token endpoint. */
export const oAuthTokenResponseSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.string().default('Bearer'),
  expires_in: z.number().int().positive().optional(),
  refresh_token: z.string().min(1).optional(),
  scope: z.string().optional(),
  id_token: z.string().optional(),
  expires_at: z.string().datetime().optional(),
})
export type OAuthTokenResponse = z.infer<typeof oAuthTokenResponseSchema>

/** OAuth configuration for a provider (per-tenant). */
export const oAuthConfigSchema = z.object({
  provider: integrationProviderSchema,
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  redirectUri: z.string().url(),
  scopes: z.array(z.string()).min(1),
  authorizeUrl: z.string().url(),
  tokenUrl: z.string().url(),
  refreshTokenUrl: z.string().url().optional(),
})
export type OAuthConfig = z.infer<typeof oAuthConfigSchema>

/** OAuth state parameter for CSRF protection during authorization flow. */
export const oAuthStateSchema = z.object({
  state: z.string().min(16),
  tenantId: z.string().min(1),
  provider: integrationProviderSchema,
  createdAt: z.string().datetime(),
  returnUrl: z.string().optional(),
})
type OAuthState = z.infer<typeof oAuthStateSchema>

/** Stored OAuth connection (after successful authorization). */
export const oAuthConnectionSchema = z.object({
  tenantId: z.string().min(1),
  provider: integrationProviderSchema,
  accessToken: z.string().min(1),
  refreshToken: z.string().optional(),
  tokenType: z.string().default('Bearer'),
  expiresAt: z.string().datetime().optional(),
  scope: z.string().optional(),
  connectedAt: z.string().datetime(),
  connectedBy: z.string().min(1),
  lastRefreshedAt: z.string().datetime().optional(),
})
export type OAuthConnection = z.infer<typeof oAuthConnectionSchema>

// ---------------------------------------------------------------------------
// Webhook handling
// ---------------------------------------------------------------------------

/** Webhook event received from a provider. */
export const webhookEventSchema = z.object({
  provider: integrationProviderSchema,
  eventId: z.string().min(1),
  eventType: z.string().min(1),
  payload: z.unknown(),
  signature: z.string().min(1),
  receivedAt: z.string().datetime(),
  rawBody: z.string(),
})
export type WebhookEvent = z.infer<typeof webhookEventSchema>

/** Webhook processing result. */
export const webhookResultSchema = z.object({
  processed: z.boolean(),
  eventId: z.string().min(1),
  duplicate: z.boolean().default(false),
  error: z.string().optional(),
  httpStatus: z.number().int().min(100).max(599),
})
export type WebhookResult = z.infer<typeof webhookResultSchema>

/** Webhook signature verification config per provider. */
export const webhookSignatureConfigSchema = z.object({
  provider: integrationProviderSchema,
  headerName: z.string(),
  algorithm: z.enum(['sha256', 'sha1']),
  /** Signing secret or webhook secret for HMAC verification. */
  secret: z.string().min(1),
  /** For Stripe, the signature header format is `t=...,v1=...`. */
  format: z.enum(['hmac', 'stripe-composite', 'twilio']).default('hmac'),
})
export type WebhookSignatureConfig = z.infer<
  typeof webhookSignatureConfigSchema
>

// ---------------------------------------------------------------------------
// Marketplace / Feature flags
// ---------------------------------------------------------------------------

/** Integration status per tenant-provider pair. */
export const integrationStatusSchema = z.enum([
  'connected',
  'disconnected',
  'error',
  'pending',
])
export type IntegrationStatus = z.infer<typeof integrationStatusSchema>

/** Feature flag for enabling/disabling an integration capability per tenant. */
export const integrationFeatureFlagSchema = z.object({
  tenantId: z.string().min(1),
  provider: integrationProviderSchema,
  enabled: z.boolean().default(false),
  /** Optional capabilities subset (e.g. ['booking', 'cancellation'] for Calendly). */
  capabilities: z.array(z.string()).optional(),
  updatedAt: z.string().datetime(),
  updatedBy: z.string().min(1),
})
export type IntegrationFeatureFlag = z.infer<
  typeof integrationFeatureFlagSchema
>

/** Marketplace provider definition (static metadata). */
export const marketplaceProviderSchema = z.object({
  provider: integrationProviderSchema,
  displayName: z.string(),
  description: z.string(),
  category: z.enum(['scheduling', 'video', 'payments', 'communications']),
  logoUrl: z.string().url().optional(),
  documentationUrl: z.string().url().optional(),
  defaultScopes: z.array(z.string()),
  webhookEvents: z.array(z.string()).optional(),
})
export type MarketplaceProvider = z.infer<typeof marketplaceProviderSchema>

/** Per-tenant provider status in the marketplace dashboard. */
export const tenantProviderStatusSchema = z.object({
  tenantId: z.string().min(1),
  provider: integrationProviderSchema,
  status: integrationStatusSchema,
  connectedAt: z.string().datetime().optional(),
  lastWebhookReceivedAt: z.string().datetime().optional(),
  lastError: z.string().optional(),
  featureFlag: integrationFeatureFlagSchema.optional(),
  // Provider metadata (mirrors MarketplaceProvider) must survive dashboard
  // validation; stripping it broke UI consumers (Sentry 16312900/0).
  displayName: z.string(),
  description: z.string(),
  category: z.enum(['scheduling', 'video', 'payments', 'communications']),
  logoUrl: z.string().url().optional(),
  documentationUrl: z.string().url().optional(),
  defaultScopes: z.array(z.string()),
  webhookEvents: z.array(z.string()).optional(),
})
export type TenantProviderStatus = z.infer<typeof tenantProviderStatusSchema>

/** Marketplace dashboard data for a tenant (all providers). */
export const marketplaceDashboardSchema = z.object({
  tenantId: z.string().min(1),
  providers: z.array(tenantProviderStatusSchema),
  totalConnected: z.number().int().min(0),
  totalAvailable: z.number().int().min(0),
})
export type MarketplaceDashboard = z.infer<typeof marketplaceDashboardSchema>

// ---------------------------------------------------------------------------
// Audit helpers
// ---------------------------------------------------------------------------

/** Metadata for integration audit events. */
export const integrationAuditMetadataSchema = z.object({
  tenantId: z.string().min(1),
  provider: integrationProviderSchema,
  userId: z.string().min(1),
  eventId: z.string().optional(),
  eventType: z.string().optional(),
  action: z.enum([
    'connect',
    'disconnect',
    'webhook',
    'oauth_callback',
    'token_refresh',
  ]),
  status: z.enum(['success', 'failure']),
  errorMessage: z.string().optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
})
type IntegrationAuditMetadata = z.infer<typeof integrationAuditMetadataSchema>
