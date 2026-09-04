import type { APIContext } from 'astro'
import { z } from 'zod'
import { validateRequestBody } from '../../../lib/validation/validateRequestBody'

const updatePasswordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters long'),
})

export const POST = async ({ request, cookies }: APIContext) => {
  try {
    const [body, validationError] = await validateRequestBody(
      request,
      updatePasswordSchema,
    )
    if (validationError) {
      const firstError = Object.values(validationError.details)[0] ?? 'Invalid request body'
      return new Response(
        JSON.stringify({
          success: false,
          message: firstError,
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
    }

    // Get email and token from cookies
    const emailCookie = cookies.get('auth_recovery_email')
    const tokenCookie = cookies.get('auth_recovery_token')

    if (!emailCookie?.value || !tokenCookie?.value) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Missing authentication credentials',
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
    }

    // PASSWORD UPDATE DEPRECATED IN MIGRATION TO AUTH0
    // The previous implementation relied on a MongoDB-based auth service that has been replaced.
    // Auth0 handles password resets via its own Universal Login flow and email links.
    // For manual updates, we would need a valid user ID, not a recovery token.

    return new Response(
      JSON.stringify({
        success: false,
        message:
          'Password updates should be performed via Auth0 Universal Login or Management Dashboard.',
      }),
      {
        status: 501,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
  } catch (error: unknown) {

    return new Response(
      JSON.stringify({
        success: false,
        message:
          error instanceof Error
            ? error instanceof Error
              ? error.message
              : 'Unknown error'
            : 'Failed to update password',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
  }
}
