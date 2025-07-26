import type {
  SupabaseClient,
  SupabaseClientOptions,
} from '@supabase/supabase-js'
import type { Database } from '../types/supabase'
import { createClient } from '@supabase/supabase-js'
import config from './env.config'

/**
 * Supabase configuration options
 */
export const supabaseConfig = {
  url: config.supabase.url() || '',
  anonKey: config.supabase.anonKey() || '',
  serviceRoleKey: config.supabase.serviceRoleKey() || '',
  jwtSecret: config.supabase.jwtSecret() || '',

  /**
   * Default Supabase client options
   */
  clientOptions: {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
    },
  } as SupabaseClientOptions<Database>,
}

/**
 * Create and export a singleton Supabase client instance
 * This client uses the anonymous key for browser-based access
 */
export const supabaseClient = createClient<Database>(
  supabaseConfig.url,
  supabaseConfig.anonKey,
  {
    ...supabaseConfig.clientOptions,
    db: {
      schema: 'public',
    },
  },
)

/**
 * Create a Supabase admin client with the service role key
 * This should ONLY be used in server-side code, never in the browser
 */
export function createAdminClient(): SupabaseClient<Database, 'public'> {
  if (!supabaseConfig.serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not defined')
  }

  return createClient<Database, 'public'>(
    supabaseConfig.url,
    supabaseConfig.serviceRoleKey,
    {
      ...supabaseConfig.clientOptions,
      auth: {
        ...supabaseConfig.clientOptions.auth,
        persistSession: false,
      },
      db: {
        schema: 'public' as const,
      },
    } as SupabaseClientOptions<'public'>,
  )
}

/**
 * Create a new client with custom options
 * Useful for server-side rendering or custom configurations
 */
export function createCustomClient(options = {}): SupabaseClient<Database> {
  return createClient<Database, 'public'>(
    supabaseConfig.url,
    supabaseConfig.anonKey,
    {
      ...supabaseConfig.clientOptions,
      ...options,
      db: {
        schema: 'public' as const,
      },
    },
  )
}

export default {
  supabaseConfig,
  supabaseClient,
  createAdminClient,
  createCustomClient,
}
