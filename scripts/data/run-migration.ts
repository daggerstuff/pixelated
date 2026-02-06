import { Pool } from 'pg'
import dotenv from 'dotenv'
import { readFile } from 'fs/promises'
import { resolve } from 'path'

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

async function runMigration() {
  try {
    console.log('Running database migration...')
    const client = await pool.connect()

    // Read the migration file
    const migrationPath = resolve('./db/migrations/001_create_initial_tables.sql')
    const migrationSQL = await readFile(migrationPath, 'utf8')

    console.log('Executing migration...')
    await client.query(migrationSQL)

    console.log('✅ Migration completed successfully!')

    // List created tables
    const tables = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `)
    console.log('Created tables:', tables.rows.map(row => row.table_name))

    client.release()
    await pool.end()
    console.log('✅ Database connection closed')
  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  }
}

runMigration()