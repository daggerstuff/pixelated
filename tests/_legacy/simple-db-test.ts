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

async function testConnection() {
  try {
    console.log('Testing database connection...')
    const client = await pool.connect()
    console.log('✅ Connected to database successfully!')

    // Test a simple query
    const result = await client.query('SELECT version()')
    console.log('PostgreSQL version:', result.rows[0].version)

    // List existing tables
    const tables = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `)
    console.log('Existing tables:', tables.rows.map(row => row.table_name))

    // Count users
    const userCount = await client.query('SELECT COUNT(*) as count FROM users')
    console.log('Number of users:', userCount.rows[0].count)

    client.release()
    await pool.end()
    console.log('✅ Database connection test completed')
  } catch (error) {
    console.error('❌ Database connection failed:', error)
    process.exit(1)
  }
}

testConnection()