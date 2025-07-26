import type { AuthUser } from './types'
import { createClient } from '@supabase/supabase-js'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'

const logger = createBuildSafeLogger('session-utils')

/**
 * Get the current authenticated user
 * @param request The request object or Astro cookies
 * @returns The authenticated user or null if not authenticated
 */
export async function getUser(): Promise<AuthUser | null> {
  try {
    const supabase = createClient(
      import.meta.env.PUBLIC_SUPABASE_URL,
      import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
    )

    const { data, error } = await supabase.auth.getSession()

    if (error || !data?.session) {
      return null
    }

    const { user } = data.session

    // Get user role from profiles table
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    // Return the auth user
    return {
      id: user.id,
      email: user.email || '',
      name: user.user_metadata?.name || user.email?.split('@')[0] || '',
      role: profile?.role || 'user',
      permissions: [],
      metadata: user.user_metadata,
    }
  } catch (error) {
    logger.error('Error getting user:', error as Record<string, unknown>)
    return null
  }
}
