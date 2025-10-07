import { updatePassword } from '../../../services/auth.service'

export const POST = async ({
  request,
  cookies,
}: {
  request: Request
  cookies: {
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

    // Update the password using the AuthService
    await updatePassword(password)

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
          error instanceof Error ? String(error) : 'Failed to update password',
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
