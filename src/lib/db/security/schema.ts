import { createClient } from '@supabase/supabase-js'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'

// Initialize logger
const logger = createBuildSafeLogger('security-schema')

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL
const supabaseKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY

// Create mock client for builds without proper credentials
function createMockClient() {
  const message =
    process.env['NODE_ENV'] === 'production'
      ? 'CRITICAL: Using mock Supabase client in production. This should never happen.'
      : 'Using mock Supabase client for security schema in development.'

  logger.warn(message)

  return {
    rpc: () => Promise.resolve({ data: null, error: null }),
  }
}

// Create Supabase admin client only if we have valid credentials
const supabaseAdmin =
  supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      })
    : createMockClient()

/**
 * Initialize security tables in the database
 */
export async function initializeSecurityTables(): Promise<void> {
  try {
    // Create security_events table
    await supabaseAdmin.rpc('exec_sql', {
      query: `
      CREATE TABLE IF NOT EXISTS security_events (
        id SERIAL PRIMARY KEY,
        type VARCHAR(_50) NOT NULL,
        user_id VARCHAR(_255),
        ip_address VARCHAR(_50),
        user_agent TEXT,
        metadata JSONB,
        severity VARCHAR(_20) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
    `,
    })

    // Create indexes for better query performance
    await supabaseAdmin.rpc('exec_sql', {
      query: `
      CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events (type);
      CREATE INDEX IF NOT EXISTS idx_security_events_user_id ON security_events (user_id);
      CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events (severity);
      CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON security_events (created_at);
    `,
    })

    console.warn('Security tables initialized successfully')
  } catch (error) {
    console.error(
      'Failed to initialize security tables:',
      error instanceof Error ? error : new Error(String(error)),
    )
    throw error instanceof Error ? error : new Error(String(error))
  }
}

/**
 * Initialize security database
 */
export async function initializeSecurityDatabase(): Promise<void> {
  try {
    await initializeSecurityTables()
  } catch (error) {
    console.error(
      'Failed to initialize security database:',
      error instanceof Error ? error : new Error(String(error)),
    )
    throw error instanceof Error ? error : new Error(String(error))
  }
}
