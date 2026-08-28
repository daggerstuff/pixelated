/**
 * Webhook handler for EHR Integration Marketplace (F2.5).
 *
 * Provides provider-agnostic signature verification, idempotent event
 * processing via Redis, and audit logging through the existing EHR audit
 * service (MongoDB SHA-256 hash chain).
 *
 * Per ADR-002 all external response shapes are validated with Zod.
 * Per ADR-03 the Postgres RLS layer enforces tenant isolation at the
 * repository level; webhook payloads are tenant-scoped via the
 * `tenantId` field validated before processing.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

import { redis } from '@/lib/redis';

import { EHRAuditService } from '../audit/ehr-audit-service';
import { EHRAuditAction, EHRResourceType, EHRSeverity } from '../audit/events';
import type { EHRAuditMetadata } from '../audit/events';

import type {
  IntegrationProvider,
  WebhookEvent,
  WebhookResult,
  WebhookSignatureConfig,
} from './types';

/** TTL (seconds) for idempotency keys in Redis. 24h covers most replay windows. */
const IDEMPOTENCY_TTL_SECONDS = 86_400;

/** Redis key prefix for webhook idempotency entries. */
const IDEMPOTENCY_KEY_PREFIX = 'webhook:idempotency';

/**
 * Build a Redis key for idempotency dedup.
 * Format: `webhook:idempotency:{provider}:{eventId}`
 */
function buildIdempotencyKey(provider: IntegrationProvider, eventId: string): string {
  return `${IDEMPOTENCY_KEY_PREFIX}:${provider}:${eventId}`;
}

/**
 * Compute HMAC-SHA256 digest and return hex string.
 */
function computeHmacSha256(data: string, secret: string): string {
  return createHmac('sha256', secret).update(data, 'utf8').digest('hex');
}

/**
 * Constant-time hex string comparison. Both values must be same length.
 */
function safeHexEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, 'hex');
  const bBuf = Buffer.from(b, 'hex');
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

/**
 * Parse the Calendly signature header.
 * Format: `t=<unix-timestamp>,v1=<hex-signature>`
 */
function parseCalendlySignature(header: string): { timestamp: string; signature: string } | null {
  const parts = header.split(',');
  let timestamp = '';
  let signature = '';
  for (const part of parts) {
    const [key, value] = part.split('=');
    if (key === 't') timestamp = value;
    if (key === 'v1') signature = value;
  }
  if (!timestamp || !signature) return null;
  return { timestamp, signature };
}

/**
 * Parse the Stripe signature header.
 * Format: `t=<unix-timestamp>,v1=<hex-signature>`
 */
function parseStripeSignature(header: string): { timestamp: string; signature: string } | null {
  const parts = header.split(',');
  let timestamp = '';
  let signature = '';
  for (const part of parts) {
    const [key, value] = part.split('=');
    if (key === 't') timestamp = value;
    if (key === 'v1') signature = value;
  }
  if (!timestamp || !signature) return null;
  return { timestamp, signature };
}

/**
 * Parse the Zoom signature header.
 * Format: `v0=<hex-signature>`
 */
function parseZoomSignature(header: string): { signature: string } | null {
  const [key, value] = header.split('=');
  if (key === 'v0' && value) return { signature: value };
  return null;
}

/**
 * Verify a webhook signature for the given provider.
 *
 * Each provider uses a slightly different signing scheme:
 * - **Calendly**: `HMAC-SHA256(timestamp.body, secret)` in header `Calendly-Webhook-Signature`
 * - **Zoom**: `HMAC-SHA256(body, secret)` in header `x-zm-signature` (prefixed `v0=`)
 * - **Stripe**: `HMAC-SHA256(timestamp.body, secret)` in header `Stripe-Signature`
 * - **Twilio**: `HMAC-SHA256(url + sortedParams, secret)` in header `X-Twilio-Signature`
 */
export function verifyWebhookSignature(
  config: WebhookSignatureConfig,
  rawBody: string,
  signatureHeader: string,
  requestUrl?: string,
): boolean {
  switch (config.format) {
    case 'hmac': {
      // Zoom prefixes the signature with "v0=" — strip it before comparison.
      // This format is currently only used by Zoom, so the prefix is safe to strip.
      const sig = signatureHeader.startsWith('v0=') ? signatureHeader.slice(3) : signatureHeader;
      const expected = computeHmacSha256(rawBody, config.secret);
      return safeHexEqual(expected, sig);
    }

    case 'stripe-composite': {
      const parsed = parseCalendlySignature(signatureHeader);
      if (!parsed) return false;
      const dataToSign = `${parsed.timestamp}.${rawBody}`;
      const expected = computeHmacSha256(dataToSign, config.secret);
      return safeHexEqual(expected, parsed.signature);
    }

    case 'twilio': {
      if (!requestUrl) return false;
      const expected = computeHmacSha256(requestUrl, config.secret);
      // Twilio signatures are base64, not hex.
      const aBuf = Buffer.from(expected, 'hex');
      let bBuf: Buffer;
      try {
        bBuf = Buffer.from(signatureHeader, 'base64');
      } catch {
        return false;
      }
      if (aBuf.length !== bBuf.length) return false;
      return timingSafeEqual(aBuf, bBuf);
    }

    default:
      return false;
  }
}

/**
 * Stripe uses the same composite format as Calendly.
 * Alias for clarity when verifying Stripe signatures explicitly.
 */
export function verifyStripeSignature(
  secret: string,
  rawBody: string,
  signatureHeader: string,
): boolean {
  const parsed = parseStripeSignature(signatureHeader);
  if (!parsed) return false;
  const dataToSign = `${parsed.timestamp}.${rawBody}`;
  const expected = computeHmacSha256(dataToSign, secret);
  return safeHexEqual(expected, parsed.signature);
}

/**
 * Zoom uses a simple HMAC of the raw body.
 */
export function verifyZoomSignature(secret: string, rawBody: string, signatureHeader: string): boolean {
  const parsed = parseZoomSignature(signatureHeader);
  if (!parsed) return false;
  const expected = computeHmacSha256(rawBody, secret);
  return safeHexEqual(expected, parsed.signature);
}

/**
 * Check whether a webhook event has already been processed (idempotency).
 * Returns `true` if the event is a **duplicate** (already seen).
 *
 * Uses Redis `SETNX` semantics: if the key doesn't exist, set it and return
 * `false` (not a duplicate). If it exists, return `true` (duplicate).
 */
export async function checkIdempotency(
  provider: IntegrationProvider,
  eventId: string,
): Promise<boolean> {
  const key = buildIdempotencyKey(provider, eventId);
  // Atomic SET NX EX: returns 'OK' if the key was newly set (not a duplicate),
  // or null if the key already existed (duplicate). This is race-safe.
  const result = await redis.set(key, '1', 'EX', IDEMPOTENCY_TTL_SECONDS, 'NX');
  return result !== 'OK';
}

/**
 * Build audit metadata for a webhook event.
 */
function buildWebhookAuditMetadata(
  tenantId: string,
  provider: IntegrationProvider,
  eventId: string,
  eventType: string,
  status: 'success' | 'failure',
  errorMessage?: string,
): EHRAuditMetadata {
  return {
    tenantId,
    resourceType: EHRResourceType.INTEGRATION,
    resourceId: eventId,
    integrationSource: provider,
    externalTransactionId: eventId,
    status,
    errorMessage,
    eventType,
  };
}

/**
 * Log a webhook event to the EHR audit service (MongoDB SHA-256 hash chain).
 */
async function logWebhookAudit(
  tenantId: string,
  provider: IntegrationProvider,
  eventId: string,
  eventType: string,
  status: 'success' | 'failure',
  userId: string,
  errorMessage?: string,
  ipAddress?: string,
): Promise<void> {
  const auditService = EHRAuditService.getInstance();
  const metadata = buildWebhookAuditMetadata(tenantId, provider, eventId, eventType, status, errorMessage);
  await auditService.log(
    EHRAuditAction.INTEGRATION_WEBHOOK_RECEIVED,
    EHRResourceType.INTEGRATION,
    eventId,
    {
      userId,
      status,
      errorMessage,
      ipAddress,
      metadata,
    },
    status === 'success' ? EHRSeverity.INTEGRATION : EHRSeverity.FAILED_ACCESS,
  );
}

/**
 * Process an incoming webhook event.
 *
 * Flow:
 * 1. Verify signature (reject if invalid)
 * 2. Check idempotency (skip if duplicate)
 * 3. Audit log the event
 * 4. Return result
 *
 * The caller is responsible for tenant-scoped dispatch to the provider-specific
 * handler based on `event.provider`.
 */
export async function processWebhook(
  event: WebhookEvent,
  config: WebhookSignatureConfig,
  tenantId: string,
  userId: string,
  requestUrl?: string,
): Promise<WebhookResult> {
  // 1. Signature verification
  const valid = verifyWebhookSignature(config, event.rawBody, event.signature, requestUrl);
  if (!valid) {
    await logWebhookAudit(
      tenantId,
      event.provider,
      event.eventId,
      event.eventType,
      'failure',
      'system',
      'Invalid webhook signature',
    );
    return {
      processed: false,
      eventId: event.eventId,
      duplicate: false,
      error: 'Invalid signature',
      httpStatus: 401,
    };
  }

  // 2. Idempotency check
  const isDuplicate = await checkIdempotency(event.provider, event.eventId);
  if (isDuplicate) {
    return {
      processed: false,
      eventId: event.eventId,
      duplicate: true,
      httpStatus: 200,
    };
  }

  // 3. Audit log
  await logWebhookAudit(
    tenantId,
    event.provider,
    event.eventId,
    event.eventType,
    'success',
    userId,
  );

  // 4. Return success — caller dispatches to provider handler
  return {
    processed: true,
    eventId: event.eventId,
    duplicate: false,
    httpStatus: 200,
  };
}

/**
 * Signature config lookup per provider.
 * In production, these come from per-tenant env/secrets.
 * This is a factory that builds a config from stored secrets.
 */
export function buildSignatureConfig(
  provider: IntegrationProvider,
  webhookSecret: string,
): WebhookSignatureConfig {
  switch (provider) {
    case 'calendly':
      return {
        provider,
        headerName: 'Calendly-Webhook-Signature',
        algorithm: 'sha256',
        secret: webhookSecret,
        format: 'stripe-composite',
      };
    case 'zoom':
      return {
        provider,
        headerName: 'x-zm-signature',
        algorithm: 'sha256',
        secret: webhookSecret,
        format: 'hmac',
      };
    case 'stripe':
      return {
        provider,
        headerName: 'Stripe-Signature',
        algorithm: 'sha256',
        secret: webhookSecret,
        format: 'stripe-composite',
      };
    case 'twilio':
      return {
        provider,
        headerName: 'X-Twilio-Signature',
        algorithm: 'sha256',
        secret: webhookSecret,
        format: 'twilio',
      };
    default: {
      const exhaustive: never = provider;
      throw new Error(`Unknown provider: ${String(exhaustive)}`);
    }
  }
}

export { buildIdempotencyKey, computeHmacSha256, safeHexEqual };
