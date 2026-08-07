/* @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}))

vi.mock('@/lib/payment/payram', () => ({
  createPayramCheckoutLink: vi.fn(),
  PayramApiError: class PayramApiError extends Error {
    constructor(
      message: string,
      readonly status: number,
      readonly details?: unknown,
    ) {
      super(message)
      this.name = 'PayramApiError'
    }
  },
  PayramConfigError: class PayramConfigError extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'PayramConfigError'
    }
  },
}))

import { getCurrentUser } from '@/lib/auth'
import {
  createPayramCheckoutLink,
  PayramApiError,
  PayramConfigError,
} from '@/lib/payment/payram'

import { POST } from '../create'

const mockGetCurrentUser = vi.mocked(getCurrentUser)
const mockCreatePayramCheckoutLink = vi.mocked(createPayramCheckoutLink)

function makeRequest(body: unknown): Request {
  return {
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Request
}

describe('POST /api/payment/create', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetCurrentUser.mockResolvedValue({
      id: 'user-123',
      role: 'user',
    })
  })

  it('returns 401 when unauthenticated', async () => {
    mockGetCurrentUser.mockResolvedValue(null)

    const response = await POST({ request: makeRequest({}) })
    const payload = await response.json()

    expect(response.status).toBe(401)
    expect(payload.success).toBe(false)
    expect(mockCreatePayramCheckoutLink).not.toHaveBeenCalled()
  })

  it('returns 400 when customerEmail is missing', async () => {
    const response = await POST({
      request: makeRequest({ amountInUSD: 10 }),
    })
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.message).toContain('customerEmail')
  })

  it('returns 400 when amountInUSD is invalid', async () => {
    const response = await POST({
      request: makeRequest({
        customerEmail: 'customer@example.com',
        amountInUSD: 0,
      }),
    })
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.message).toContain('greater than zero')
  })

  it('creates a checkout link for authenticated users', async () => {
    mockCreatePayramCheckoutLink.mockResolvedValue({
      host: 'https://payram.example.com',
      referenceId: 'ref-123',
      checkoutUrl: 'https://payram.example.com/payments?reference_id=ref-123',
    })

    const response = await POST({
      request: makeRequest({
        customerEmail: 'customer@example.com',
        amountInUSD: 49.99,
      }),
    })
    const payload = await response.json()

    expect(response.status).toBe(201)
    expect(payload.success).toBe(true)
    expect(payload.data.checkoutUrl).toContain('ref-123')
    expect(mockCreatePayramCheckoutLink).toHaveBeenCalledWith({
      customerEmail: 'customer@example.com',
      customerId: 'user-123',
      amountInUSD: 49.99,
    })
  })

  it('maps PayRam configuration errors to 503', async () => {
    mockCreatePayramCheckoutLink.mockRejectedValue(
      new PayramConfigError('PayRam is not configured'),
    )

    const response = await POST({
      request: makeRequest({
        customerEmail: 'customer@example.com',
        amountInUSD: 10,
      }),
    })
    const payload = await response.json()

    expect(response.status).toBe(503)
    expect(payload.error).toBe('Service Unavailable')
  })

  it('maps PayRam API errors to provider status codes', async () => {
    mockCreatePayramCheckoutLink.mockRejectedValue(
      new PayramApiError('Invalid amount', 422, { code: 'invalid_amount' }),
    )

    const response = await POST({
      request: makeRequest({
        customerEmail: 'customer@example.com',
        amountInUSD: 10,
      }),
    })
    const payload = await response.json()

    expect(response.status).toBe(422)
    expect(payload.error).toBe('Payment Provider Error')
  })
})
