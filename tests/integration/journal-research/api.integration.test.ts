import { describe, it, expect, beforeAll, afterAll, } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import {
  listSessions,
  getSession,
  createSession,
  updateSession,
  deleteSession,
  type CreateSessionPayload,
  type UpdateSessionPayload,
} from '@/lib/api/journal-research'


/**
 * Integration tests for Journal Research API
 * 
 * These tests verify the API client works correctly with the backend.
 * Note: These tests require a running backend server or mocked API.
 * 
 * To run these tests:
 * 1. Start the backend API server
 * 2. Set TEST_API_URL environment variable if different from default
 * 3. Run: pnpm test tests/integration/journal-research/api.integration.test.ts
 */

describe('Journal Research API Integration', () => {
  
  let createdSessionId: string | null = null

  beforeAll(() => {
    // Setup: Ensure API client is configured
    // In a real scenario, you might want to check if backend is available
    // and skip tests if it's not running
  })

  afterAll(async () => {
    // Cleanup: Delete test session if it was created
    if (createdSessionId) {
      try {
        await deleteSession(createdSessionId)
      } catch (error) {
        // Ignore cleanup errors
        console.warn('Failed to cleanup test session:', error)
      }
    }
  })

  describe('Session Management', () => {
    it('creates a new session', async () => {
      const payload: CreateSessionPayload = {
        targetSources: ['PubMed', 'arXiv'],
        searchKeywords: {
          mental_health: ['depression', 'anxiety'],
          therapy: ['CBT'],
        },
        weeklyTargets: {
          sources: 10,
          datasets: 5,
        },
      }

      const session = await createSession(payload)

      expect(session).toBeDefined()
      expect(session.sessionId).toBeDefined()
      expect(session.targetSources).toEqual(payload.targetSources)
      expect(session.searchKeywords).toEqual(payload.searchKeywords)
      expect(session.weeklyTargets).toEqual(payload.weeklyTargets)

      createdSessionId = session.sessionId
    }, 30000)

    it('lists sessions', async () => {
      const sessions = await listSessions({ page: 1, pageSize: 10 })

      expect(sessions).toBeDefined()
      expect(sessions.items).toBeInstanceOf(Array)
      expect(sessions.total).toBeGreaterThanOrEqual(0)
      expect(sessions.page).toBe(1)
      expect(sessions.pageSize).toBe(10)
    }, 30000)

    it('gets session by ID', async () => {
      if (!createdSessionId) {
        // Create a session first if we don't have one
        const payload: CreateSessionPayload = {
          targetSources: ['PubMed'],
          searchKeywords: { mental_health: ['depression'] },
          weeklyTargets: { sources: 5 },
        }
        const session = await createSession(payload)
        createdSessionId = session.sessionId
      }

      const session = await getSession(createdSessionId)

      expect(session).toBeDefined()
      expect(session.sessionId).toBe(createdSessionId)
    }, 30000)

    it('updates a session', async () => {
      if (!createdSessionId) {
        const payload: CreateSessionPayload = {
          targetSources: ['PubMed'],
          searchKeywords: { mental_health: ['depression'] },
          weeklyTargets: { sources: 5 },
        }
        const session = await createSession(payload)
        createdSessionId = session.sessionId
      }

      const updatePayload: UpdateSessionPayload = {
        currentPhase: 'evaluation',
      }

      const updatedSession = await updateSession(createdSessionId, updatePayload)

      expect(updatedSession).toBeDefined()
      expect(updatedSession.currentPhase).toBe('evaluation')
    }, 30000)

    it('deletes a session', async () => {
      // Create a session to delete
      const payload: CreateSessionPayload = {
        targetSources: ['PubMed'],
        searchKeywords: { mental_health: ['depression'] },
        weeklyTargets: { sources: 5 },
      }
      const session = await createSession(payload)

      await deleteSession(session.sessionId)

      // Verify deletion by trying to get the session (should fail)
      await expect(getSession(session.sessionId)).rejects.toThrow()
    }, 30000)
  })

  describe('Error Handling', () => {
    it('handles non-existent session gracefully', async () => {
      await expect(getSession('non-existent-session-id')).rejects.toThrow()
    }, 30000)

    it('validates session creation payload', async () => {
      const invalidPayload = {
        targetSources: [],
        searchKeywords: {},
        weeklyTargets: {},
      } as CreateSessionPayload

      await expect(createSession(invalidPayload)).rejects.toThrow()
    }, 30000)
  })

  describe('React Query Integration', () => {
    it('works with React Query client', async () => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
        },
      })

      const sessions = await queryClient.fetchQuery({
        queryKey: ['journal-research', 'sessions', 'list', { page: 1, pageSize: 10 }],
        queryFn: () => listSessions({ page: 1, pageSize: 10 }),
      })

      expect(sessions).toBeDefined()
      expect(sessions.items).toBeInstanceOf(Array)
    }, 30000)
  })
})

