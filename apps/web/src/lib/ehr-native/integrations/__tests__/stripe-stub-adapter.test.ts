/**
 * Tests for StubStripeAdapter — in-memory Stripe adapter for dev/testing.
 *
 * @vitest-environment node
 */

import { describe, it, expect, beforeEach } from 'vitest'

import { StubStripeAdapter } from '../stripe/stub-adapter'

describe('StubStripeAdapter', () => {
  let adapter: StubStripeAdapter

  beforeEach(() => {
    adapter = new StubStripeAdapter()
  })

  describe('properties', () => {
    it('has the stub-stripe name', () => {
      expect(adapter.name).toBe('stub-stripe')
    })
  })

  describe('getCustomer', () => {
    it('returns a seeded customer by id', async () => {
      const customer = await adapter.getCustomer('token', 'cus_stub001')
      expect(customer.id).toBe('cus_stub001')
      expect(customer.email).toBe('patient1@example.com')
      expect(customer.name).toBe('Alice Patient')
      expect(customer.object).toBe('customer')
      expect(customer.livemode).toBe(false)
    })

    it('throws when customer not found', async () => {
      await expect(adapter.getCustomer('token', 'cus_nonexistent')).rejects.toThrow(
        'customer not found: cus_nonexistent',
      )
    })
  })

  describe('listCustomers', () => {
    it('returns all seeded customers without params', async () => {
      const result = await adapter.listCustomers('token')
      expect(result.data).toHaveLength(2)
      expect(result.has_more).toBe(false)
      expect(result.data[0].id).toBe('cus_stub001')
      expect(result.data[1].id).toBe('cus_stub002')
    })

    it('filters by email', async () => {
      const result = await adapter.listCustomers('token', {
        email: 'patient1@example.com',
      })
      expect(result.data).toHaveLength(1)
      expect(result.data[0].email).toBe('patient1@example.com')
    })

    it('respects limit param', async () => {
      const result = await adapter.listCustomers('token', { limit: 1 })
      expect(result.data).toHaveLength(1)
    })

    it('returns empty when email does not match', async () => {
      const result = await adapter.listCustomers('token', {
        email: 'nobody@example.com',
      })
      expect(result.data).toHaveLength(0)
    })
  })

  describe('createCustomer', () => {
    it('creates a new customer with generated id', async () => {
      const result = await adapter.createCustomer('token', {
        email: 'new@example.com',
        name: 'New Patient',
        phone: '+15550000000',
        description: 'New therapy patient',
        currency: 'usd',
        invoice_prefix: 'NEW1',
        tax_exempt: 'none',
      })
      expect(result.id).toMatch(/^cus_stub\d+$/)
      expect(result.email).toBe('new@example.com')
      expect(result.name).toBe('New Patient')
      expect(result.object).toBe('customer')
      expect(result.livemode).toBe(false)
      expect(result.tax_exempt).toBe('none')
    })

    it('stores created customer retrievable by getCustomer', async () => {
      const created = await adapter.createCustomer('token', {
        email: 'persist@example.com',
        name: 'Persist Test',
        tax_exempt: 'none',
      })
      const fetched = await adapter.getCustomer('token', created.id)
      expect(fetched.id).toBe(created.id)
      expect(fetched.email).toBe('persist@example.com')
    })

    it('handles address with null defaults', async () => {
      const result = await adapter.createCustomer('token', {
        email: 'addr@example.com',
        address: { city: 'Test City' },
        tax_exempt: 'none',
      })
      expect(result.address).toBeDefined()
      expect(result.address?.city).toBe('Test City')
      expect(result.address?.country).toBeNull()
      expect(result.address?.line1).toBeNull()
    })

    it('handles missing address (undefined)', async () => {
      const result = await adapter.createCustomer('token', {
        email: 'noaddr@example.com',
        tax_exempt: 'none',
      })
      expect(result.address).toBeUndefined()
    })

    it('uses default metadata when not provided', async () => {
      const result = await adapter.createCustomer('token', {
        email: 'meta@example.com',
        tax_exempt: 'none',
      })
      expect(result.metadata).toEqual({})
    })
  })

  describe('updateCustomer', () => {
    it('updates email on existing customer', async () => {
      const updated = await adapter.updateCustomer('token', 'cus_stub001', {
        email: 'updated@example.com',
      })
      expect(updated.email).toBe('updated@example.com')
      expect(updated.name).toBe('Alice Patient') // unchanged
    })

    it('updates name on existing customer', async () => {
      const updated = await adapter.updateCustomer('token', 'cus_stub002', {
        name: 'Bob Updated',
      })
      expect(updated.name).toBe('Bob Updated')
    })

    it('updates address replacing all fields', async () => {
      const updated = await adapter.updateCustomer('token', 'cus_stub001', {
        address: { city: 'New City' },
      })
      expect(updated.address?.city).toBe('New City')
      expect(updated.address?.country).toBeNull()
      expect(updated.address?.line1).toBeNull()
    })

    it('preserves address when not updating it', async () => {
      const original = await adapter.getCustomer('token', 'cus_stub001')
      const updated = await adapter.updateCustomer('token', 'cus_stub001', {
        name: 'Changed',
      })
      expect(updated.address).toEqual(original.address)
    })

    it('throws when customer not found', async () => {
      await expect(
        adapter.updateCustomer('token', 'cus_nonexistent', { name: 'X' }),
      ).rejects.toThrow('customer not found: cus_nonexistent')
    })
  })

  describe('getCharge', () => {
    it('returns a seeded charge by id', async () => {
      const charge = await adapter.getCharge('token', 'ch_stub001')
      expect(charge.id).toBe('ch_stub001')
      expect(charge.amount).toBe(15000)
      expect(charge.currency).toBe('usd')
      expect(charge.status).toBe('succeeded')
      expect(charge.paid).toBe(true)
    })

    it('throws when charge not found', async () => {
      await expect(adapter.getCharge('token', 'ch_nonexistent')).rejects.toThrow(
        'charge not found: ch_nonexistent',
      )
    })
  })

  describe('listCharges', () => {
    it('returns all seeded charges without params', async () => {
      const result = await adapter.listCharges('token')
      expect(result.data).toHaveLength(2)
      expect(result.has_more).toBe(false)
    })

    it('filters by customer', async () => {
      const result = await adapter.listCharges('token', {
        customer: 'cus_stub001',
      })
      expect(result.data).toHaveLength(1)
      expect(result.data[0].customer).toBe('cus_stub001')
    })

    it('respects limit param', async () => {
      const result = await adapter.listCharges('token', { limit: 1 })
      expect(result.data).toHaveLength(1)
    })
  })

  describe('createRefund', () => {
    it('refunds a charge by charge id', async () => {
      const result = await adapter.createRefund('token', {
        charge: 'ch_stub001',
      })
      expect(result.id).toBe('ch_stub001')
      expect(result.amount_refunded).toBe(15000)
      expect(result.refunded).toBe(true)
    })

    it('refunds a partial amount', async () => {
      const result = await adapter.createRefund('token', {
        charge: 'ch_stub001',
        amount: 5000,
      })
      expect(result.amount_refunded).toBe(5000)
      expect(result.refunded).toBe(false)
    })

    it('refunds by payment intent id', async () => {
      const result = await adapter.createRefund('token', {
        payment_intent: 'pi_stub002',
      })
      expect(result.id).toBe('ch_stub002')
      expect(result.amount_refunded).toBe(20000)
    })

    it('throws when charge not found for refund', async () => {
      await expect(
        adapter.createRefund('token', { charge: 'ch_nonexistent' }),
      ).rejects.toThrow('charge not found for refund: ch_nonexistent')
    })
  })

  describe('getPaymentIntent', () => {
    it('returns a payment intent derived from a charge', async () => {
      const intent = await adapter.getPaymentIntent('token', 'pi_stub001')
      expect(intent.id).toBe('pi_stub001')
      expect(intent.object).toBe('payment_intent')
      expect(intent.amount).toBe(15000)
      expect(intent.currency).toBe('usd')
      expect(intent.status).toBe('succeeded')
      expect(intent.payment_method_types).toEqual(['card'])
    })

    it('throws when payment intent not found', async () => {
      await expect(
        adapter.getPaymentIntent('token', 'pi_nonexistent'),
      ).rejects.toThrow('payment intent not found: pi_nonexistent')
    })
  })

  describe('getInvoice', () => {
    it('returns a seeded invoice by id', async () => {
      const invoice = await adapter.getInvoice('token', 'in_stub001')
      expect(invoice.id).toBe('in_stub001')
      expect(invoice.customer).toBe('cus_stub002')
      expect(invoice.status).toBe('paid')
      expect(invoice.amount_due).toBe(20000)
      expect(invoice.total).toBe(20000)
    })

    it('throws when invoice not found', async () => {
      await expect(adapter.getInvoice('token', 'in_nonexistent')).rejects.toThrow(
        'invoice not found: in_nonexistent',
      )
    })
  })

  describe('listInvoices', () => {
    it('returns all seeded invoices without params', async () => {
      const result = await adapter.listInvoices('token')
      expect(result.data).toHaveLength(1)
      expect(result.has_more).toBe(false)
    })

    it('filters by customer', async () => {
      const result = await adapter.listInvoices('token', {
        customer: 'cus_stub002',
      })
      expect(result.data).toHaveLength(1)
      expect(result.data[0].customer).toBe('cus_stub002')
    })

    it('filters by status', async () => {
      const result = await adapter.listInvoices('token', { status: 'paid' })
      expect(result.data).toHaveLength(1)
      expect(result.data[0].status).toBe('paid')
    })

    it('returns empty for non-matching status', async () => {
      const result = await adapter.listInvoices('token', { status: 'draft' })
      expect(result.data).toHaveLength(0)
    })
  })

  describe('createCheckoutSession', () => {
    it('creates a checkout session with generated id', async () => {
      const result = await adapter.createCheckoutSession('token', {
        mode: 'payment',
        success_url: 'https://example.com/success',
        cancel_url: 'https://example.com/cancel',
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: { name: 'Therapy Session' },
              unit_amount: 15000,
            },
            quantity: 1,
          },
        ],
      })
      expect(result.id).toMatch(/^cs_stub\d+$/)
      expect(result.object).toBe('checkout.session')
      expect(result.mode).toBe('payment')
      expect(result.status).toBe('open')
      expect(result.payment_status).toBe('unpaid')
      expect(result.amount_total).toBe(15000)
      expect(result.amount_subtotal).toBe(15000)
      expect(result.currency).toBe('usd')
      expect(result.url).toContain('https://checkout.stripe.com/c/pay/')
      expect(result.success_url).toBe('https://example.com/success')
      expect(result.cancel_url).toBe('https://example.com/cancel')
      expect(result.livemode).toBe(false)
    })

    it('sums multiple line items', async () => {
      const result = await adapter.createCheckoutSession('token', {
        mode: 'payment',
        success_url: 'https://example.com/success',
        cancel_url: 'https://example.com/cancel',
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: { name: 'Item 1' },
              unit_amount: 1000,
            },
            quantity: 2,
          },
          {
            price_data: {
              currency: 'usd',
              product_data: { name: 'Item 2' },
              unit_amount: 5000,
            },
            quantity: 1,
          },
        ],
      })
      expect(result.amount_total).toBe(7000)
      expect(result.amount_subtotal).toBe(7000)
    })

    it('defaults currency to usd when no line items', async () => {
      const result = await adapter.createCheckoutSession('token', {
        mode: 'payment',
        success_url: 'https://example.com/success',
        cancel_url: 'https://example.com/cancel',
      })
      expect(result.currency).toBe('usd')
      // amount_total is undefined when line_items is not provided (reduce on undefined)
      expect(result.amount_total).toBeUndefined()
    })

    it('uses default metadata when not provided', async () => {
      const result = await adapter.createCheckoutSession('token', {
        mode: 'setup',
        success_url: 'https://example.com/success',
        cancel_url: 'https://example.com/cancel',
      })
      expect(result.metadata).toEqual({})
    })
  })

  describe('id generation', () => {
    it('generates sequential ids across calls', async () => {
      const c1 = await adapter.createCustomer('token', {
        email: 'a@example.com',
        tax_exempt: 'none',
      })
      const c2 = await adapter.createCustomer('token', {
        email: 'b@example.com',
        tax_exempt: 'none',
      })
      expect(c1.id).not.toBe(c2.id)
    })
  })
})
