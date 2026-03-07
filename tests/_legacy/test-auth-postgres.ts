import { Pool } from 'pg'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

// Use the DATABASE_URL from .env
const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  console.error('❌ DATABASE_URL not found in environment variables')
  process.exit(1)
}

console.log('Using database URL:', databaseUrl.replace(/:[^:@]+@/, ':***@'))

const pool = new Pool({
  connectionString: databaseUrl,
})

async function testAuthTables() {
  try {
    console.log('Testing authentication tables...')
    const client = await pool.connect()

    // Test users table with auth columns
    const userCount = await client.query('SELECT COUNT(*) as count FROM users')
    console.log('Number of users:', userCount.rows[0].count)

    // Check if auth columns exist
    const userColumns = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'users' AND column_name IN ('last_login_at', 'login_attempts', 'account_locked_until', 'authentication_status')
      ORDER BY column_name
    `)
    console.log('Authentication columns in users table:')
    userColumns.rows.forEach(row => {
      console.log(`  - ${row.column_name} (${row.data_type})`)
    })

    // Test auth_sessions table
    const sessionTable = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'auth_sessions'
      ) as exists
    `)
    console.log('auth_sessions table exists:', sessionTable.rows[0].exists)

    // Test auth_accounts table
    const accountTable = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'auth_accounts'
      ) as exists
    `)
    console.log('auth_accounts table exists:', accountTable.rows[0].exists)

    // Insert a test user with auth data
    const testUserResult = await client.query(`
      INSERT INTO users (
        email, password_hash, first_name, last_name, role, institution,
        last_login_at, login_attempts, authentication_status
      ) VALUES (
        'test.auth@example.com', '$2b$10$example_hash', 'Auth', 'Tester', 'therapist', 'Test Institution',
        NOW(), 0, 'authenticated'
      ) RETURNING id, email, authentication_status
    `)

    const testUser = testUserResult.rows[0]
    console.log('Created test user:', {
      id: testUser.id,
      email: testUser.email,
      status: testUser.authentication_status
    })

    // Insert a test session
    const testSessionResult = await client.query(`
      INSERT INTO auth_sessions (
        id, user_id, expires_at, token
      ) VALUES (
        'test_session_123', $1, NOW() + INTERVAL '1 hour', 'test_token_456'
      ) RETURNING id, user_id, expires_at
    `, [testUser.id])

    const testSession = testSessionResult.rows[0]
    console.log('Created test session:', {
      id: testSession.id,
      userId: testSession.user_id,
      expiresAt: testSession.expires_at
    })

    // Clean up test data
    await client.query('DELETE FROM auth_sessions WHERE id = $1', [testSession.id])
    await client.query('DELETE FROM users WHERE id = $1', [testUser.id])
    console.log('✅ Cleaned up test data')

    client.release()
    await pool.end()
    console.log('✅ Authentication tables test completed successfully!')
  } catch (error) {
    console.error('❌ Authentication tables test failed:', error)
    process.exit(1)
  }
}

testAuthTables()