import { AuditEventType, createAuditLog } from '@/lib/audit'
import mongodb from '@/config/mongodb.config'

export const GET = async ({
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
    // For OAuth callback, we would need to exchange the code with the OAuth provider
    // Delegate to adapter which proxies to the runtime mongoAuthService
    interface OAuthVerificationResult {
      user: {
        _id: string | { toString(): string }
        email: string
        role: string
        metadata?: {
          fullName?: string
          avatarUrl?: string
          provider?: string
        }
      }
      token: string
    }
    const { user, token } = (await (
      await import('@/adapters/betterAuthMongoAdapter')
    ).verifyOAuthCode(authCode)) as OAuthVerificationResult

    // Set cookies for session management
    cookies.set('auth-token', token, {
      path: '/',
      httpOnly: true,
      secure: import.meta.env.PROD,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
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
  } catch (error: unknown) {
    console.error('Auth callback error:', error)
    return new Response('Authentication failed', { status: 500 })
  }
}
