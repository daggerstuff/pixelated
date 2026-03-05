import type { APIContext } from 'astro'
// import { updatePasswordWithToken } from '../../../services/auth.service'

export const POST = async ({ request, cookies }: APIContext) => {
  try {
    // Parse the request body to get the new password
    const { password } = await request.json()

    if (!password || password.length < 8) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Password must be at least 8 characters long',
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

    const _email = emailCookie.value
    const _token = tokenCookie.value

    // PASSWORD UPDATE DEPRECATED IN MIGRATION TO AUTH0
    // The previous implementation relied on a MongoDB-based auth service that has been replaced.
    // Auth0 handles password resets via its own Universal Login flow and email links.
    // For manual updates, we would need a valid user ID, not a recovery token.

    return new Response(
      JSON.stringify({
        success: false,
        message: 'Password updates should be performed via Auth0 Universal Login or Management Dashboard.',
      }),
      {
        status: 501,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )

    /* 
    Legacy implementation removed:
    // Update the password using the AuthService with token verification
    await updatePasswordWithToken(email, token, password)
    */

    // Clear the recovery cookies
    cookies.delete('auth_recovery_token')
    cookies.delete('auth_recovery_email')

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Password successfully updated',
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
  } catch (error: unknown) {
    console.error('Error updating password:', error)

    return new Response(
      JSON.stringify({
        success: false,
        message:
          error instanceof Error ? error.message : 'Failed to update password',
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
