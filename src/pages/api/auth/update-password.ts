import { updatePasswordWithToken } from '../../../services/auth.service'
import { mongoAuthService } from '../../../lib/db/mongoClient'

export const POST = async ({
  request,
  cookies,
}: {
  request: Request
  cookies: {
    get: (name: string) => { value: string } | undefined
    delete: (name: string, options?: Record<string, unknown>) => void
  }
}) => {
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

    if (!emailCookie || !tokenCookie) {
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

    const email = emailCookie.value
    const token = tokenCookie.value

    // Update the password using the AuthService with token verification
    await updatePasswordWithToken(email, token, password)

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
