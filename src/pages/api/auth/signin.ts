import type { Provider } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

export const POST = async ({
  request,
  cookies,
  redirect,
}: {
  request: Request
  cookies: {
    set: (
      name: string,
      value: string,
      options?: Record<string, unknown>,
    ) => void
  }
  redirect: (path: string) => Response
}) => {
  const formData = await request.formData()
  const email = formData.get('email')?.toString()
  const password = formData.get('password')?.toString()
  const provider = formData.get('provider')?.toString()

  // Handle OAuth providers
  const validProviders = ['google', 'github', 'discord']
  if (provider && validProviders.includes(provider)) {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: provider as Provider,
        options: {
          redirectTo: new URL('/api/auth/callback', request.url).toString(),
        },
      })

      if (error) {
        console.error('OAuth error:', error)
        return new Response(error?.message, { status: 500 })
      }

      return redirect(data?.url)
    } catch (error) {
      console.error('OAuth error:', error)
      return new Response('An unexpected error occurred', { status: 500 })
    }
  }

  // Handle email/password login
  if (!email || !password) {
    return new Response('Email and password are required', { status: 400 })
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      console.error('Auth error:', error)
      return new Response(error?.message, { status: 401 })
    }

    // Set cookies for session managemen
    if (data && data.session) {
      const { access_token, refresh_token } = data.session
      cookies.set('sb-access-token', access_token, {
        path: '/',
        httpOnly: true,
        secure: import.meta.env.PROD,
        sameSite: 'lax',
        maxAge: 3600, // 1 hour
      })

      cookies.set('sb-refresh-token', refresh_token, {
        path: '/',
        httpOnly: true,
        secure: import.meta.env.PROD,
        sameSite: 'lax',
        maxAge: 7 * 24 * 3600, // 7 days
      })

      // Log the sign in for HIPAA compliance
      const { error: auditError } = await supabase.from('audit_logs').insert({
        user_id: data.user.id,
        action: 'user_signed_in',
        resource: 'auth',
        resource_id: data.user.id,
        metadata: {
          email: data.user.email,
        },
        ip_address:
          request.headers.get('x-forwarded-for') ||
          request.headers.get('x-real-ip'),
        user_agent: request.headers.get('user-agent'),
      })

      if (auditError) {
        console.error('Audit logging error:', auditError)
        // Continue anyway, as this is just logging
      }

      return redirect('/dashboard')
    }

    return new Response('Authentication failed', { status: 401 })
  } catch (error) {
    console.error('Sign in error:', error)
    return new Response('An unexpected error occurred', { status: 500 })
  }
}
