/**
 * Stripe integration domain types and Zod schemas.
 *
 * Stripe API: https://docs.stripe.com/api
 *
 * All external API response shapes are validated with Zod per ADR-002.
 *
 * @file This file defines the domain types for the Stripe integration,
 *       including OAuth types, webhook event types, API response schemas,
 *       and the adapter interface contract.
 */

import { z } from 'zod'

// ---------------------------------------------------------------------------
// Provider constants
// ---------------------------------------------------------------------------

export const STRIPE_PROVIDER_NAME = 'stripe' as const

export const STRIPE_API_BASE_URL = 'https://api.stripe.com/v1' as const

export const STRIPE_OAUTH_SCOPES = ['read_only', 'read_write'] as const

export const STRIPE_WEBHOOK_EVENTS = [
  'payment_intent.succeeded',
  'payment_intent.payment_failed',
  'charge.refunded',
  'customer.created',
  'customer.updated',
  'invoice.paid',
  'invoice.payment_failed',
  'checkout.session.completed',
] as const

// ---------------------------------------------------------------------------
// Stripe API response schemas
// ---------------------------------------------------------------------------

/**
 * Stripe customer resource.
 * @see https://docs.stripe.com/api/customers/object
 */
export const stripeCustomerSchema = z.object({
  id: z.string(),
  object: z.literal('customer').default('customer'),
  email: z.string().email().optional(),
  name: z.string().optional(),
  phone: z.string().optional(),
  description: z.string().optional(),
  currency: z.string().optional(),
  default_source: z.string().nullable().optional(),
  invoice_prefix: z.string().optional(),
  invoice_settings: z
    .object({
      default_payment_method: z.string().nullable().optional(),
      custom_fields: z
        .array(
          z.object({
            name: z.string(),
            value: z.string(),
          }),
        )
        .optional(),
      footer: z.string().nullable().optional(),
      rendering_options: z
        .object({
          amount_tax_display: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
  address: z
    .object({
      city: z.string().nullable().optional(),
      country: z.string().nullable().optional(),
      line1: z.string().nullable().optional(),
      line2: z.string().nullable().optional(),
      postal_code: z.string().nullable().optional(),
      state: z.string().nullable().optional(),
    })
    .optional(),
  shipping: z
    .object({
      address: z
        .object({
          city: z.string().nullable().optional(),
          country: z.string().nullable().optional(),
          line1: z.string().nullable().optional(),
          line2: z.string().nullable().optional(),
          postal_code: z.string().nullable().optional(),
          state: z.string().nullable().optional(),
        })
        .optional(),
      carrier: z.string().nullable().optional(),
      name: z.string().nullable().optional(),
      phone: z.string().nullable().optional(),
      tracking_number: z.string().nullable().optional(),
    })
    .optional(),
  metadata: z.record(z.string(), z.string()).default({}),
  created: z.number().int(),
  livemode: z.boolean(),
  deleted: z.boolean().optional(),
  tax_exempt: z.enum(['none', 'exempt', 'reverse']).optional(),
})

export type StripeCustomer = z.infer<typeof stripeCustomerSchema>

/**
 * Stripe charge resource.
 * @see https://docs.stripe.com/api/charges/object
 */
export const stripeChargeSchema = z.object({
  id: z.string(),
  object: z.literal('charge').default('charge'),
  amount: z.number().int(),
  amount_captured: z.number().int().optional(),
  amount_refunded: z.number().int().optional(),
  currency: z.string(),
  customer: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  invoice: z.string().nullable().optional(),
  paid: z.boolean(),
  refunded: z.boolean().default(false),
  status: z.enum(['succeeded', 'failed', 'pending']),
  failure_code: z.string().nullable().optional(),
  failure_message: z.string().nullable().optional(),
  receipt_email: z.string().nullable().optional(),
  receipt_url: z.string().url().nullable().optional(),
  source: z.unknown().optional(),
  metadata: z.record(z.string(), z.string()).default({}),
  created: z.number().int(),
  livemode: z.boolean(),
  payment_method: z.string().nullable().optional(),
  payment_intent: z.string().nullable().optional(),
  outcome: z
    .object({
      network_status: z.string().optional(),
      reason: z.string().optional(),
      risk_level: z.string().optional(),
      risk_score: z.number().int().optional(),
      seller_message: z.string().optional(),
      type: z.string().optional(),
    })
    .optional(),
})

export type StripeCharge = z.infer<typeof stripeChargeSchema>

/**
 * Stripe payment intent resource.
 * @see https://docs.stripe.com/api/payment_intents/object
 */
export const stripePaymentIntentSchema = z.object({
  id: z.string(),
  object: z.literal('payment_intent').default('payment_intent'),
  amount: z.number().int(),
  amount_capturable: z.number().int().optional(),
  amount_received: z.number().int().optional(),
  currency: z.string(),
  customer: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  status: z.enum([
    'requires_payment_method',
    'requires_confirmation',
    'requires_action',
    'processing',
    'succeeded',
    'canceled',
  ]),
  confirmation_method: z.enum(['automatic', 'manual']).optional(),
  capture_method: z.enum(['automatic', 'manual']).optional(),
  client_secret: z.string().optional(),
  last_payment_error: z.unknown().optional(),
  next_action: z.unknown().optional(),
  payment_method: z.string().nullable().optional(),
  payment_method_types: z.array(z.string()).default([]),
  metadata: z.record(z.string(), z.string()).default({}),
  created: z.number().int(),
  livemode: z.boolean(),
  receipt_email: z.string().nullable().optional(),
  statement_descriptor: z.string().nullable().optional(),
})

export type StripePaymentIntent = z.infer<typeof stripePaymentIntentSchema>

/**
 * Stripe invoice resource.
 * @see https://docs.stripe.com/api/invoices/object
 */
export const stripeInvoiceSchema = z.object({
  id: z.string(),
  object: z.literal('invoice').default('invoice'),
  customer: z.string(),
  customer_email: z.string().email().optional(),
  customer_name: z.string().optional(),
  currency: z.string(),
  status: z.enum(['draft', 'open', 'paid', 'uncollectible', 'void']),
  amount_due: z.number().int(),
  amount_paid: z.number().int().default(0),
  amount_remaining: z.number().int().default(0),
  amount_shipping: z.number().int().optional(),
  subtotal: z.number().int(),
  total: z.number().int(),
  tax: z.number().int().optional(),
  description: z.string().nullable().optional(),
  invoice_pdf: z.string().url().nullable().optional(),
  hosted_invoice_url: z.string().url().nullable().optional(),
  number: z.string().optional(),
  paid: z.boolean().default(false),
  attempt_count: z.number().int().optional(),
  attempted: z.boolean().optional(),
  due_date: z.number().int().nullable().optional(),
  period_start: z.number().int(),
  period_end: z.number().int(),
  lines: z
    .object({
      object: z.literal('list').default('list'),
      data: z
        .array(
          z.object({
            id: z.string(),
            object: z.literal('line_item').default('line_item'),
            amount: z.number().int(),
            currency: z.string(),
            description: z.string().optional(),
            quantity: z.number().int().optional(),
          }),
        )
        .default([]),
      has_more: z.boolean().default(false),
      url: z.string().optional(),
    })
    .optional(),
  metadata: z.record(z.string(), z.string()).default({}),
  created: z.number().int(),
  livemode: z.boolean(),
})

export type StripeInvoice = z.infer<typeof stripeInvoiceSchema>

/**
 * Stripe checkout session resource.
 * @see https://docs.stripe.com/api/checkout/sessions/object
 */
export const stripeCheckoutSessionSchema = z.object({
  id: z.string(),
  object: z.literal('checkout.session').default('checkout.session'),
  mode: z.enum(['payment', 'setup', 'subscription']),
  status: z.enum(['open', 'complete', 'expired']).optional(),
  payment_status: z.enum(['paid', 'unpaid', 'no_payment_required']).optional(),
  customer: z.string().nullable().optional(),
  customer_email: z.string().email().nullable().optional(),
  customer_details: z
    .object({
      email: z.string().email().nullable().optional(),
      name: z.string().nullable().optional(),
      phone: z.string().nullable().optional(),
      address: z
        .object({
          city: z.string().nullable().optional(),
          country: z.string().nullable().optional(),
          line1: z.string().nullable().optional(),
          line2: z.string().nullable().optional(),
          postal_code: z.string().nullable().optional(),
          state: z.string().nullable().optional(),
        })
        .optional(),
    })
    .optional(),
  amount_total: z.number().int().optional(),
  amount_subtotal: z.number().int().optional(),
  currency: z.string().optional(),
  url: z.string().url().nullable().optional(),
  success_url: z.string().url().optional(),
  cancel_url: z.string().url().optional(),
  payment_intent: z.string().nullable().optional(),
  subscription: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.string()).default({}),
  created: z.number().int(),
  expires_at: z.number().int().optional(),
  livemode: z.boolean(),
})

export type StripeCheckoutSession = z.infer<typeof stripeCheckoutSessionSchema>

// ---------------------------------------------------------------------------
// Webhook event schemas
// ---------------------------------------------------------------------------

/**
 * Stripe webhook payload — the body sent to our webhook endpoint.
 * @see https://docs.stripe.com/webhooks
 */
export const stripeWebhookPayloadSchema = z.object({
  id: z.string(),
  object: z.literal('event').default('event'),
  api_version: z.string().optional(),
  created: z.number().int(),
  type: z.string(),
  livemode: z.boolean(),
  pending_webhooks: z.number().int().optional(),
  request: z
    .object({
      id: z.string().nullable().optional(),
      idempotency_key: z.string().nullable().optional(),
    })
    .optional(),
  data: z.object({
    object: z.unknown(),
    previous_attributes: z.unknown().optional(),
  }),
})

export type StripeWebhookPayload = z.infer<typeof stripeWebhookPayloadSchema>

// ---------------------------------------------------------------------------
// Provider-specific OAuth config
// ---------------------------------------------------------------------------

export const stripeOAuthConfigSchema = z.object({
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  redirectUri: z.string().url(),
  scopes: z.array(z.string()).default([...STRIPE_OAUTH_SCOPES]),
  authorizeUrl: z
    .string()
    .url()
    .default('https://connect.stripe.com/oauth/authorize'),
  tokenUrl: z.string().url().default('https://connect.stripe.com/oauth/token'),
})

export type StripeOAuthConfig = z.infer<typeof stripeOAuthConfigSchema>

// ---------------------------------------------------------------------------
// Provider-specific webhook signature config
// ---------------------------------------------------------------------------

export const stripeWebhookSignatureConfigSchema = z.object({
  provider: z.literal(STRIPE_PROVIDER_NAME),
  headerName: z.string().default('Stripe-Signature'),
  secret: z.string().min(1),
  format: z.literal('stripe-composite').default('stripe-composite'),
  algorithm: z.literal('sha256').default('sha256'),
})

export type StripeWebhookSignatureConfig = z.infer<
  typeof stripeWebhookSignatureConfigSchema
>

// ---------------------------------------------------------------------------
// Enumerations for typed webhook events
// ---------------------------------------------------------------------------

export const stripeWebhookEventTypeSchema = z.enum([
  'payment_intent.succeeded',
  'payment_intent.payment_failed',
  'charge.refunded',
  'customer.created',
  'customer.updated',
  'invoice.paid',
  'invoice.payment_failed',
  'checkout.session.completed',
])

export type StripeWebhookEventType = z.infer<
  typeof stripeWebhookEventTypeSchema
>
