/* @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/payment/payram-client', () => ({
  getPaymentStatus: vi.fn(),
  isPaidState: vi.fn((state: string) =>
    state === 'FILLED' || state === 'OVER_FILLED',
  ),
  PayRamApiError: class PayRamApiError extends Error {
    constructor(
      message: string,
      readonly status: number,
    ) {
      super(message)
      this.name = 'PayRamApiError'
    }
  },
  PayRamConfigError: class PayRamConfigError extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'PayRamConfigError'
    }
  },
}))

import {
  getPaymentStatus,
  PayRamApiError,
  PayRamConfigError,
} from '@/lib/payment/payram-client'

import { GET } from '../verify'

const mockGetPaymentStatus = vi.mocked(getPaymentStatus)

describe('GET /api/payment/verify', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 400 when referenceId is missing', async () => {
    const response = await GET({
      request: new Request('http://localhost/api/payment/verify'),
      url: new URL('http://localhost/api/payment/verify'),
    })

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.success).toBe(false)
  })

  it('returns payment status when referenceId is valid', async () => {
    mockGetPaymentStatus.mockResolvedValue({
      invoiceID: 'inv-1',
      customerID: '1',
      amountInUSD: '9.99',
      paymentState: 'FILLED',
      merchantName: 'Premium',
      referenceID: 'c80f5363-0397-4761-aa1a-3155c3a21470',
      createdAt: '2025-11-07T11:37:59.012304Z',
    })

    const url = new URL(
      'http://localhost/api/payment/verify?referenceId=c80f5363-0397-4761-aa1a-3155c3a21470',
    )
    const response = await GET({
      request: new Request(url.toString()),
      url,
    })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual({
      success: true,
      referenceId: 'c80f5363-0397-4761-aa1a-3155c3a21470',
      paymentState: 'FILLED',
      isPaid: true,
      amountInUSD: '9.99',
      invoiceID: 'inv-1',
      createdAt: '2025-11-07T11:37:59.012304Z',
    })
  })

  it('returns 404 when PayRam cannot find the reference', async () => {
    mockGetPaymentStatus.mockRejectedValue(
      new PayRamApiError('Payment reference not found', 404),
    )

    const url = new URL(
      'http://localhost/api/payment/verify?referenceId=c80f5363-0397-4761-aa1a-3155c3a21470',
    )
    const response = await GET({
      request: new Request(url.toString()),
      url,
    })

    expect(response.status).toBe(404)
    const body = await response.json()
    expect(body.message).toBe('Payment reference not found')
  })

  it('returns 503 when PayRam is not configured', async () => {
    mockGetPaymentStatus.mockRejectedValue(
      new PayRamConfigError('PayRam is not configured'),
    )

    const url = new URL(
      'http://localhost/api/payment/verify?referenceId=c80f5363-0397-4761-aa1a-3155c3a21470',
    )
    const response = await GET({
      request: new Request(url.toString()),
      url,
    })

    expect(response.status).toBe(503)
  })
})
