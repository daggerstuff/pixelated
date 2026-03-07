import { readFileSync } from 'fs'
import { Pool } from 'pg'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5432/pixelated'

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl:
    process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : false,
})

async function runMigrations() {
  console.log('🚀 Starting collaboration features migration...')

  try {
    // Read and execute the SQL migration file
    const migrationSQL = readFileSync(
      './db/migrations/create_documents.sql',
      'utf8',
    )

    await pool.query(migrationSQL)
    console.log('✅ Documents and collaboration tables created successfully')

    // Verify the migration
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('documents', 'document_changes')
    `)

    console.log(
      '📋 Created tables:',
      result.rows.map((r) => r.table_name),
    )

    // Test DocumentService integration
    const { DocumentService } =
      await import('../src/services/DocumentService.js')
    const Redis = await import('ioredis')

    const redis = new Redis.default(
      process.env.REDIS_URL || 'redis://localhost:6379',
    )
    const documentService = new DocumentService.default(pool, redis)

    // Create a test document
    const testDoc = await documentService.createDocument({
      title: 'Migration Test Document',
      content: 'This is a test document created during migration verification.',
      ownerId: 'migration-test-user',
      isPublic: false,
    })

    console.log('✅ Test document created:', testDoc.id)

    // Clean up test document
    await pool.query('DELETE FROM documents WHERE owner_id = $1', [
      'migration-test-user',
    ])
    console.log('🧹 Test document cleaned up')

    await redis.quit()
  } catch (error) {
    console.error('❌ Migration failed:', error.message)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

// Run the migration
runMigrations()
  .then(() => {
    console.log('🎉 Collaboration features migration completed successfully!')
    console.log('📖 Next steps:')
    console.log('   1. Run: pnpm dev:websocket')
    console.log('   2. Run: pnpm dev:all-services')
    console.log('   3. Test real-time collaboration in the browser')
  })
  .catch((error) => {
    console.error('Migration failed:', error)
    process.exit(1)
  })
