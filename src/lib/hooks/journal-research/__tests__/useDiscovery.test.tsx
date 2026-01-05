import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode } from 'react'
import {
    useDiscoveryListQuery,
    useSourceQuery,
    useDiscoveryInitiateMutation,
} from '../useDiscovery'
import * as api from '@/lib/api/journal-research'
import { useDiscoveryStore } from '@/lib/stores/journal-research'

// Mock API functions
vi.mock('@/lib/api/journal-research', () => ({
    listSources: vi.fn(),
    getSource: vi.fn(),
    initiateDiscovery: vi.fn(),
}))

// Mock store
vi.mock('@/lib/stores/journal-research', () => ({
    useDiscoveryStore: vi.fn(),
}))

const mockSource = {
    sourceId: 'source-1',
    title: 'Test Source',
    sourceType: 'journal' as const,
    publicationDate: '2024-01-01',
    openAccess: true,
    dataAvailability: 'available',
    keywords: ['test', 'research'],
    url: 'https://example.com',
}

const mockSourceList = {
    items: [mockSource],
    total: 1,
    page: 1,
    pageSize: 25,
    totalPages: 1,
}

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

describe('useDiscovery hooks', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        useDiscoveryStore.mockReturnValue({
            filters: {
                openAccessOnly: false,
                sourceTypes: [],
                keywords: [],
                sortBy: 'relevance',
                sortDirection: 'asc',
            },
        })
    })

    describe('useDiscoveryListQuery', () => {
        it('fetches source list successfully', async () => {
            vi.mocked(api.listSources).mockResolvedValue(mockSourceList)

            const { result } = renderHook(
                () => useDiscoveryListQuery('session-1'),
                {
                    wrapper: createWrapper(),
                },
            )

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true)
            })

            expect(result.current.data).toEqual(mockSourceList)
            expect(api.listSources).toHaveBeenCalledWith('session-1', {
                page: 1,
                pageSize: 25,
            })
        })

        it('applies filters from store', async () => {
            vi.mocked(api.listSources).mockResolvedValue(mockSourceList)
            useDiscoveryStore.mockReturnValue({
                filters: {
                    openAccessOnly: true,
                    sourceTypes: ['journal'],
                    keywords: ['test'],
                    sortBy: 'publication_date',
                    sortDirection: 'desc',
                },
            })

            const { result } = renderHook(
                () => useDiscoveryListQuery('session-1'),
                {
                    wrapper: createWrapper(),
                },
            )

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true)
            })

            expect(result.current.data).toBeDefined()
        })

        it('does not fetch when sessionId is null', () => {
            const { result } = renderHook(() => useDiscoveryListQuery(null), {
                wrapper: createWrapper(),
            })

            expect(result.current.isLoading).toBe(false)
            expect(api.listSources).not.toHaveBeenCalled()
        })

        it('handles error state', async () => {
            const error = new Error('Failed to fetch sources')
            vi.mocked(api.listSources).mockRejectedValue(error)

            const { result } = renderHook(
                () => useDiscoveryListQuery('session-1'),
                {
                    wrapper: createWrapper(),
                },
            )

            await waitFor(() => {
                expect(result.current.isError).toBe(true)
            })

            expect(result.current.error).toEqual(error)
        })
    })

    describe('useSourceQuery', () => {
        it('fetches source successfully', async () => {
            vi.mocked(api.getSource).mockResolvedValue(mockSource)

            const { result } = renderHook(
                () => useSourceQuery('session-1', 'source-1'),
                {
                    wrapper: createWrapper(),
                },
            )

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true)
            })

            expect(result.current.data).toEqual(mockSource)
            expect(api.getSource).toHaveBeenCalledWith('session-1', 'source-1')
        })

        it('does not fetch when sessionId or sourceId is null', () => {
            const { result } = renderHook(
                () => useSourceQuery(null, 'source-1'),
                {
                    wrapper: createWrapper(),
                },
            )

            expect(result.current.isLoading).toBe(false)
            expect(api.getSource).not.toHaveBeenCalled()
        })

        it('handles error state', async () => {
            const error = new Error('Failed to fetch source')
            vi.mocked(api.getSource).mockRejectedValue(error)

            const { result } = renderHook(
                () => useSourceQuery('session-1', 'source-1'),
                {
                    wrapper: createWrapper(),
                },
            )

            await waitFor(() => {
                expect(result.current.isError).toBe(true)
            })

            expect(result.current.error).toEqual(error)
        })
    })

    describe('useDiscoveryInitiateMutation', () => {
        it('initiates discovery successfully', async () => {
            const mockResponse: api.DiscoveryResponse = {
                sessionId: 'session-1',
                status: 'in_progress',
                sourcesDiscovered: 0,
                message: 'Discovery started',
            }
            vi.mocked(api.initiateDiscovery).mockResolvedValue(mockResponse)

            const { result } = renderHook(() => useDiscoveryInitiateMutation('session-1'), {
                wrapper: createWrapper(),
            })

            const payload: api.DiscoveryInitiatePayload = {
                searchKeywords: { mental_health: ['depression'] },
                filters: { openAccessOnly: true },
            }

            result.current.mutate(payload)

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true)
            })

            expect(api.initiateDiscovery).toHaveBeenCalledWith('session-1', payload)
        })

        it('handles error state', async () => {
            const error = new Error('Failed to initiate discovery')
            vi.mocked(api.initiateDiscovery).mockRejectedValue(error)

            const { result } = renderHook(() => useDiscoveryInitiateMutation('session-1'), {
                wrapper: createWrapper(),
            })

            result.current.mutate({
                searchKeywords: { mental_health: ['depression'] },
            })

            await waitFor(() => {
                expect(result.current.isError).toBe(true)
            })

            expect(result.current.error).toEqual(error)
        })
    })
})
