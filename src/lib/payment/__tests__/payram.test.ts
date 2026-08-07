/* @vitest-environment node */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createPayramCheckoutLink,
  PayramApiError,
  PayramConfigError,
} from '../payram'

describe('createPayramCheckoutLink', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    process.env['PAYRAM_API_KEY'] = 'test-api-key'
    process.env['PAYRAM_BASE_URL'] = 'https://payram.example.com'
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    delete process.env['PAYRAM_API_KEY']
    delete process.env['PAYRAM_BASE_URL']
    vi.restoreAllMocks()
  })

  it('throws when PayRam env vars are missing', async () => {
    delete process.env['PAYRAM_API_KEY']

    await expect(
      createPayramCheckoutLink({
        customerEmail: 'customer@example.com',
        customerId: 'cust-1',
        amountInUSD: 10,
      }),
    ).rejects.toBeInstanceOf(PayramConfigError)
  })

  it('calls PayRam and maps the checkout response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        host: 'https://payram.example.com',
        reference_id: 'ref-abc',
        url: 'https://payram.example.com/payments?reference_id=ref-abc',
      }),
    }) as unknown as typeof fetch

    const result = await createPayramCheckoutLink({
      customerEmail: 'customer@example.com',
      customerId: 'cust-1',
      amountInUSD: 25,
    })

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://payram.example.com/api/v1/payment',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'API-Key': 'test-api-key',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerEmail: 'customer@example.com',
          customerID: 'cust-1',
          amountInUSD: 25,
        }),
      }),
    )
    expect(result).toEqual({
      host: 'https://payram.example.com',
      referenceId: 'ref-abc',
      checkoutUrl:
        'https://payram.example.com/payments?reference_id=ref-abc',
    })
  })

  it('throws PayramApiError when PayRam returns an error response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: vi.fn().mockResolvedValue({ message: 'Invalid customer email' }),
    }) as unknown as typeof fetch

    await expect(
      createPayramCheckoutLink({
        customerEmail: 'bad-email',
        customerId: 'cust-1',
        amountInUSD: 10,
      }),
    ).rejects.toMatchObject({
      name: 'PayramApiError',
      status: 400,
      message: 'Invalid customer email',
    })
  })
})
