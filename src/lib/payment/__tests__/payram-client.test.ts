/* @vitest-environment node */

import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  getPaymentStatus,
  isPaidState,
  PayRamApiError,
  PayRamConfigError,
} from '../payram-client'

describe('payram-client', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  describe('isPaidState', () => {
    it('returns true for FILLED and OVER_FILLED', () => {
      expect(isPaidState('FILLED')).toBe(true)
      expect(isPaidState('OVER_FILLED')).toBe(true)
    })

    it('returns false for pending or cancelled states', () => {
      expect(isPaidState('OPEN')).toBe(false)
      expect(isPaidState('PARTIALLY_FILLED')).toBe(false)
      expect(isPaidState('CANCELLED')).toBe(false)
    })
  })

  describe('getPaymentStatus', () => {
    it('fetches and parses a successful PayRam response', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            invoiceID: 'inv-1',
            customerID: '42',
            amountInUSD: '9.99',
            paymentState: 'FILLED',
            merchantName: 'Premium',
            referenceID: 'c80f5363-0397-4761-aa1a-3155c3a21470',
            createdAt: '2025-11-07T11:37:59.012304Z',
          }),
          { status: 200 },
        ),
      )
      vi.stubGlobal('fetch', fetchMock)

      const status = await getPaymentStatus(
        'c80f5363-0397-4761-aa1a-3155c3a21470',
        {
          baseUrl: 'https://payram.example.com:8443',
          apiKey: 'test-key',
        },
      )

      expect(fetchMock).toHaveBeenCalledWith(
        'https://payram.example.com:8443/api/v1/payment/reference/c80f5363-0397-4761-aa1a-3155c3a21470',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'API-Key': 'test-key',
          }),
        }),
      )
      expect(status.paymentState).toBe('FILLED')
      expect(status.referenceID).toBe(
        'c80f5363-0397-4761-aa1a-3155c3a21470',
      )
    })

    it('throws PayRamApiError when reference is not found', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(new Response('not found', { status: 404 })),
      )

      await expect(
        getPaymentStatus('c80f5363-0397-4761-aa1a-3155c3a21470', {
          baseUrl: 'https://payram.example.com',
          apiKey: 'test-key',
        }),
      ).rejects.toMatchObject({
        name: 'PayRamApiError',
        status: 404,
      })
    })

    it('throws PayRamConfigError when env vars are missing', async () => {
      const originalBaseUrl = process.env['PAYRAM_BASE_URL']
      const originalApiKey = process.env['PAYRAM_API_KEY']
      delete process.env['PAYRAM_BASE_URL']
      delete process.env['PAYRAM_API_KEY']

      try {
        await expect(
          getPaymentStatus('c80f5363-0397-4761-aa1a-3155c3a21470'),
        ).rejects.toBeInstanceOf(PayRamConfigError)
      } finally {
        if (originalBaseUrl) {
          process.env['PAYRAM_BASE_URL'] = originalBaseUrl
        }
        if (originalApiKey) {
          process.env['PAYRAM_API_KEY'] = originalApiKey
        }
      }
    })
  })
})
