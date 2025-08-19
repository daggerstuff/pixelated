// import type { APIRoute } from 'astro'
import { MongoAuthService } from '@/services/mongoAuth.service'
import { createAuditLog, AuditEventType } from '@/lib/audit'

type CookieStore = {
  get(name: string): { value: string } | undefined
  delete(name: string, options?: { path?: string }): void
}

export const POST = async ({ cookies }: { cookies: CookieStore }) => {
  try {
    const authService = new MongoAuthService()

    // Get the auth token from cookies
    const token = cookies.get('auth-token')?.value

    if (token) {
      // Invalidate the session
      await authService.signOut(token)

      // Clear the auth cookie
      cookies.delete('auth-token', { path: '/' })
    }

    // Log the sign out for HIPAA compliance
    await createAuditLog(
      AuditEventType.LOGOUT,
      'auth.signout',
      'system',
      'auth',
      {
        timestamp: new Date().toISOString(),
      },
    )

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Logged out successfully',
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
  } catch (error: unknown) {
    console.error('Logout error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Logout failed',
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
