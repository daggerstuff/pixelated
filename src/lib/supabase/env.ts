/**
 * Environment variable access helper
 * Safely handles environment variables for both Astro/Vite and Node.js environments
 */
import { getEnv } from '@/lib/utils/env'

export interface SupabaseEnv {
  url: string
  anonKey: string
  serviceRoleKey?: string
}

/**
 * Get environment variables in a TypeScript-safe way
 */
export function getEnvVars(): SupabaseEnv {
  let url: string | undefined
  let anonKey: string | undefined
  let serviceRoleKey: string | undefined

  // Try to get from global environment first (works in most contexts)
  if (typeof globalThis !== 'undefined') {
    // Check if we're in a browser environment with Astro/Vite injected env
    const win = globalThis as {
      __astro_env?: Record<string, string>
      __vite_env?: Record<string, string>
    }
    if (win.__astro_env || win.__vite_env) {
      const env = win.__astro_env || win.__vite_env
      if (env) {
        url = env['PUBLIC_SUPABASE_URL']
        anonKey = env['PUBLIC_SUPABASE_ANON_KEY']
        serviceRoleKey = env['SUPABASE_SERVICE_ROLE_KEY']
      }
    }
  }

  // Try process.env (Node.js environment)
  if ((!url || !anonKey) && typeof process !== 'undefined' && process.env) {
    url = url || getEnv('PUBLIC_SUPABASE_URL')
    anonKey = anonKey || getEnv('PUBLIC_SUPABASE_ANON_KEY')
    serviceRoleKey = serviceRoleKey || getEnv('SUPABASE_SERVICE_ROLE_KEY')
  }

  // Try to dynamically access import.meta.env if available
  if (!url || !anonKey) {
    try {
      // Use Function constructor to avoid TypeScript import.meta issues
      const getImportMeta = new Function(
        'return typeof import !== "undefined" ? import.meta : undefined',
      )
      const importMeta = getImportMeta()
      if (importMeta && importMeta.env) {
        url = url || importMeta.env['PUBLIC_SUPABASE_URL']
        anonKey = anonKey || importMeta.env['PUBLIC_SUPABASE_ANON_KEY']
        serviceRoleKey =
          serviceRoleKey || importMeta.env['SUPABASE_SERVICE_ROLE_KEY']
      }
    } catch {
      // Silently fail if import.meta is not available
    }
  }

  // Fallback to hardcoded values for development (should be overridden by actual env vars)
  if (!url || !anonKey) {
    console.warn(
      'Supabase environment variables not found, using fallback values',
    )
    url = url || 'https://your-project.supabase.co'
    anonKey = anonKey || 'your-anon-key'
  }

  return {
    url: url!,
    anonKey: anonKey!,
    serviceRoleKey,
  }
}
