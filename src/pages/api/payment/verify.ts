import { z } from 'zod'

import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'
import {
  getPaymentStatus,
  isPaidState,
  PayRamApiError,
  PayRamConfigError,
} from '@/lib/payment/payram-client'
import type { PaymentVerifyResponse } from '@/lib/payment/types'

export const prerender = false

const logger = createBuildSafeLogger('payment-verify-api')

const referenceIdSchema = z.string().uuid('referenceId must be a valid UUID')

/**
 * GET /api/payment/verify?referenceId=<uuid>
 *
 * Polls PayRam for the current payment status. Used by the frontend after
 * checkout redirect to determine whether premium access should be unlocked.
 */
export const GET = async ({
  request,
  url,
}: {
  request: Request
  url: URL
}) => {
  const referenceId = url.searchParams.get('referenceId')

  if (!referenceId) {
    return jsonResponse(
      { success: false, message: 'referenceId query parameter is required' },
      400,
    )
  }

  const validation = referenceIdSchema.safeParse(referenceId)
  if (!validation.success) {
    return jsonResponse(
      {
        success: false,
        message: 'Invalid referenceId',
        errors: z.flattenError(validation.error).fieldErrors,
      },
      400,
    )
  }

  try {
    const payment = await getPaymentStatus(referenceId)

    const body: PaymentVerifyResponse = {
      success: true,
      referenceId: payment.referenceID,
      paymentState: payment.paymentState,
      isPaid: isPaidState(payment.paymentState),
      amountInUSD: payment.amountInUSD,
      invoiceID: payment.invoiceID,
      createdAt: payment.createdAt,
    }

    logger.info('Payment status polled', {
      referenceId,
      paymentState: payment.paymentState,
      isPaid: body.isPaid,
    })

    return jsonResponse(body, 200)
  } catch (error: unknown) {
    if (error instanceof PayRamConfigError) {
      logger.error('PayRam not configured', { error })
      return jsonResponse(
        { success: false, message: 'Payment provider is not configured' },
        503,
      )
    }

    if (error instanceof PayRamApiError) {
      return jsonResponse(
        { success: false, message: error.message },
        error.status,
      )
    }

    logger.error('Payment verify failed', {
      referenceId,
      error,
      ip: request.headers.get('x-forwarded-for') ?? 'unknown',
    })

    return jsonResponse(
      { success: false, message: 'Failed to verify payment status' },
      500,
    )
  }
}

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
    },
  })
}
