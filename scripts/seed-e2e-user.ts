/**
 * Seed the E2E test user used by the bias-detection dashboard spec.
 *
 * Self-contained: ensures the `users` table exists (idempotent, mirrors the
 * migration 001 schema) and upserts test@example.com / password123 with the
 * admin role. Run in the CI workflow AFTER the Postgres service is healthy:
 *
 *   pnpm tsx scripts/seed-e2e-user.ts
 *
 * Requires DATABASE_URL (e.g. postgresql://postgres@localhost:5432/test_db).
 */

import bcrypt from 'bcryptjs'
import { Client } from 'pg'

const EMAIL = 'test@example.com'
const PASSWORD = 'password123'
const ROLE = 'admin'

async function main(): Promise<void> {
  const databaseUrl = process.env['DATABASE_URL']
  if (!databaseUrl) {
    console.error('DATABASE_URL is required')
    process.exit(1)
  }

  const client = new Client({ connectionString: databaseUrl })
  await client.connect()

  try {
    // Ensure the users table exists (mirrors db/migrations/001 schema).
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        role VARCHAR(50) DEFAULT 'therapist',
        institution VARCHAR(255),
        license_number VARCHAR(100),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `)

    const passwordHash = await bcrypt.hash(PASSWORD, 10)

    const result = await client.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role, is_active)
       VALUES ($1, $2, 'E2E', 'Admin', $3, TRUE)
       ON CONFLICT (email) DO UPDATE SET
         password_hash = EXCLUDED.password_hash,
         role = EXCLUDED.role,
         first_name = EXCLUDED.first_name,
         last_name = EXCLUDED.last_name,
         is_active = TRUE
       RETURNING id, email, role, is_active`,
      [EMAIL, passwordHash, ROLE],
    )

    const row = result.rows[0]
    console.log(
      `Seeded E2E user: ${row.email} (role=${row.role}, active=${row.is_active}, id=${row.id})`,
    )
  } finally {
    await client.end()
  }
}

main().catch((error: unknown) => {
  console.error('Failed to seed E2E user:', error)
  process.exit(1)
})
