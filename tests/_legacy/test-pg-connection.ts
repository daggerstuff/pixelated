import dotenv from 'dotenv'
import { Pool } from 'pg'

// Load environment variables
dotenv.config()

// Check if DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required')
}

console.log('DATABASE_URL is set')

// Create PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

async function testConnection() {
  try {
    console.log('Testing PostgreSQL connection...')

    // Test the connection
    const client = await pool.connect()
    const result = await client.query('SELECT NOW() as now')
    console.log('✅ PostgreSQL connected successfully:', result.rows[0].now)

    // Test querying the users table
    const userResult = await client.query('SELECT COUNT(*) as count FROM users')
    console.log(
      '✅ Users table accessible, row count:',
      userResult.rows[0].count,
    )

    client.release()

    // Test creating a test user directly
    console.log('\n📝 Creating test user directly...')
    const insertResult = await pool.query(
      'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id',
      ['pgtest@example.com', 'testhash123', 'PG Test User'],
    )
    console.log('✅ Test user created with ID:', insertResult.rows[0].id)

    // Clean up - delete the test user
    await pool.query('DELETE FROM users WHERE email = $1', [
      'pgtest@example.com',
    ])
    console.log('✅ Test user cleaned up')

    await pool.end()
    console.log('\n🎉 All PostgreSQL tests passed!')
  } catch (error) {
    console.error('❌ PostgreSQL test failed:', error)
    await pool.end()
  }
}

void testConnection()
