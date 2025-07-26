import { createClient } from '@supabase/supabase-js'

interface AuthInfo {
  userId: string
  role: string
  session: string
}

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
)

/**
 * Verify and decode the auth token
 * @param authHeader The Authorization header value
 * @returns The decoded auth context
 * @throws Error if token is invalid
 */
export async function verifyAuthToken(authHeader: string): Promise<AuthInfo> {
  if (!authHeader.startsWith('Bearer ')) {
    throw new Error('Invalid token format')
  }

  const token = authHeader.split(' ')[1]
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token)

  if (error || !user) {
    throw new Error('Invalid token')
  }

  // Get user's role from profiles table
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  return {
    userId: user.id,
    role: profile?.role || 'user',
    session: token,
  }
}
