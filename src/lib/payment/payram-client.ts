import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'

import type { PayRamPaymentState, PayRamPaymentStatus } from './types'

const logger = createBuildSafeLogger('payram-client')

const PAYRAM_PAYMENT_STATES = new Set<PayRamPaymentState>([
  'OPEN',
  'CANCELLED',
  'FILLED',
  'PARTIALLY_FILLED',
  'OVER_FILLED',
])

export class PayRamConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PayRamConfigError'
  }
}

export class PayRamApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'PayRamApiError'
  }
}

export function getPayRamConfig(): { baseUrl: string; apiKey: string } {
  const baseUrl = process.env['PAYRAM_BASE_URL']?.trim()
  const apiKey = process.env['PAYRAM_API_KEY']?.trim()

  if (!baseUrl || !apiKey) {
    throw new PayRamConfigError(
      'PayRam is not configured. Set PAYRAM_BASE_URL and PAYRAM_API_KEY.',
    )
  }

  return { baseUrl: baseUrl.replace(/\/$/, ''), apiKey }
}

export function isPaidState(paymentState: PayRamPaymentState): boolean {
  return paymentState === 'FILLED' || paymentState === 'OVER_FILLED'
}

function parsePaymentStatus(payload: unknown): PayRamPaymentStatus {
  if (!payload || typeof payload !== 'object') {
    throw new PayRamApiError('Invalid PayRam response payload', 502)
  }

  const data = payload as Record<string, unknown>
  const paymentState = data['paymentState']

  if (
    typeof paymentState !== 'string' ||
    !PAYRAM_PAYMENT_STATES.has(paymentState as PayRamPaymentState)
  ) {
    throw new PayRamApiError('PayRam response missing paymentState', 502)
  }

  const referenceID = data['referenceID']
  const invoiceID = data['invoiceID']
  const amountInUSD = data['amountInUSD']
  const createdAt = data['createdAt']

  if (
    typeof referenceID !== 'string' ||
    typeof invoiceID !== 'string' ||
    typeof amountInUSD !== 'string' ||
    typeof createdAt !== 'string'
  ) {
    throw new PayRamApiError('PayRam response missing required fields', 502)
  }

  return {
    invoiceID,
    customerID:
      typeof data['customerID'] === 'string' ? data['customerID'] : '0',
    amountInUSD,
    paymentState: paymentState as PayRamPaymentState,
    merchantName:
      typeof data['merchantName'] === 'string' ? data['merchantName'] : '',
    referenceID,
    createdAt,
  }
}

/**
 * Poll PayRam for the current payment status by reference ID.
 *
 * @see https://docs.payram.com/api-integration/payments-api/payment-status
 */
export async function getPaymentStatus(
  referenceId: string,
  config = getPayRamConfig(),
): Promise<PayRamPaymentStatus> {
  const url = `${config.baseUrl}/api/v1/payment/reference/${encodeURIComponent(referenceId)}`

  logger.info('Polling PayRam payment status', { referenceId })

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'API-Key': config.apiKey,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    logger.warn('PayRam payment status request failed', {
      referenceId,
      status: response.status,
      body: body.slice(0, 200),
    })
    throw new PayRamApiError(
      response.status === 404
        ? 'Payment reference not found'
        : 'Failed to fetch payment status from PayRam',
      response.status === 404 ? 404 : 502,
    )
  }

  const payload: unknown = await response.json()
  return parsePaymentStatus(payload)
}
