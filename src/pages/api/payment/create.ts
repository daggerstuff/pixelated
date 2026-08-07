import { getCurrentUser } from '@/lib/auth'
import {
  createPayramCheckoutLink,
  PayramApiError,
  PayramConfigError,
} from '@/lib/payment/payram'

export const prerender = false

type CreatePaymentRequestBody = {
  customerEmail?: string
  customerId?: string
  amountInUSD?: number
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export const POST = async ({ request }: { request: Request }) => {
  const user = await getCurrentUser(request)
  if (!user) {
    return jsonResponse(
      {
        success: false,
        error: 'Unauthorized',
        message: 'You must be authenticated to create a payment link',
      },
      401,
    )
  }

  let body: CreatePaymentRequestBody
  try {
    body = (await request.json()) as CreatePaymentRequestBody
  } catch {
    return jsonResponse(
      {
        success: false,
        error: 'Bad Request',
        message: 'Request body must be valid JSON',
      },
      400,
    )
  }

  const customerEmail = body.customerEmail?.trim()
  const customerId = body.customerId?.trim() || user.id
  const amountInUSD = body.amountInUSD

  if (!customerEmail) {
    return jsonResponse(
      {
        success: false,
        error: 'Bad Request',
        message: 'customerEmail is required',
      },
      400,
    )
  }

  if (!isValidEmail(customerEmail)) {
    return jsonResponse(
      {
        success: false,
        error: 'Bad Request',
        message: 'customerEmail must be a valid email address',
      },
      400,
    )
  }

  if (typeof amountInUSD !== 'number' || !Number.isFinite(amountInUSD)) {
    return jsonResponse(
      {
        success: false,
        error: 'Bad Request',
        message: 'amountInUSD must be a number',
      },
      400,
    )
  }

  if (amountInUSD <= 0) {
    return jsonResponse(
      {
        success: false,
        error: 'Bad Request',
        message: 'amountInUSD must be greater than zero',
      },
      400,
    )
  }

  try {
    const checkout = await createPayramCheckoutLink({
      customerEmail,
      customerId,
      amountInUSD,
    })

    return jsonResponse(
      {
        success: true,
        data: checkout,
        message: 'Checkout link created',
      },
      201,
    )
  } catch (error: unknown) {
    if (error instanceof PayramConfigError) {
      return jsonResponse(
        {
          success: false,
          error: 'Service Unavailable',
          message: error.message,
        },
        503,
      )
    }

    if (error instanceof PayramApiError) {
      return jsonResponse(
        {
          success: false,
          error: 'Payment Provider Error',
          message: error.message,
          details: error.details,
        },
        error.status >= 400 && error.status < 600 ? error.status : 502,
      )
    }

    return jsonResponse(
      {
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to create checkout link',
      },
      500,
    )
  }
}
