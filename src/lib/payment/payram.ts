import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'

const logger = createBuildSafeLogger('payram')

export type CreateCheckoutLinkInput = {
  customerEmail: string
  customerId: string
  amountInUSD: number
}

export type CreateCheckoutLinkResult = {
  host: string
  referenceId: string
  checkoutUrl: string
}

export class PayramConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PayramConfigError'
  }
}

export class PayramApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message)
    this.name = 'PayramApiError'
  }
}

type PayramCreatePaymentResponse = {
  host: string
  reference_id: string
  url: string
}

function getPayramConfig(): { apiKey: string; baseUrl: string } {
  const apiKey = process.env['PAYRAM_API_KEY']
  const baseUrl = process.env['PAYRAM_BASE_URL']

  if (!apiKey || !baseUrl) {
    throw new PayramConfigError(
      'PayRam is not configured. Set PAYRAM_API_KEY and PAYRAM_BASE_URL.',
    )
  }

  return { apiKey, baseUrl }
}

export async function createPayramCheckoutLink(
  input: CreateCheckoutLinkInput,
): Promise<CreateCheckoutLinkResult> {
  const { apiKey, baseUrl } = getPayramConfig()
  const endpoint = new URL('/api/v1/payment', baseUrl).toString()

  logger.info('Creating PayRam checkout link', {
    customerId: input.customerId,
    amountInUSD: input.amountInUSD,
  })

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'API-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      customerEmail: input.customerEmail,
      customerID: input.customerId,
      amountInUSD: input.amountInUSD,
    }),
  })

  const payload = (await response.json().catch(() => null)) as
    | PayramCreatePaymentResponse
    | { message?: string; error?: string }
    | null

  if (!response.ok) {
    const message =
      (payload && 'message' in payload && payload.message) ||
      (payload && 'error' in payload && payload.error) ||
      `PayRam request failed with status ${response.status}`

    throw new PayramApiError(message, response.status, payload)
  }

  if (
    !payload ||
    !('reference_id' in payload) ||
    !('url' in payload) ||
    !('host' in payload)
  ) {
    throw new PayramApiError(
      'PayRam returned an unexpected response shape',
      502,
      payload,
    )
  }

  return {
    host: payload.host,
    referenceId: payload.reference_id,
    checkoutUrl: payload.url,
  }
}
