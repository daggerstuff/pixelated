/**
 * PIX-215 migration CLI.
 *
 * Usage:
 *   pnpm db:migrate   # apply all pending migrations
 *   pnpm db:rollback  # roll back the most recently applied migration
 *   pnpm db:status    # show applied vs pending migrations
 *
 * Environment: standard DB_* vars (DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD).
 */

import { closeDatabase, initializeDatabase, migrations } from '../src/lib/db/index.ts'

const DEFAULT_MIGRATIONS_DIR = './db/migrations'

async function ensureDatabase() {
  initializeDatabase()
}

async function runMigrate(): Promise<number> {
  const result = await migrations.runMigrationsFromDirectory(DEFAULT_MIGRATIONS_DIR)
  if (result.applied.length === 0) {
    console.log('No pending migrations.')
  } else {
    for (const name of result.applied) {
      console.log(`Applied: ${name}`)
    }
    console.log(`\n${result.applied.length} migration(s) applied.`)
  }
  if (result.skipped.length > 0) {
    console.log(`${result.skipped.length} migration(s) already applied (skipped).`)
  }
  return 0
}

async function runRollback(): Promise<number> {
  const result = await migrations.rollbackLast(DEFAULT_MIGRATIONS_DIR)
  if (result.rolledBack === null) {
    console.log('No migration with a .rollback.sql file was found to roll back.')
    return 0
  }
  console.log(`Rolled back: ${result.rolledBack}`)
  return 0
}

async function runStatus(): Promise<number> {
  const result = await migrations.getStatus(DEFAULT_MIGRATIONS_DIR)
  console.log(`Applied (${result.applied.length}):`)
  for (const name of result.applied) console.log(`  ✅ ${name}`)
  console.log(`Pending (${result.pending.length}):`)
  for (const name of result.pending) console.log(`  ⏳ ${name}`)
  return 0
}

async function main(): Promise<void> {
  const command = process.argv[2] ?? 'migrate'
  await ensureDatabase()
  let exitCode = 0
  try {
    switch (command) {
      case 'migrate':
      case 'up':
        exitCode = await runMigrate()
        break
      case 'rollback':
      case 'down':
        exitCode = await runRollback()
        break
      case 'status':
        exitCode = await runStatus()
        break
      default:
        console.error(`Unknown command: ${command}`)
        console.error('Valid commands: migrate, rollback, status')
        exitCode = 2
    }
  } catch (err: unknown) {
    console.error('Migration command failed:', err)
    exitCode = 1
  } finally {
    await closeDatabase()
  }
  process.exit(exitCode)
}

void main()
