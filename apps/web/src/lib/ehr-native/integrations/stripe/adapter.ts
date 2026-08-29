/**
 * Stripe adapter interface — the contract for Stripe API interactions.
 *
 * @file Following the clearinghouse adapter pattern, this interface defines
 *       the operations the Stripe service needs. A stub adapter provides
 *       in-memory simulation for development/testing, while a production
 *       adapter would make real HTTP calls to the Stripe API.
 */

import type {
  StripeCustomer,
  StripeCharge,
  StripePaymentIntent,
  StripeInvoice,
  StripeCheckoutSession,
} from './types'

/**
 * Parameters for listing customers.
 */
export interface ListCustomersParams {
  email?: string
  limit?: number
  starting_after?: string
  ending_before?: string
  created?: {
    gt?: number
    gte?: number
    lt?: number
    lte?: number
  }
}

/**
 * Input for creating a new customer.
 */
export interface CreateCustomerInput {
  email?: string
  name?: string
  phone?: string
  description?: string
  currency?: string
  address?: {
    city?: string
    country?: string
    line1?: string
    line2?: string
    postal_code?: string
    state?: string
  }
  metadata?: Record<string, string>
  invoice_prefix?: string
  tax_exempt?: 'none' | 'exempt' | 'reverse'
}

/**
 * Input for updating an existing customer.
 */
export interface UpdateCustomerInput {
  email?: string
  name?: string
  phone?: string
  description?: string
  currency?: string
  address?: {
    city?: string
    country?: string
    line1?: string
    line2?: string
    postal_code?: string
    state?: string
  }
  metadata?: Record<string, string>
  invoice_prefix?: string
  tax_exempt?: 'none' | 'exempt' | 'reverse'
}

/**
 * Parameters for listing charges.
 */
export interface ListChargesParams {
  customer?: string
  limit?: number
  starting_after?: string
  ending_before?: string
  created?: {
    gt?: number
    gte?: number
    lt?: number
    lte?: number
  }
}

/**
 * Input for creating a refund.
 */
export interface CreateRefundInput {
  charge?: string
  payment_intent?: string
  amount?: number
  reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer'
  metadata?: Record<string, string>
}

/**
 * Parameters for listing invoices.
 */
export interface ListInvoicesParams {
  customer?: string
  status?: 'draft' | 'open' | 'paid' | 'uncollectible' | 'void'
  limit?: number
  starting_after?: string
  ending_before?: string
  created?: {
    gt?: number
    gte?: number
    lt?: number
    lte?: number
  }
}

/**
 * Input for creating a checkout session.
 */
export interface CreateCheckoutSessionInput {
  mode: 'payment' | 'setup' | 'subscription'
  success_url: string
  cancel_url: string
  line_items?: Array<{
    price?: string
    price_data?: {
      currency: string
      product_data: {
        name: string
        description?: string
      }
      unit_amount: number
    }
    quantity: number
  }>
  customer?: string
  customer_email?: string
  metadata?: Record<string, string>
  payment_method_types?: string[]
  expires_at?: number
}

/**
 * Paginated response wrapper for Stripe API list endpoints.
 */
export interface PaginatedResponse<T> {
  data: T[]
  has_more: boolean
  url?: string
}

/**
 * Adapter contract for Stripe API operations.
 *
 * Implementations MUST:
 * - Validate all API responses with Zod schemas before returning
 * - Handle rate limiting (429) with exponential backoff
 * - Return typed results matching the domain types
 * - Throw on authentication failures (401/403) with descriptive messages
 */
export interface StripeAdapter {
  /** Adapter identifier — 'stripe' for production, 'stub-stripe' for stub. */
  readonly name: string

  /**
   * Retrieve a customer by ID.
   * @see https://docs.stripe.com/api/customers/retrieve
   */
  getCustomer(accessToken: string, customerId: string): Promise<StripeCustomer>

  /**
   * List customers with optional filtering.
   * @see https://docs.stripe.com/api/customers/list
   */
  listCustomers(
    accessToken: string,
    params?: ListCustomersParams,
  ): Promise<PaginatedResponse<StripeCustomer>>

  /**
   * Create a new customer.
   * @see https://docs.stripe.com/api/customers/create
   */
  createCustomer(
    accessToken: string,
    data: CreateCustomerInput,
  ): Promise<StripeCustomer>

  /**
   * Update an existing customer.
   * @see https://docs.stripe.com/api/customers/update
   */
  updateCustomer(
    accessToken: string,
    customerId: string,
    updates: UpdateCustomerInput,
  ): Promise<StripeCustomer>

  /**
   * Retrieve a charge by ID.
   * @see https://docs.stripe.com/api/charges/retrieve
   */
  getCharge(accessToken: string, chargeId: string): Promise<StripeCharge>

  /**
   * List charges with optional filtering.
   * @see https://docs.stripe.com/api/charges/list
   */
  listCharges(
    accessToken: string,
    params?: ListChargesParams,
  ): Promise<PaginatedResponse<StripeCharge>>

  /**
   * Create a refund for a charge or payment intent.
   * @see https://docs.stripe.com/api/refunds/create
   */
  createRefund(
    accessToken: string,
    data: CreateRefundInput,
  ): Promise<StripeCharge>

  /**
   * Retrieve a payment intent by ID.
   * @see https://docs.stripe.com/api/payment_intents/retrieve
   */
  getPaymentIntent(
    accessToken: string,
    intentId: string,
  ): Promise<StripePaymentIntent>

  /**
   * Retrieve an invoice by ID.
   * @see https://docs.stripe.com/api/invoices/retrieve
   */
  getInvoice(accessToken: string, invoiceId: string): Promise<StripeInvoice>

  /**
   * List invoices with optional filtering.
   * @see https://docs.stripe.com/api/invoices/list
   */
  listInvoices(
    accessToken: string,
    params?: ListInvoicesParams,
  ): Promise<PaginatedResponse<StripeInvoice>>

  /**
   * Create a checkout session.
   * @see https://docs.stripe.com/api/checkout/sessions/create
   */
  createCheckoutSession(
    accessToken: string,
    data: CreateCheckoutSessionInput,
  ): Promise<StripeCheckoutSession>
}
