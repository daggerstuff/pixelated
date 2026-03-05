import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode } from 'react'
import {
    useSessionListQuery,
    useSessionQuery,
    useCreateSessionMutation,
    useUpdateSessionMutation,
    useDeleteSessionMutation,
} from '../useSession'
import * as api from '@/lib/api/journal-research'
import { useJournalSessionStore } from '@/lib/stores/journal-research'
import { mockSession, mockSessionList } from '@/components/journal-research/__tests__/test-utils'

// Mock API functions
vi.mock('@/lib/api/journal-research', () => ({
    listSessions: vi.fn(),
    getSession: vi.fn(),
    createSession: vi.fn(),
    updateSession: vi.fn(),
    deleteSession: vi.fn(),
}))

// Mock store
vi.mock('@/lib/stores/journal-research', () => ({
    useJournalSessionStore: vi.fn(),
}))

const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
        },
    })

    return ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
}

describe('useSession hooks', () => {
    beforeEach(() => {
        vi.clearAllMocks()
            ; (useJournalSessionStore as any).mockReturnValue({
                filters: { searchTerm: '', phases: [] },
            })
    })

    describe('useSessionListQuery', () => {
        it('fetches session list successfully', async () => {
            vi.mocked(api.listSessions).mockResolvedValue(mockSessionList)

            const { result } = renderHook(() => useSessionListQuery(), {
                wrapper: createWrapper(),
            })

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true)
            })

            expect(result.current.data).toEqual(mockSessionList)
            expect(api.listSessions).toHaveBeenCalledWith({ page: 1, pageSize: 25 })
        })

        it('applies filters from store', async () => {
            vi.mocked(api.listSessions).mockResolvedValue(mockSessionList)
                ; (useJournalSessionStore as any).mockReturnValue({
                    filters: { searchTerm: 'test', phases: ['discovery'] },
                })

            const { result } = renderHook(() => useSessionListQuery(), {
                wrapper: createWrapper(),
            })

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true)
            })

            // Filtered data should be returned
            expect(result.current.data).toBeDefined()
        })

        it('handles loading state', () => {
            vi.mocked(api.listSessions).mockImplementation(
                () => new Promise(() => { }), // Never resolves
            )

            const { result } = renderHook(() => useSessionListQuery(), {
                wrapper: createWrapper(),
            })

            expect(result.current.isLoading).toBe(true)
        })

        it('handles error state', async () => {
            const error = new Error('Failed to fetch sessions')
            vi.mocked(api.listSessions).mockRejectedValue(error)

            const { result } = renderHook(() => useSessionListQuery(), {
                wrapper: createWrapper(),
            })

            await waitFor(() => {
                expect(result.current.isError).toBe(true)
            })

            expect(result.current.error).toEqual(error)
        })
    })

    describe('useSessionQuery', () => {
        it('fetches session successfully', async () => {
            vi.mocked(api.getSession).mockResolvedValue(mockSession)

            const { result } = renderHook(() => useSessionQuery('test-session-1'), {
                wrapper: createWrapper(),
            })

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true)
            })

            expect(result.current.data).toEqual(mockSession)
            expect(api.getSession).toHaveBeenCalledWith('test-session-1')
        })

        it('does not fetch when sessionId is null', () => {
            const { result } = renderHook(() => useSessionQuery(null), {
                wrapper: createWrapper(),
            })

            expect(result.current.isLoading).toBe(false)
            expect(api.getSession).not.toHaveBeenCalled()
        })

        it('handles error state', async () => {
            const error = new Error('Failed to fetch session')
            vi.mocked(api.getSession).mockRejectedValue(error)

            const { result } = renderHook(() => useSessionQuery('test-session-1'), {
                wrapper: createWrapper(),
            })

            await waitFor(() => {
                expect(result.current.isError).toBe(true)
            })

            expect(result.current.error).toEqual(error)
        })
    })

    describe('useCreateSessionMutation', () => {
        it('creates session successfully', async () => {
            vi.mocked(api.createSession).mockResolvedValue(mockSession)
            const setSelectedSessionId = vi.fn()
            const closeCreateDrawer = vi.fn()

            vi.spyOn(useJournalSessionStore as any, 'getState').mockReturnValue({
                setSelectedSessionId,
                closeCreateDrawer,
            })

            const { result } = renderHook(() => useCreateSessionMutation(), {
                wrapper: createWrapper(),
            })

            const payload = {
                targetSources: ['PubMed'],
                searchKeywords: { mental_health: ['depression'] },
                weeklyTargets: { sources: 10 },
            }

            result.current.mutate(payload)

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true)
            })

            expect(api.createSession).toHaveBeenCalledWith(payload)
            expect(setSelectedSessionId).toHaveBeenCalledWith(mockSession.sessionId)
            expect(closeCreateDrawer).toHaveBeenCalled()
        })
    })

    describe('useUpdateSessionMutation', () => {
        it('updates session successfully', async () => {
            const updatedSession = { ...mockSession, currentPhase: 'evaluation' }
            vi.mocked(api.updateSession).mockResolvedValue(updatedSession)

            const { result } = renderHook(() => useUpdateSessionMutation(), {
                wrapper: createWrapper(),
            })

            const payload = { currentPhase: 'evaluation' }

            result.current.mutate({ sessionId: 'test-session-1', payload })

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true)
            })

            expect(api.updateSession).toHaveBeenCalledWith('test-session-1', payload)
        })
    })

    describe('useDeleteSessionMutation', () => {
        it('deletes session successfully', async () => {
            vi.mocked(api.deleteSession).mockResolvedValue(undefined)
            const setSelectedSessionId = vi.fn()

            vi.spyOn(useJournalSessionStore as any, 'getState').mockReturnValue({
                selectedSessionId: 'test-session-1',
                setSelectedSessionId,
            })

            const { result } = renderHook(() => useDeleteSessionMutation(), {
                wrapper: createWrapper(),
            })

            result.current.mutate('test-session-1')

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true)
            })

            expect(api.deleteSession).toHaveBeenCalledWith('test-session-1')
            expect(setSelectedSessionId).toHaveBeenCalledWith(null)
        })

        it('does not clear selected session if different session is deleted', async () => {
            vi.mocked(api.deleteSession).mockResolvedValue(undefined)
            const setSelectedSessionId = vi.fn()

            vi.spyOn(useJournalSessionStore as any, 'getState').mockReturnValue({
                selectedSessionId: 'other-session',
                setSelectedSessionId,
            })

            const { result } = renderHook(() => useDeleteSessionMutation(), {
                wrapper: createWrapper(),
            })

            result.current.mutate('test-session-1')

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true)
            })

            expect(setSelectedSessionId).not.toHaveBeenCalled()
        })
    })
})
