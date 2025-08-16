import { AuditEventType, createAuditLog } from '@/lib/audit'
import { MongoAuthService } from '@/services/mongoAuth.service'
import mongodb from '@/config/mongodb.config'

export const GET: APIRoute = async ({
  url,
  cookies,
  redirect,
}: {
  url: URL
  cookies: {
    set: (
      name: string,
      value: string,
      options?: Record<string, unknown>,
    ) => void
  }
  redirect: (path: string) => Response
}) => {
  const authCode = url.searchParams.get('code')

  if (!authCode) {
    return new Response('No code provided', { status: 400 })
  }

  try {
    const authService = new MongoAuthService()

    // For OAuth callback, we would need to exchange the code with the OAuth provider
    // This is a simplified implementation - you may need to adapt based on your OAuth setup
    const { user, token } = await authService.verifyOAuthCode(authCode)

    // Set cookies for session management
    cookies.set('auth-token', token, {
      path: '/',
      httpOnly: true,
      secure: import.meta.env.PROD,
      sameSite: 'lax',
      maxAge: 7 * 24 * 3600, // 7 days
    })

    // Check if user has a profile, create one if needed
    if (user) {
      const db = await mongodb.connect()
      const profilesCollection = db.collection('profiles')

      const existingProfile = await profilesCollection.findOne({
        userId: user._id,
      })

      if (!existingProfile) {
        // Create a profile for the user
        await profilesCollection.insertOne({
          userId: user._id,
          fullName: user.metadata?.fullName || null,
          avatarUrl: user.metadata?.avatarUrl || null,
          role: user.role,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      }

      // Log the sign in for HIPAA compliance
      await createAuditLog(
        AuditEventType.LOGIN,
        'auth.signin.oauth',
        user._id.toString(),
        'auth',
        {
          email: user.email,
          provider: user.metadata?.provider || 'oauth',
        },
      )
    }

    return redirect('/dashboard')
  } catch (error) {
    console.error('Auth callback error:', error)
    return new Response('Authentication failed', { status: 500 })
  }
}
