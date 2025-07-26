import type { Database } from '../../types/supabase'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getEnvVars } from './env'

interface SupabaseConfig {
  url: string
  anonKey: string
  serviceRoleKey?: string
}

// Module-level state
let clientInstance: SupabaseClient<Database> | null = null
let config: SupabaseConfig | null = null

function validateConfig(): SupabaseConfig {
  // Use the environment helper to get variables in a TypeScript-safe way
  const { url, anonKey, serviceRoleKey } = getEnvVars()

  if (!url || !anonKey) {
    throw new Error(
      'Missing required Supabase configuration. Please check your environment variables.',
    )
  }

  // Validate URL format
  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
  } catch {
    throw new Error('Invalid Supabase URL format')
  }

  // Use parsedUrl to avoid unused variable warning
  if (!parsedUrl.protocol.startsWith('http')) {
    throw new Error('Invalid Supabase URL protocol')
  }

  // Validate key format (basic check)
  if (anonKey.length < 100 || !anonKey.includes('.')) {
    throw new Error('Invalid Supabase anonymous key format')
  }

  return { url, anonKey, serviceRoleKey }
}

function createClientInstance(
  clientConfig: SupabaseConfig,
): SupabaseClient<Database> {
  return createClient<Database>(clientConfig.url, clientConfig.anonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    },
    global: {
      headers: {
        'X-Client-Info': 'pixelated-empathy-web',
      },
    },
    db: {
      schema: 'public',
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  })
}

function setupHealthCheck(client: SupabaseClient<Database>): void {
  if (typeof window === 'undefined') {
    return
  }

  // Monitor auth state changes
  client.auth.onAuthStateChange((event) => {
    if (
      (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') &&
      'caches' in window
    ) {
      caches.keys().then((names) => {
        names.forEach((name) => {
          if (name.includes('supabase')) {
            caches.delete(name)
          }
        })
      })
    }
  })

  // Periodic connection health check
  setInterval(async () => {
    try {
      await client.from('health_check').select('1').limit(1)
    } catch (error) {
      console.warn('Supabase connection health check failed:', error)
    }
  }, 300000) // 5 minutes
}

function getInstance(): SupabaseClient<Database> {
  if (!clientInstance) {
    config = validateConfig()
    clientInstance = createClientInstance(config)
    setupHealthCheck(clientInstance)
  }
  return clientInstance
}

function getServiceClient(): SupabaseClient<Database> {
  if (!config?.serviceRoleKey) {
    throw new Error('Service role key not configured')
  }

  return createClient<Database>(config.url, config.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        'X-Client-Info': 'pixelated-empathy-service',
      },
    },
  })
}

// Export singleton instance
export const supabase = getInstance()

// Export service client getter for server-side operations
export { getServiceClient }

// Export types for better TypeScript support
export type { Database } from '../../types/supabase'
export type SupabaseClientType = SupabaseClient<Database>
