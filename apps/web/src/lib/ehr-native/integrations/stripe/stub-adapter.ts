/**
 * Stub Stripe adapter — in-memory simulation for development and testing.
 *
 * @file Following the clearinghouse stub-adapter pattern: implements the
 *       StripeAdapter interface with deterministic responses based on input.
 *       No real network calls are made. State is maintained in Maps.
 */

import type {
  StripeAdapter,
  ListCustomersParams,
  ListChargesParams,
  ListInvoicesParams,
  CreateCustomerInput,
  UpdateCustomerInput,
  CreateRefundInput,
  CreateCheckoutSessionInput,
  PaginatedResponse,
} from './adapter';
import type {
  StripeCustomer,
  StripeCharge,
  StripePaymentIntent,
  StripeInvoice,
  StripeCheckoutSession,
} from './types';

/**
 * In-memory stub implementation of the Stripe adapter.
 *
 * Generates deterministic test data based on input parameters.
 * All responses match the Zod schemas defined in types.ts.
 */
export class StubStripeAdapter implements StripeAdapter {
  readonly name = 'stub-stripe';

  private readonly customers: Map<string, StripeCustomer> = new Map();
  private readonly charges: Map<string, StripeCharge> = new Map();
  private readonly invoices: Map<string, StripeInvoice> = new Map();
  private idCounter = 0;

  constructor() {
    this.seedTestData();
  }

  /**
   * Pre-populate with deterministic test data.
   * 2 customers, 2 charges, 1 invoice.
   */
  private seedTestData(): void {
    const customer1: StripeCustomer = {
      id: 'cus_stub001',
      object: 'customer',
      email: 'patient1@example.com',
      name: 'Alice Patient',
      phone: '+15551234001',
      description: 'Therapy patient - active',
      currency: 'usd',
      default_source: null,
      invoice_prefix: 'STUB1',
      address: {
        city: 'New York',
        country: 'US',
        line1: '123 Main St',
        line2: null,
        postal_code: '10001',
        state: 'NY',
      },
      metadata: { tenantId: 'stub-tenant-001' },
      created: 1717200000,
      livemode: false,
      tax_exempt: 'none',
    };
    this.customers.set(customer1.id, customer1);

    const customer2: StripeCustomer = {
      id: 'cus_stub002',
      object: 'customer',
      email: 'patient2@example.com',
      name: 'Bob Patient',
      phone: '+15551234002',
      description: 'Therapy patient - inactive',
      currency: 'usd',
      default_source: null,
      invoice_prefix: 'STUB2',
      address: {
        city: 'Boston',
        country: 'US',
        line1: '456 Oak Ave',
        line2: 'Apt 2',
        postal_code: '02101',
        state: 'MA',
      },
      metadata: { tenantId: 'stub-tenant-001' },
      created: 1717286400,
      livemode: false,
      tax_exempt: 'none',
    };
    this.customers.set(customer2.id, customer2);

    const charge1: StripeCharge = {
      id: 'ch_stub001',
      object: 'charge',
      amount: 15000,
      amount_captured: 15000,
      amount_refunded: 0,
      currency: 'usd',
      customer: customer1.id,
      description: 'Therapy session - individual',
      invoice: null,
      paid: true,
      refunded: false,
      status: 'succeeded',
      failure_code: null,
      failure_message: null,
      receipt_email: customer1.email,
      receipt_url: 'https://pay.stripe.com/receipts/stub-receipt-001',
      metadata: { tenantId: 'stub-tenant-001' },
      created: 1717200100,
      livemode: false,
      payment_method: 'pm_stub001',
      payment_intent: 'pi_stub001',
      outcome: {
        network_status: 'approved_by_network',
        risk_level: 'normal',
        risk_score: 10,
        seller_message: 'Payment complete.',
        type: 'authorized',
      },
    };
    this.charges.set(charge1.id, charge1);

    const charge2: StripeCharge = {
      id: 'ch_stub002',
      object: 'charge',
      amount: 20000,
      amount_captured: 20000,
      amount_refunded: 0,
      currency: 'usd',
      customer: customer2.id,
      description: 'Therapy session - couples',
      invoice: 'in_stub001',
      paid: true,
      refunded: false,
      status: 'succeeded',
      failure_code: null,
      failure_message: null,
      receipt_email: customer2.email,
      receipt_url: 'https://pay.stripe.com/receipts/stub-receipt-002',
      metadata: { tenantId: 'stub-tenant-001' },
      created: 1717286500,
      livemode: false,
      payment_method: 'pm_stub002',
      payment_intent: 'pi_stub002',
      outcome: {
        network_status: 'approved_by_network',
        risk_level: 'normal',
        risk_score: 5,
        seller_message: 'Payment complete.',
        type: 'authorized',
      },
    };
    this.charges.set(charge2.id, charge2);

    const invoice1: StripeInvoice = {
      id: 'in_stub001',
      object: 'invoice',
      customer: customer2.id,
      customer_email: customer2.email,
      customer_name: customer2.name,
      currency: 'usd',
      status: 'paid',
      amount_due: 20000,
      amount_paid: 20000,
      amount_remaining: 0,
      subtotal: 20000,
      total: 20000,
      description: 'Monthly therapy sessions',
      invoice_pdf: 'https://pay.stripe.com/invoices/stub-invoice-001.pdf',
      hosted_invoice_url: 'https://pay.stripe.com/invoices/stub-invoice-001',
      number: 'STUB2-0001',
      paid: true,
      attempt_count: 1,
      attempted: true,
      due_date: null,
      period_start: 1717200000,
      period_end: 1719792000,
      lines: {
        object: 'list',
        data: [
          {
            id: 'il_stub001',
            object: 'line_item',
            amount: 20000,
            currency: 'usd',
            description: 'Couples therapy session',
            quantity: 1,
          },
        ],
        has_more: false,
      },
      metadata: { tenantId: 'stub-tenant-001' },
      created: 1717286400,
      livemode: false,
    };
    this.invoices.set(invoice1.id, invoice1);
  }

  private nextId(prefix: string): string {
    this.idCounter += 1;
    return `${prefix}_stub${this.idCounter.toString().padStart(3, '0')}`;
  }

  async getCustomer(
    _accessToken: string,
    customerId: string,
  ): Promise<StripeCustomer> {
    const customer = this.customers.get(customerId);
    if (!customer) {
      throw new Error(`StubStripeAdapter: customer not found: ${customerId}`);
    }
    return customer;
  }

  async listCustomers(
    _accessToken: string,
    params?: ListCustomersParams,
  ): Promise<PaginatedResponse<StripeCustomer>> {
    let items = [...this.customers.values()];
    if (params?.email) {
      items = items.filter((c) => c.email === params.email);
    }
    if (params?.limit) {
      items = items.slice(0, params.limit);
    }
    return {
      data: items,
      has_more: false,
    };
  }

  async createCustomer(
    _accessToken: string,
    data: CreateCustomerInput,
  ): Promise<StripeCustomer> {
    const id = this.nextId('cus');
    const customer: StripeCustomer = {
      id,
      object: 'customer',
      email: data.email,
      name: data.name,
      phone: data.phone,
      description: data.description,
      currency: data.currency,
      default_source: null,
      invoice_prefix: data.invoice_prefix,
      address: data.address
        ? {
            city: data.address.city ?? null,
            country: data.address.country ?? null,
            line1: data.address.line1 ?? null,
            line2: data.address.line2 ?? null,
            postal_code: data.address.postal_code ?? null,
            state: data.address.state ?? null,
          }
        : undefined,
      metadata: data.metadata ?? {},
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      tax_exempt: data.tax_exempt,
    };
    this.customers.set(id, customer);
    return customer;
  }

  async updateCustomer(
    _accessToken: string,
    customerId: string,
    updates: UpdateCustomerInput,
  ): Promise<StripeCustomer> {
    const customer = this.customers.get(customerId);
    if (!customer) {
      throw new Error(`StubStripeAdapter: customer not found: ${customerId}`);
    }
    const updated: StripeCustomer = {
      ...customer,
      email: updates.email ?? customer.email,
      name: updates.name ?? customer.name,
      phone: updates.phone ?? customer.phone,
      description: updates.description ?? customer.description,
      currency: updates.currency ?? customer.currency,
      invoice_prefix: updates.invoice_prefix ?? customer.invoice_prefix,
      address: updates.address
        ? {
            city: updates.address.city ?? null,
            country: updates.address.country ?? null,
            line1: updates.address.line1 ?? null,
            line2: updates.address.line2 ?? null,
            postal_code: updates.address.postal_code ?? null,
            state: updates.address.state ?? null,
          }
        : customer.address,
      metadata: updates.metadata ?? customer.metadata,
      tax_exempt: updates.tax_exempt ?? customer.tax_exempt,
    };
    this.customers.set(customerId, updated);
    return updated;
  }

  async getCharge(
    _accessToken: string,
    chargeId: string,
  ): Promise<StripeCharge> {
    const charge = this.charges.get(chargeId);
    if (!charge) {
      throw new Error(`StubStripeAdapter: charge not found: ${chargeId}`);
    }
    return charge;
  }

  async listCharges(
    _accessToken: string,
    params?: ListChargesParams,
  ): Promise<PaginatedResponse<StripeCharge>> {
    let items = [...this.charges.values()];
    if (params?.customer) {
      items = items.filter((c) => c.customer === params.customer);
    }
    if (params?.limit) {
      items = items.slice(0, params.limit);
    }
    return {
      data: items,
      has_more: false,
    };
  }

  async createRefund(
    _accessToken: string,
    data: CreateRefundInput,
  ): Promise<StripeCharge> {
    let charge: StripeCharge | undefined;
    if (data.charge) {
      charge = this.charges.get(data.charge);
    } else if (data.payment_intent) {
      charge = [...this.charges.values()].find(
        (c) => c.payment_intent === data.payment_intent,
      );
    }
    if (!charge) {
      throw new Error(
        `StubStripeAdapter: charge not found for refund: ${data.charge ?? data.payment_intent}`,
      );
    }
    const refundAmount = data.amount ?? charge.amount;
    const updated: StripeCharge = {
      ...charge,
      amount_refunded: refundAmount,
      refunded: refundAmount >= charge.amount,
    };
    this.charges.set(charge.id, updated);
    return updated;
  }

  async getPaymentIntent(
    _accessToken: string,
    intentId: string,
  ): Promise<StripePaymentIntent> {
    const charge = [...this.charges.values()].find(
      (c) => c.payment_intent === intentId,
    );
    if (!charge) {
      throw new Error(
        `StubStripeAdapter: payment intent not found: ${intentId}`,
      );
    }
    return {
      id: intentId,
      object: 'payment_intent',
      amount: charge.amount,
      amount_capturable: charge.amount_captured,
      amount_received: charge.amount,
      currency: charge.currency,
      customer: charge.customer,
      description: charge.description,
      status: charge.status === 'succeeded' ? 'succeeded' : 'processing',
      capture_method: 'automatic',
      confirmation_method: 'automatic',
      payment_method: charge.payment_method,
      payment_method_types: ['card'],
      metadata: charge.metadata,
      created: charge.created,
      livemode: false,
      receipt_email: charge.receipt_email,
    };
  }

  async getInvoice(
    _accessToken: string,
    invoiceId: string,
  ): Promise<StripeInvoice> {
    const invoice = this.invoices.get(invoiceId);
    if (!invoice) {
      throw new Error(`StubStripeAdapter: invoice not found: ${invoiceId}`);
    }
    return invoice;
  }

  async listInvoices(
    _accessToken: string,
    params?: ListInvoicesParams,
  ): Promise<PaginatedResponse<StripeInvoice>> {
    let items = [...this.invoices.values()];
    if (params?.customer) {
      items = items.filter((i) => i.customer === params.customer);
    }
    if (params?.status) {
      items = items.filter((i) => i.status === params.status);
    }
    if (params?.limit) {
      items = items.slice(0, params.limit);
    }
    return {
      data: items,
      has_more: false,
    };
  }

  async createCheckoutSession(
    _accessToken: string,
    data: CreateCheckoutSessionInput,
  ): Promise<StripeCheckoutSession> {
    const id = this.nextId('cs');
    const session: StripeCheckoutSession = {
      id,
      object: 'checkout.session',
      mode: data.mode,
      status: 'open',
      payment_status: 'unpaid',
      customer: data.customer,
      customer_email: data.customer_email,
      amount_total: data.line_items?.reduce(
        (sum, item) =>
          sum +
          (item.price_data
            ? item.price_data.unit_amount * item.quantity
            : 0),
        0,
      ),
      amount_subtotal: data.line_items?.reduce(
        (sum, item) =>
          sum +
          (item.price_data
            ? item.price_data.unit_amount * item.quantity
            : 0),
        0,
      ),
      currency: data.line_items?.[0]?.price_data?.currency ?? 'usd',
      url: `https://checkout.stripe.com/c/pay/${id}`,
      success_url: data.success_url,
      cancel_url: data.cancel_url,
      payment_intent: null,
      subscription: null,
      metadata: data.metadata ?? {},
      created: Math.floor(Date.now() / 1000),
      expires_at: Math.floor(Date.now() / 1000) + 1800,
      livemode: false,
    };
    return session;
  }
}

/**
 * Singleton stub instance for development and testing.
 */
export const stubStripeAdapter = new StubStripeAdapter();
