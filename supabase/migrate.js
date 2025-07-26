import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

// Get current file directory (ES module equivalent of __dirname)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

// Supabase connection
const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error(
    'Missing Supabase URL or service role key in environment variables',
  )
  process.exit(1)
}

// Create Supabase client with service role key for admin access
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

// Function to read and execute migration files
async function runMigrations() {
  try {
    console.log('Starting database migrations...')

    // Get migration files sorted by name (which should follow a timestamp convention)
    const migrationsDir = path.join(__dirname, 'migrations')
    const migrationFiles = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort()

    console.log(`Found ${migrationFiles.length} migration files`)

    // Execute each migration file
    // Note: We're intentionally using await in a loop here because migrations must be applied sequentially
    for (const file of migrationFiles) {
      console.log(`Running migration: ${file}`)
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8')

      // Execute the SQL against the database
      const { error } = await supabase.rpc('exec_sql', { sql_query: sql })

      if (error) {
        console.error(`Error in migration ${file}:`, error)
        throw error
      }

      console.log(`Successfully applied migration: ${file}`)
    }

    console.log('All migrations completed successfully')
  } catch (error) {
    console.error('Migration failed:', error)
    process.exit(1)
  }
}

// Function to set up storage buckets
async function setupStorageBuckets() {
  try {
    console.log('Setting up storage buckets...')

    // Define the buckets to create
    const buckets = [
      { name: 'avatars', public: true },
      { name: 'attachments', public: false },
      { name: 'app-assets', public: true },
      { name: 'templates', public: false },
    ]

    // Create each bucket
    const bucketPromises = buckets.map(async (bucket) => {
      console.log(`Creating bucket: ${bucket.name}`)

      // Create the bucket
      const { error } = await supabase.storage.createBucket(bucket.name, {
        public: bucket.public,
        fileSizeLimit: 52428800, // 50MB
      })

      if (error && error.message !== 'Bucket already exists') {
        console.error(`Error creating bucket ${bucket.name}:`, error)
        return { success: false, bucket, error }
      } else {
        console.log(`Successfully created bucket: ${bucket.name}`)
        return { success: true, bucket }
      }
    })

    // Wait for all bucket operations to complete
    await Promise.all(bucketPromises)

    console.log('Storage bucket setup completed')
  } catch (error) {
    console.error('Storage bucket setup failed:', error)
  }
}

// Function to optimize database
async function optimizeDatabase() {
  try {
    console.log('Optimizing database...')

    // Add indexes for frequently queried columns
    const optimizationQueries = [
      // Add indexes for profiles table
      `CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON public.profiles(created_at);`,

      // Add indexes for conversations table
      `CREATE INDEX IF NOT EXISTS idx_conversations_user_id_updated_at ON public.conversations(user_id, updated_at);`,
      `CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at ON public.conversations(last_message_at);`,

      // Add indexes for messages table
      `CREATE INDEX IF NOT EXISTS idx_messages_conversation_id_created_at ON public.messages(conversation_id, created_at);`,
      `CREATE INDEX IF NOT EXISTS idx_messages_user_id ON public.messages(user_id);`,
      `CREATE INDEX IF NOT EXISTS idx_messages_is_flagged ON public.messages(is_flagged);`,

      // Add indexes for AI usage tables
      `CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created_at ON public.ai_usage_logs(created_at);`,
      `CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_model ON public.ai_usage_logs(model);`,

      // Add indexes for audit tables
      `CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at);`,
      `CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);`,

      // Optimize vacuum settings for frequently updated tables
      `ALTER TABLE public.messages SET (autovacuum_vacuum_scale_factor = 0.05);`,
      `ALTER TABLE public.conversations SET (autovacuum_vacuum_scale_factor = 0.05);`,
      `ALTER TABLE public.ai_usage_logs SET (autovacuum_vacuum_scale_factor = 0.05);`,
    ]

    // Execute optimization queries
    const queryPromises = optimizationQueries.map(async (query) => {
      console.log(`Running optimization query: ${query.substring(0, 60)}...`)

      const { error } = await supabase.rpc('exec_sql', { sql_query: query })

      if (error) {
        console.warn(`Warning in optimization query:`, error)
        return { success: false, error, query }
      }
      return { success: true, query }
    })

    // Wait for all queries to complete
    await Promise.all(queryPromises)

    console.log('Database optimization completed')
  } catch (error) {
    console.error('Database optimization failed:', error)
  }
}

// Create exec_sql function in the database
async function createExecSqlFunction() {
  try {
    console.log('Creating exec_sql function...')

    // Try to create the exec_sql function
    const { error } = await supabase.rpc('exec_sql', {
      sql_query: `
        CREATE OR REPLACE FUNCTION exec_sql(sql_query text)
        RETURNS void
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $$
        BEGIN
          EXECUTE sql_query;
        END;
        $$;
      `,
    })

    if (error) {
      // If function doesn't exist yet, we need to create it directly
      console.log('Using alternative method to create exec_sql function...')

      // We'll need to run this SQL in the SQL editor manually
      console.log(`
        Please run this SQL in the Supabase dashboard SQL editor:

        CREATE OR REPLACE FUNCTION exec_sql(sql_query text)
        RETURNS void
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $$
        BEGIN
          EXECUTE sql_query;
        END;
        $$;
      `)

      return false
    }

    return true
  } catch (error) {
    console.error('Failed to create exec_sql function:', error)
    return false
  }
}

// Function to apply migration SQL directly instead of using the exec_sql function
async function runManualMigrations() {
  try {
    console.log('Applying migrations directly...')

    // Get migration files
    const migrationsDir = path.join(__dirname, 'migrations')
    const migrationFiles = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort()

    console.log(`Found ${migrationFiles.length} migration files`)

    // Print out the SQL to apply manually
    for (const file of migrationFiles) {
      console.log(`\n--- Migration file: ${file} ---`)
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8')
      console.log(sql)
    }

    console.log(
      '\nPlease apply these migrations manually in the Supabase dashboard SQL editor.',
    )
  } catch (error) {
    console.error('Failed to read migration files:', error)
  }
}

// Main function to run all setup steps
async function main() {
  try {
    console.log('Starting database setup...')

    // Check if exec_sql function already exists
    const functionExists = await createExecSqlFunction()

    if (functionExists) {
      // Run migrations
      await runMigrations()

      // Set up storage buckets
      await setupStorageBuckets()

      // Optimize database
      await optimizeDatabase()

      console.log('Database setup completed successfully')
    } else {
      console.log('Unable to create exec_sql function. Manual setup required.')

      // Print migrations for manual application
      await runManualMigrations()

      // Instructions for manual setup
      console.log('\nManual setup instructions:')
      console.log(
        '1. Go to https://supabase.com/dashboard/project/abbbyyegxkijbaadeenj/sql',
      )
      console.log('2. Create the exec_sql function shown above')
      console.log('3. Run each migration SQL script in order')
      console.log('4. Run the optimization queries')
    }
  } catch (error) {
    console.error('Database setup failed:', error)
    process.exit(1)
  }
}

// Run the main function
main()
