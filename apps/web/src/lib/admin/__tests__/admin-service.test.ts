// @vitest-environment node
/**
 * Tests for AdminService session management methods.
 * PIX-4370: lockSession, unlockSession, archiveSession, getSessions.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock verifyToken before importing AdminService
vi.mock('../../security/verification', () => ({
  verifyToken: vi.fn(() => ({ userId: 'admin1' })),
}))

// Mock createBuildSafeLogger to avoid build-time side effects
vi.mock('../../logging/build-safe-logger', () => ({
  createBuildSafeLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}))

import { AdminService, type MockSession } from '../index'

/**
 * Reset the in-memory mock session store between tests.
 * The mockSessions array is module-level, so we need to reset it
 * by re-importing the module or directly manipulating the store.
 * Since mockSessions is not exported, we use getSessions to inspect
 * state and re-seed by resetting the module.
 */

/**
 * Helper: get a fresh AdminService instance with reset mock data.
 * We use vi.resetModules() to get a fresh module load with seed data.
 */
async function getFreshService(): Promise<{
  service: AdminService
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  store: MockSession[]
}> {
  vi.resetModules()
  // Re-mock after resetModules
  vi.doMock('../../security/verification', () => ({
    verifyToken: vi.fn(() => ({ userId: 'admin1' })),
  }))
  vi.doMock('../../logging/build-safe-logger', () => ({
    createBuildSafeLogger: () => ({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    }),
  }))
  const mod = await import('../index')
  // Access the module-level mockSessions via a workaround: export is not available,
  // so we use getSessions to inspect and lockSession/archiveSession to mutate.
  return { service: mod.AdminService.getInstance(), store: [] }
}

describe('AdminService — session management', () => {
  let service: AdminService

  beforeEach(async () => {
    const fresh = await getFreshService()
    service = fresh.service
  })

  describe('getSessions', () => {
    it('returns non-archived sessions with total count', async () => {
      const result = await service.getSessions({
        limit: 10,
        offset: 0,
      })
      expect(result.total).toBe(3)
      expect(result.sessions).toHaveLength(3)
      expect(result.sessions.every((s) => !s.archived)).toBe(true)
    })

    it('filters by therapistId', async () => {
      const result = await service.getSessions({
        limit: 10,
        offset: 0,
        therapistId: 'therapist-001',
      })
      expect(result.total).toBe(2)
      expect(
        result.sessions.every((s) => s.therapistId === 'therapist-001'),
      ).toBe(true)
    })

    it('filters by clientId', async () => {
      const result = await service.getSessions({
        limit: 10,
        offset: 0,
        clientId: 'client-002',
      })
      expect(result.total).toBe(1)
      expect(result.sessions[0].clientId).toBe('client-002')
    })

    it('paginates with limit and offset', async () => {
      const page1 = await service.getSessions({ limit: 2, offset: 0 })
      expect(page1.sessions).toHaveLength(2)
      expect(page1.total).toBe(3)

      const page2 = await service.getSessions({ limit: 2, offset: 2 })
      expect(page2.sessions).toHaveLength(1)
      expect(page2.total).toBe(3)
    })

    it('filters by startDate', async () => {
      const result = await service.getSessions({
        limit: 10,
        offset: 0,
        startDate: new Date('2026-08-22T00:00:00Z'),
      })
      expect(result.total).toBe(1)
      expect(result.sessions[0].sessionId).toBe('session-003')
    })

    it('filters by endDate', async () => {
      const result = await service.getSessions({
        limit: 10,
        offset: 0,
        endDate: new Date('2026-08-16T00:00:00Z'),
      })
      expect(result.total).toBe(1)
      expect(result.sessions[0].sessionId).toBe('session-001')
    })

    it('excludes archived sessions', async () => {
      // Archive a session first
      await service.archiveSession('session-001')
      const result = await service.getSessions({ limit: 10, offset: 0 })
      expect(result.total).toBe(2)
      expect(
        result.sessions.find((s) => s.sessionId === 'session-001'),
      ).toBeUndefined()
    })
  })

  describe('lockSession', () => {
    it('locks an active session', async () => {
      await service.lockSession('session-002')
      const result = await service.getSessions({ limit: 10, offset: 0 })
      const session = result.sessions.find((s) => s.sessionId === 'session-002')
      expect(session?.locked).toBe(true)
    })

    it('throws for non-existent session', async () => {
      await expect(service.lockSession('nonexistent')).rejects.toThrow(
        'Session not found: nonexistent',
      )
    })

    it('throws for archived session', async () => {
      await service.archiveSession('session-001')
      await expect(service.lockSession('session-001')).rejects.toThrow(
        'Cannot lock archived session: session-001',
      )
    })
  })

  describe('unlockSession', () => {
    it('unlocks a locked session', async () => {
      await service.lockSession('session-002')
      await service.unlockSession('session-002')
      const result = await service.getSessions({ limit: 10, offset: 0 })
      const session = result.sessions.find((s) => s.sessionId === 'session-002')
      expect(session?.locked).toBe(false)
    })

    it('throws for non-existent session', async () => {
      await expect(service.unlockSession('nonexistent')).rejects.toThrow(
        'Session not found: nonexistent',
      )
    })

    it('throws for archived session', async () => {
      await service.archiveSession('session-001')
      await expect(service.unlockSession('session-001')).rejects.toThrow(
        'Cannot unlock archived session: session-001',
      )
    })
  })

  describe('archiveSession', () => {
    it('archives an active session', async () => {
      await service.archiveSession('session-002')
      const result = await service.getSessions({ limit: 10, offset: 0 })
      expect(result.total).toBe(2)
      expect(
        result.sessions.find((s) => s.sessionId === 'session-002'),
      ).toBeUndefined()
    })

    it('throws for non-existent session', async () => {
      await expect(service.archiveSession('nonexistent')).rejects.toThrow(
        'Session not found: nonexistent',
      )
    })

    it('throws for already archived session', async () => {
      await service.archiveSession('session-001')
      await expect(service.archiveSession('session-001')).rejects.toThrow(
        'Session already archived: session-001',
      )
    })
  })

  describe('lock + archive interaction', () => {
    it('can archive a locked session', async () => {
      await service.lockSession('session-002')
      await service.archiveSession('session-002')
      const result = await service.getSessions({ limit: 10, offset: 0 })
      expect(result.total).toBe(2)
    })
  })
})
