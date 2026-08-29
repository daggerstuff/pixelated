/**
 * Integration Marketplace registry and per-tenant management (F2.5).
 *
 * Provides:
 * - Static provider registry (metadata for Calendly, Zoom, Stripe, Twilio)
 * - Per-tenant feature flag service (enable/disable integrations per tenant)
 * - Per-tenant status aggregation (connected/disconnected/error/pending)
 *
 * Per ADR-003, tenant isolation is enforced at the repository layer via
 * Postgres RLS. This module is the application-level orchestrator.
 */

import {
  type IntegrationProvider,
  type MarketplaceDashboard,
  type MarketplaceProvider,
  type TenantProviderStatus,
  type IntegrationFeatureFlag,
  type IntegrationStatus,
  integrationStatusSchema,
  marketplaceProviderSchema,
  tenantProviderStatusSchema,
  integrationFeatureFlagSchema,
} from './types'

/**
 * Static registry of all supported marketplace providers.
 * This is the catalog — it defines what CAN be connected, not what IS connected.
 */
export const MARKETPLACE_PROVIDERS: readonly MarketplaceProvider[] = [
  {
    provider: 'calendly',
    displayName: 'Calendly',
    description:
      'Patient scheduling and appointment booking with calendar sync.',
    category: 'scheduling',
    logoUrl: undefined,
    documentationUrl: 'https://developer.calendly.com/',
    defaultScopes: [
      'read_availability',
      'write_event_types',
      'read_events',
      'write_events',
    ],
    webhookEvents: [
      'invitee.created',
      'invitee.canceled',
      'invitee.rescheduled',
      'routing_form_submission.created',
    ],
  },
  {
    provider: 'zoom',
    displayName: 'Zoom',
    description:
      'Telehealth video sessions and meeting integration for virtual encounters.',
    category: 'video',
    logoUrl: undefined,
    documentationUrl: 'https://developers.zoom.us/docs/api/',
    defaultScopes: [
      'meeting:write',
      'meeting:read',
      'user:read',
      'user:write',
      'webinar:read',
    ],
    webhookEvents: [
      'meeting.started',
      'meeting.ended',
      'meeting.participant_joined',
      'meeting.participant_left',
      'recording.completed',
    ],
  },
  {
    provider: 'stripe',
    displayName: 'Stripe',
    description:
      'Payment processing for patient billing, copays, and insurance payments.',
    category: 'payments',
    logoUrl: undefined,
    documentationUrl: 'https://stripe.com/docs/api',
    defaultScopes: [
      'payment_intents',
      'charges',
      'refunds',
      'customers',
      'invoices',
      'webhook_events',
    ],
    webhookEvents: [
      'payment_intent.succeeded',
      'payment_intent.payment_failed',
      'charge.refunded',
      'invoice.paid',
      'customer.updated',
      'payment_method.attached',
    ],
  },
  {
    provider: 'twilio',
    displayName: 'Twilio',
    description:
      'SMS and voice communications for appointment reminders and notifications.',
    category: 'communications',
    logoUrl: undefined,
    documentationUrl: 'https://www.twilio.com/docs/usage/api',
    defaultScopes: ['sms', 'voice', 'verify'],
    webhookEvents: [
      'message.received',
      'message.sent',
      'message.delivered',
      'message.undelivered',
      'call.completed',
    ],
  },
  {
    provider: 'carequality',
    displayName: 'Carequality',
    description:
      'Nationwide health information network exchange for patient discovery and document sharing.',
    category: 'hie',
    logoUrl: undefined,
    documentationUrl: 'https://sequoiaproject.org/carequality/',
    defaultScopes: ['patient_discovery', 'document_query', 'document_retrieve', 'document_submit'],
    webhookEvents: [],
  },
  {
    provider: 'directtrust',
    displayName: 'DirectTrust',
    description:
      'Direct Secure Messaging for sending and receiving clinical documents.',
    category: 'hie',
    logoUrl: undefined,
    documentationUrl: 'https://directtrust.org/',
    defaultScopes: ['send_document', 'receive_document'],
    webhookEvents: [],
  },
  {
    provider: 'dosespot',
    displayName: 'DoseSpot',
    description:
      'E-prescribing for new prescriptions, refills, cancellations, medication history, and drug interaction checks.',
    category: 'eprescribing',
    logoUrl: undefined,
    documentationUrl: 'https://dosespot.com/api',
    defaultScopes: ['prescribe', 'pharmacy_search', 'medication_history', 'drug_interactions'],
    webhookEvents: [],
  },
] as const

/**
 * Provider lookup map for O(1) access.
 */
const PROVIDER_MAP: ReadonlyMap<IntegrationProvider, MarketplaceProvider> =
  new Map(MARKETPLACE_PROVIDERS.map((p) => [p.provider, p] as const))

/**
 * Get a provider's marketplace metadata by provider key.
 */
export function getProviderMetadata(
  provider: IntegrationProvider,
): MarketplaceProvider | undefined {
  return PROVIDER_MAP.get(provider)
}

/**
 * Get all available marketplace providers.
 */
export function getAllProviders(): readonly MarketplaceProvider[] {
  return MARKETPLACE_PROVIDERS
}

/**
 * Get providers filtered by category.
 */
export function getProvidersByCategory(
  category: MarketplaceProvider['category'],
): MarketplaceProvider[] {
  return MARKETPLACE_PROVIDERS.filter((p) => p.category === category)
}

/**
 * In-memory feature flag store.
 * In production this would be backed by Postgres (tenant_integration_flags table).
 * For F2.5 v1, we use an in-memory Map keyed by `{tenantId}:{provider}`.
 * The API routes persist this to Postgres via the existing repository layer.
 */
const featureFlagStore = new Map<string, IntegrationFeatureFlag>()

function featureFlagKey(
  tenantId: string,
  provider: IntegrationProvider,
): string {
  return `${tenantId}:${provider}`
}

/**
 * Feature flag service for per-tenant integration enablement.
 */
export const FeatureFlagService = {
  /**
   * Check if a given integration is enabled for a tenant.
   * Returns `true` by default if no flag has been set (opt-out model).
   */
  isEnabled(tenantId: string, provider: IntegrationProvider): boolean {
    const flag = featureFlagStore.get(featureFlagKey(tenantId, provider))
    if (!flag) return true
    return flag.enabled
  },

  /**
   * Get the full feature flag for a tenant + provider.
   */
  get(
    tenantId: string,
    provider: IntegrationProvider,
  ): IntegrationFeatureFlag | undefined {
    return featureFlagStore.get(featureFlagKey(tenantId, provider))
  },

  /**
   * Set the feature flag for a tenant + provider.
   */
  set(
    tenantId: string,
    provider: IntegrationProvider,
    enabled: boolean,
    updatedBy: string,
    capabilities?: string[],
  ): IntegrationFeatureFlag {
    const flag: IntegrationFeatureFlag = {
      tenantId,
      provider,
      enabled,
      capabilities: capabilities ?? undefined,
      updatedAt: new Date().toISOString(),
      updatedBy,
    }
    featureFlagStore.set(featureFlagKey(tenantId, provider), flag)
    return flag
  },

  /**
   * Remove a feature flag (revert to default enabled=true).
   */
  remove(tenantId: string, provider: IntegrationProvider): void {
    featureFlagStore.delete(featureFlagKey(tenantId, provider))
  },

  /**
   * List all feature flags for a tenant.
   */
  listForTenant(tenantId: string): IntegrationFeatureFlag[] {
    const flags: IntegrationFeatureFlag[] = []
    for (const [, flag] of featureFlagStore.entries()) {
      if (flag.tenantId === tenantId) {
        flags.push(flag)
      }
    }
    return flags
  },
} as const

/**
 * In-memory connection status store.
 * In production, this is backed by Postgres (tenant_integration_connections table).
 * Keyed by `{tenantId}:{provider}`.
 */
const connectionStore = new Map<string, TenantProviderStatus>()

function connectionKey(
  tenantId: string,
  provider: IntegrationProvider,
): string {
  return `${tenantId}:${provider}`
}

/**
 * Connection status service for per-tenant integration state.
 */
export const ConnectionStatusService = {
  /**
   * Get the connection status for a tenant + provider.
   */
  get(
    tenantId: string,
    provider: IntegrationProvider,
  ): TenantProviderStatus | undefined {
    return connectionStore.get(connectionKey(tenantId, provider))
  },

  /**
   * Set/update connection status.
   */
  set(
    tenantId: string,
    provider: IntegrationProvider,
    status: IntegrationStatus,
    connectedAt?: string,
    lastError?: string,
    _connectedBy?: string,
  ): TenantProviderStatus {
    const existing = connectionStore.get(connectionKey(tenantId, provider))
    const meta = PROVIDER_MAP.get(provider)
    if (!meta) {
      throw new Error(`Unknown marketplace provider: ${provider}`)
    }
    const updated: TenantProviderStatus = {
      tenantId,
      provider,
      status,
      displayName: meta.displayName,
      description: meta.description,
      category: meta.category,
      logoUrl: meta.logoUrl,
      documentationUrl: meta.documentationUrl,
      defaultScopes: meta.defaultScopes,
      webhookEvents: meta.webhookEvents,
      connectedAt: connectedAt ?? existing?.connectedAt,
      lastWebhookReceivedAt: existing?.lastWebhookReceivedAt,
      lastError:
        lastError ?? (status === 'error' ? 'Unknown error' : undefined),
      featureFlag: FeatureFlagService.get(tenantId, provider),
    }
    connectionStore.set(connectionKey(tenantId, provider), updated)
    return updated
  },

  /**
   * Record a webhook received timestamp.
   */
  recordWebhook(
    tenantId: string,
    provider: IntegrationProvider,
    timestamp: string,
  ): void {
    const existing = connectionStore.get(connectionKey(tenantId, provider))
    if (existing) {
      existing.lastWebhookReceivedAt = timestamp
      connectionStore.set(connectionKey(tenantId, provider), existing)
    }
  },

  /**
   * Remove a connection (disconnect).
   */
  remove(tenantId: string, provider: IntegrationProvider): void {
    connectionStore.delete(connectionKey(tenantId, provider))
  },

  /**
   * List all connection statuses for a tenant.
   */
  listForTenant(tenantId: string): TenantProviderStatus[] {
    const statuses: TenantProviderStatus[] = []
    for (const [, status] of connectionStore.entries()) {
      if (status.tenantId === tenantId) {
        statuses.push(status)
      }
    }
    return statuses
  },
} as const

/**
 * Build the marketplace dashboard for a tenant.
 * Aggregates all available providers with the tenant's connection/feature flag state.
 */
export function buildMarketplaceDashboard(
  tenantId: string,
): MarketplaceDashboard {
  const providers = MARKETPLACE_PROVIDERS.map((provider) => {
    const connection = ConnectionStatusService.get(tenantId, provider.provider)
    const featureFlag = FeatureFlagService.get(tenantId, provider.provider)
    return {
      tenantId,
      ...provider,
      status: connection?.status ?? 'disconnected',
      connectedAt: connection?.connectedAt,
      lastWebhookReceivedAt: connection?.lastWebhookReceivedAt,
      lastError: connection?.lastError,
      featureFlag,
    } satisfies TenantProviderStatus & MarketplaceProvider
  })

  const totalConnected = providers.filter(
    (p) => p.status === 'connected',
  ).length

  return {
    tenantId,
    providers,
    totalConnected,
    totalAvailable: MARKETPLACE_PROVIDERS.length,
  }
}

/**
 * Validate a marketplace provider configuration against the Zod schema.
 * Throws on invalid input.
 */
export function validateMarketplaceProvider(
  input: unknown,
): MarketplaceProvider {
  return marketplaceProviderSchema.parse(input)
}

/**
 * Validate a tenant provider status against the Zod schema.
 */
export function validateTenantProviderStatus(
  input: unknown,
): TenantProviderStatus {
  return tenantProviderStatusSchema.parse(input)
}

/**
 * Validate an integration feature flag against the Zod schema.
 */
export function validateFeatureFlag(input: unknown): IntegrationFeatureFlag {
  return integrationFeatureFlagSchema.parse(input)
}

/**
 * Validate an integration status value.
 */
export function validateIntegrationStatus(input: string): IntegrationStatus {
  return integrationStatusSchema.parse(input)
}

export { MARKETPLACE_PROVIDERS as INTEGRATION_PROVIDERS, PROVIDER_MAP }
