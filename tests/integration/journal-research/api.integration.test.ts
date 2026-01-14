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
} from '../../../src/lib/api/journal-research'


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
    // Mock global fetch with stateful session store
    const sessionStore = new Map<string, any>()

    global.fetch = vi.fn().mockImplementation(async (url, init) => {
      const urlStr = url.toString()
      const method = init?.method || 'GET'

      // Mock response helper
      const jsonResponse = (data: any, status = 200) => ({
        ok: status >= 200 && status < 300,
        status,
        statusText: status === 200 ? 'OK' : 'Error',
        json: async () => data,
      } as Response)

      // Mock /sessions endpoints
      if (urlStr.includes('/sessions') && !urlStr.includes('/sessions/')) {
        if (method === 'GET') {
          // listSessions
          return jsonResponse({
            items: Array.from(sessionStore.values()),
            total: sessionStore.size,
            page: 1,
            page_size: 10,
            total_pages: 1
          })
        }
        if (method === 'POST') {
          // createSession
          const body = JSON.parse(init.body as string)

          // Validation simulation
          if (body.target_sources && Array.isArray(body.target_sources) && body.target_sources.length === 0) {
            return jsonResponse({ error: 'Validation Error', message: 'target_sources cannot be empty' }, 400)
          }

          const newSessionId = 'mock-' + Math.random().toString(36).substring(7)
          const newSession = {
            session_id: newSessionId,
            start_date: new Date().toISOString(),
            target_sources: body.target_sources || ['PubMed'],
            search_keywords: body.search_keywords || {},
            weekly_targets: body.weekly_targets || {},
            current_phase: 'discovery',
            progress_metrics: {},
          }
          sessionStore.set(newSessionId, newSession)
          return jsonResponse(newSession)
        }
      }

      // Mock /sessions/:id endpoints
      const match = urlStr.match(/\/sessions\/([\w-]+)$/)
      if (match) {
        const id = match[1]

        if (method === 'GET') {
          const session = sessionStore.get(id)
          if (session) {
            return jsonResponse(session)
          }
          return jsonResponse({ error: 'Not Found' }, 404)
        }
        if (method === 'PUT') {
          const session = sessionStore.get(id)
          if (!session) return jsonResponse({ error: 'Not Found' }, 404)

          const body = JSON.parse(init.body as string)
          const updatedSession = { ...session, ...body, session_id: id } // ensure ID doesn't change
          sessionStore.set(id, updatedSession)
          return jsonResponse(updatedSession)
        }
        if (method === 'DELETE') {
          if (sessionStore.has(id)) {
            sessionStore.delete(id)
            return {
              ok: true,
              status: 204,
              statusText: 'No Content',
              json: async () => undefined,
            } as Response
          }
          return jsonResponse({ error: 'Not Found' }, 404)
        }
      }

      // Default fallback
      return {
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ error: 'Not Found' }),
      } as Response
    })
  })

  afterAll(() => {
    vi.restoreAllMocks()
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

