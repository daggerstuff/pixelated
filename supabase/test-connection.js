import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'

// Get current file directory (ES module equivalent of __dirname)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

// Supabase connection
const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey || !supabaseAnonKey) {
  console.error('Missing Supabase URL or keys in environment variables')
  process.exit(1)
}

// Create Supabase admin client
const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

// Create Supabase anon client (similar to browser client)
const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
  },
})

// Test admin client connection and permissions
async function testAdminConnection() {
  try {
    console.log('Testing admin connection...')

    // Test basic query
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('count(*)', { count: 'exact', head: true })

    if (error) {
      console.error('Error connecting with admin client:', error)
      return false
    }

    console.log('✅ Admin client connection successful')
    console.log(`Profiles table row count: ${data}`)

    // Test schema access
    const { error: schemaError } = await supabaseAdmin.rpc('exec_sql', {
      sql_query: `
        SELECT table_name, column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
        ORDER BY table_name, ordinal_position
      `,
    })

    if (schemaError) {
      console.warn('Admin cannot execute SQL functions:', schemaError)
      return false
    }

    console.log('✅ Admin has schema access')

    return true
  } catch (error) {
    console.error('Error in admin connection test:', error)
    return false
  }
}

// Test anonymous client connection and permissions
async function testAnonConnection() {
  try {
    console.log('\nTesting anonymous client connection...')

    // Try to access tables (should be blocked by RLS)
    const { data, error } = await supabaseAnon
      .from('profiles')
      .select('*')
      .limit(1)

    if (error && error.code === 'PGRST301') {
      console.log('✅ Anonymous client properly restricted by RLS')
    } else if (error) {
      console.warn('Anonymous client error, but not RLS related:', error)
    } else {
      console.warn(
        '⚠️ Anonymous client could access profiles - RLS may not be configured properly',
      )
      console.log(data)
    }

    // Test storage access
    const { data: storageData, error: storageError } =
      await supabaseAnon.storage.listBuckets()

    if (storageError) {
      console.error('Error accessing storage with anon client:', storageError)
    } else {
      console.log('✅ Anonymous client can list storage buckets')
      console.log(
        'Available buckets:',
        storageData.map((b) => b.name).join(', '),
      )
    }

    return true
  } catch (error) {
    console.error('Error in anonymous connection test:', error)
    return false
  }
}

// Test auth functionality
async function testAuthFunctionality() {
  try {
    console.log('\nTesting auth functionality...')

    // Check if we have auth configuration
    const { data, error } = await supabaseAdmin.rpc('exec_sql', {
      sql_query: `
        SELECT EXISTS (
          SELECT 1 FROM pg_tables
          WHERE schemaname = 'auth'
          AND tablename = 'users'
        ) as has_auth_tables
      `,
    })

    if (error) {
      console.error('Error checking auth tables:', error)
      return false
    }

    const hasAuthTables = data && data[0] && data[0].has_auth_tables

    if (hasAuthTables) {
      console.log('✅ Auth tables are correctly set up')
    } else {
      console.warn('⚠️ Auth tables might not be correctly set up')
    }

    return true
  } catch (error) {
    console.error('Error in auth functionality test:', error)
    return false
  }
}

// Main test function
async function runTests() {
  console.log('🔍 Running Supabase connection tests...')
  console.log(`URL: ${supabaseUrl}`)
  console.log('----------------------------------')

  const adminSuccess = await testAdminConnection()
  const anonSuccess = await testAnonConnection()
  const authSuccess = await testAuthFunctionality()

  console.log('\n----------------------------------')
  console.log('Test Results:')
  console.log(`Admin Connection: ${adminSuccess ? '✅ PASS' : '❌ FAIL'}`)
  console.log(`Anonymous Connection: ${anonSuccess ? '✅ PASS' : '❌ FAIL'}`)
  console.log(`Auth Functionality: ${authSuccess ? '✅ PASS' : '❌ FAIL'}`)
  console.log('----------------------------------')

  if (adminSuccess && anonSuccess && authSuccess) {
    console.log('🎉 Your Supabase integration appears to be correctly set up!')
  } else {
    console.log(
      '⚠️ Some tests failed. Please check the errors above and fix your configuration.',
    )
  }
}

// Run the tests
runTests()
