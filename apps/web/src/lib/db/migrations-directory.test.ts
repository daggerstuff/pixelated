/* @vitest-environment node */
/**
 * Tests for DatabaseMigration directory-based methods.
 *
 * The `pg` module is mocked so we can drive the query() function directly
 * without a live database. The real `query()` in `../index` calls into
 * `pool.connect().client.query`, so intercepting `pg.Pool` is enough to
 * control every SQL the migration runner issues.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockQueryFn, MockPoolCtor } = vi.hoisted(() => {
  const mockQueryFn = vi.fn()
  function buildMockPool() {
    return {
      connect: vi.fn(async function connect() {
        return { query: mockQueryFn, release: vi.fn() }
      }),
      on: vi.fn(),
      end: vi.fn(),
      removeAllListeners: vi.fn(),
    }
  }
  const MockPoolCtor = vi.fn(function MockPool() {
    return buildMockPool()
  })
  return { mockQueryFn, MockPoolCtor }
})

vi.mock('pg', () => ({
  Pool: MockPoolCtor,
}))

import { DatabaseMigration, initializeDatabase } from './index'

initializeDatabase()

interface FsAdapter {
  readdir: ReturnType<typeof vi.fn>
  readFile: ReturnType<typeof vi.fn>
}

function buildFsAdapter(files: Record<string, string>): FsAdapter {
  const paths = Object.keys(files)
  return {
    readdir: vi.fn(async () => paths.map((p) => p.split('/').pop()!)),
    readFile: vi.fn(async (filePath: string, _enc: string) => {
      const filename = filePath.split('/').pop()!
      const content = files[filename]
      if (content === undefined) {
        const err: NodeJS.ErrnoException = new Error(
          `ENOENT: no such file '${filePath}'`,
        )
        err.code = 'ENOENT'
        throw err
      }
      return content
    }),
  }
}

function defaultQueryImpl() {
  return async (text: string) => {
    if (text.includes('CREATE TABLE IF NOT EXISTS schema_migrations')) {
      return { rows: [], rowCount: 0 }
    }
    if (text.startsWith('SELECT name FROM schema_migrations')) {
      return { rows: [], rowCount: 0 }
    }
    if (text.startsWith('INSERT INTO schema_migrations')) {
      return { rows: [], rowCount: 1 }
    }
    if (text.startsWith('DELETE FROM schema_migrations')) {
      return { rows: [], rowCount: 1 }
    }
    return { rows: [], rowCount: 0 }
  }
}

describe('DatabaseMigration directory methods', () => {
  let migration: DatabaseMigration

  beforeEach(() => {
    mockQueryFn.mockReset()
    mockQueryFn.mockImplementation(defaultQueryImpl())
    migration = new DatabaseMigration()
  })

  describe('runMigrationsFromDirectory', () => {
    it('applies all SQL files in sorted order when none are executed', async () => {
      const fs = buildFsAdapter({
        '010_workspaces.sql': 'CREATE TABLE workspaces (id UUID);',
        '011_workspace_id.sql':
          'ALTER TABLE users ADD COLUMN workspace_id UUID;',
        '012_rbac.sql': 'CREATE TABLE roles (id UUID);',
      })

      const result = await migration.runMigrationsFromDirectory(
        '/migrations',
        fs as unknown as Parameters<
          typeof migration.runMigrationsFromDirectory
        >[1],
      )

      expect(result.applied).toEqual([
        '010_workspaces.sql',
        '011_workspace_id.sql',
        '012_rbac.sql',
      ])
      expect(result.skipped).toEqual([])

      const ddlCalls = mockQueryFn.mock.calls
        .map((c) => c[0] as string)
        .filter((sql) => !sql.includes('schema_migrations'))
      expect(ddlCalls).toEqual([
        'CREATE TABLE workspaces (id UUID);',
        'ALTER TABLE users ADD COLUMN workspace_id UUID;',
        'CREATE TABLE roles (id UUID);',
      ])
    })

    it('skips migrations that are already in schema_migrations', async () => {
      mockQueryFn.mockImplementation(async (text: string) => {
        if (text.includes('CREATE TABLE IF NOT EXISTS schema_migrations')) {
          return { rows: [], rowCount: 0 }
        }
        if (text.startsWith('SELECT name FROM schema_migrations')) {
          return { rows: [{ name: '010_workspaces.sql' }], rowCount: 1 }
        }
        return { rows: [], rowCount: 0 }
      })

      const fs = buildFsAdapter({
        '010_workspaces.sql': 'CREATE TABLE workspaces (id UUID);',
        '011_workspace_id.sql':
          'ALTER TABLE users ADD COLUMN workspace_id UUID;',
      })

      const result = await migration.runMigrationsFromDirectory(
        '/migrations',
        fs as unknown as Parameters<
          typeof migration.runMigrationsFromDirectory
        >[1],
      )

      expect(result.applied).toEqual(['011_workspace_id.sql'])
      expect(result.skipped).toEqual(['010_workspaces.sql'])
    })

    it('ignores files that do not match the NNN_*.sql pattern', async () => {
      const fs = buildFsAdapter({
        '010_workspaces.sql': 'CREATE TABLE workspaces (id UUID);',
        'README.md': 'docs',
        'scratch.sql': 'not numbered',
        'not_a_migration.sql': 'no NNN_ prefix',
      })

      const result = await migration.runMigrationsFromDirectory(
        '/migrations',
        fs as unknown as Parameters<
          typeof migration.runMigrationsFromDirectory
        >[1],
      )

      expect(result.applied).toEqual(['010_workspaces.sql'])
    })
  })

  describe('rollbackLast', () => {
    it('rolls back the most recent applied migration that has a paired rollback file', async () => {
      mockQueryFn.mockImplementation(async (text: string) => {
        if (text.includes('CREATE TABLE IF NOT EXISTS schema_migrations')) {
          return { rows: [], rowCount: 0 }
        }
        if (text.startsWith('SELECT name FROM schema_migrations')) {
          return {
            rows: [
              { name: '010_workspaces.sql' },
              { name: '011_workspace_id.sql' },
              { name: '012_rbac.sql' },
            ],
            rowCount: 3,
          }
        }
        return { rows: [], rowCount: 0 }
      })

      const fs = buildFsAdapter({
        '010_workspaces.sql': 'CREATE TABLE workspaces (id UUID);',
        '010_workspaces.rollback.sql': 'DROP TABLE workspaces;',
        '011_workspace_id.sql':
          'ALTER TABLE users ADD COLUMN workspace_id UUID;',
        '011_workspace_id.rollback.sql':
          'ALTER TABLE users DROP COLUMN workspace_id;',
        '012_rbac.sql': 'CREATE TABLE roles (id UUID);',
        '012_rbac.rollback.sql': 'DROP TABLE roles;',
      })

      const result = await migration.rollbackLast(
        '/migrations',
        fs as unknown as Parameters<typeof migration.rollbackLast>[1],
      )

      expect(result.rolledBack).toBe('012_rbac.sql')

      const executedSql = mockQueryFn.mock.calls.map((c) => c[0] as string)
      expect(executedSql).toContain('DROP TABLE roles;')
      expect(executedSql).toContain(
        'DELETE FROM schema_migrations WHERE name = $1',
      )
    })

    it('skips applied migrations without a rollback file and tries the previous one', async () => {
      mockQueryFn.mockImplementation(async (text: string) => {
        if (text.includes('CREATE TABLE IF NOT EXISTS schema_migrations')) {
          return { rows: [], rowCount: 0 }
        }
        if (text.startsWith('SELECT name FROM schema_migrations')) {
          return {
            rows: [
              { name: '010_workspaces.sql' },
              { name: '011_workspace_id.sql' },
            ],
            rowCount: 2,
          }
        }
        return { rows: [], rowCount: 0 }
      })

      const fs = buildFsAdapter({
        '010_workspaces.sql': 'CREATE TABLE workspaces (id UUID);',
        '010_workspaces.rollback.sql': 'DROP TABLE workspaces;',
        '011_workspace_id.sql':
          'ALTER TABLE users ADD COLUMN workspace_id UUID;',
      })

      const result = await migration.rollbackLast(
        '/migrations',
        fs as unknown as Parameters<typeof migration.rollbackLast>[1],
      )

      expect(result.rolledBack).toBe('010_workspaces.sql')
    })

    it('returns null when no applied migration has a rollback file', async () => {
      mockQueryFn.mockImplementation(async (text: string) => {
        if (text.includes('CREATE TABLE IF NOT EXISTS schema_migrations')) {
          return { rows: [], rowCount: 0 }
        }
        if (text.startsWith('SELECT name FROM schema_migrations')) {
          return { rows: [{ name: '010_workspaces.sql' }], rowCount: 1 }
        }
        return { rows: [], rowCount: 0 }
      })

      const fs = buildFsAdapter({
        '010_workspaces.sql': 'CREATE TABLE workspaces (id UUID);',
      })

      const result = await migration.rollbackLast(
        '/migrations',
        fs as unknown as Parameters<typeof migration.rollbackLast>[1],
      )

      expect(result.rolledBack).toBeNull()
    })
  })

  describe('getStatus', () => {
    it('separates applied and pending migrations by their filename', async () => {
      mockQueryFn.mockImplementation(async (text: string) => {
        if (text.includes('CREATE TABLE IF NOT EXISTS schema_migrations')) {
          return { rows: [], rowCount: 0 }
        }
        if (text.startsWith('SELECT name FROM schema_migrations')) {
          return {
            rows: [{ name: '010_workspaces.sql' }, { name: '012_rbac.sql' }],
            rowCount: 2,
          }
        }
        return { rows: [], rowCount: 0 }
      })

      const fs = buildFsAdapter({
        '010_workspaces.sql': 'CREATE TABLE workspaces (id UUID);',
        '011_workspace_id.sql':
          'ALTER TABLE users ADD COLUMN workspace_id UUID;',
        '012_rbac.sql': 'CREATE TABLE roles (id UUID);',
      })

      const result = await migration.getStatus(
        '/migrations',
        fs as unknown as Parameters<typeof migration.getStatus>[1],
      )

      expect(result.applied).toEqual(['010_workspaces.sql', '012_rbac.sql'])
      expect(result.pending).toEqual(['011_workspace_id.sql'])
    })
  })

  describe('legacy schema_migrations reconciliation', () => {
    it('preserves a legacy version/applied_at tracking table and starts fresh', async () => {
      mockQueryFn.mockImplementation(async (text: string) => {
        if (text.includes('CREATE TABLE IF NOT EXISTS schema_migrations')) {
          return { rows: [], rowCount: 0 }
        }
        if (text.includes('information_schema.columns')) {
          return {
            rows: [{ column_name: 'version' }, { column_name: 'applied_at' }],
            rowCount: 2,
          }
        }
        return { rows: [], rowCount: 0 }
      })

      await migration.ensureMigrationsTable()

      const sql = mockQueryFn.mock.calls.map((c) => c[0] as string)
      expect(sql).toContain(
        'ALTER TABLE schema_migrations RENAME TO schema_migrations_legacy',
      )
      // A fresh app-shaped tracking table is created after the rename.
      expect(
        sql.filter((s) => s.includes('CREATE TABLE schema_migrations')).length,
      ).toBeGreaterThanOrEqual(1)
    })

    it('applies every migration after resetting an unreliable legacy tracking table', async () => {
      mockQueryFn.mockImplementation(async (text: string) => {
        if (text.includes('CREATE TABLE IF NOT EXISTS schema_migrations')) {
          return { rows: [], rowCount: 0 }
        }
        if (text.includes('information_schema.columns')) {
          return {
            rows: [{ column_name: 'version' }, { column_name: 'applied_at' }],
            rowCount: 2,
          }
        }
        return { rows: [], rowCount: 0 }
      })

      const fs = buildFsAdapter({
        '010_workspaces.sql': 'CREATE TABLE workspaces (id UUID);',
        '011_workspace_id.sql':
          'ALTER TABLE users ADD COLUMN workspace_id UUID;',
        '012_rbac.sql': 'CREATE TABLE roles (id UUID);',
      })

      const result = await migration.runMigrationsFromDirectory(
        '/migrations',
        fs as unknown as Parameters<
          typeof migration.runMigrationsFromDirectory
        >[1],
      )

      // The unreliable legacy rows were renamed out of the way, so every file
      // is treated as pending, applied idempotently, and recorded.
      expect(result.applied).toEqual([
        '010_workspaces.sql',
        '011_workspace_id.sql',
        '012_rbac.sql',
      ])
      expect(result.skipped).toEqual([])
      const sql = mockQueryFn.mock.calls.map((c) => c[0] as string)
      expect(sql).toContain(
        'ALTER TABLE schema_migrations RENAME TO schema_migrations_legacy',
      )
    })

    it('is a no-op when the tracking table already uses the app shape', async () => {
      mockQueryFn.mockImplementation(async (text: string) => {
        if (text.includes('CREATE TABLE IF NOT EXISTS schema_migrations')) {
          return { rows: [], rowCount: 0 }
        }
        if (text.includes('information_schema.columns')) {
          return {
            rows: [
              { column_name: 'id' },
              { column_name: 'name' },
              { column_name: 'executed_at' },
            ],
            rowCount: 3,
          }
        }
        return { rows: [], rowCount: 0 }
      })

      await migration.ensureMigrationsTable()

      const sql = mockQueryFn.mock.calls.map((c) => c[0] as string)
      expect(
        sql.some((s) => s.startsWith('ALTER TABLE schema_migrations')),
      ).toBe(false)
    })
  })
})
