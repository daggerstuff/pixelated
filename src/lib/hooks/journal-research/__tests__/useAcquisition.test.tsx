import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode } from 'react'
import {
    useAcquisitionListQuery,
    useAcquisitionQuery,
    useAcquisitionInitiateMutation,
    useAcquisitionUpdateMutation,
    useAcquisitionSelection,
} from '../useAcquisition'
import * as api from '@/lib/api/journal-research'
import { useAcquisitionStore } from '@/lib/stores/journal-research'

// Mock API functions
vi.mock('@/lib/api/journal-research', () => ({
    listAcquisitions: vi.fn(),
    getAcquisition: vi.fn(),
    initiateAcquisition: vi.fn(),
    updateAcquisition: vi.fn(),
}))

// Mock store
vi.mock('@/lib/stores/journal-research', () => ({
    useAcquisitionStore: vi.fn(),
}))

const mockAcquisition = {
    acquisitionId: 'acq-1',
    sessionId: 'session-1',
    evaluationId: 'eval-1',
    sourceId: 'source-1',
    status: 'completed' as const,
    downloadUrl: 'https://example.com/data.zip',
    downloadedAt: '2024-01-01T00:00:00Z',
    fileSize: 1024000,
    errorMessage: null,
}

const mockAcquisitionList = {
    items: [mockAcquisition],
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

describe('useAcquisition hooks', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        useAcquisitionStore.mockReturnValue({
            filters: {
                statuses: [],
                showDownloadFailuresOnly: false,
            },
            selectedAcquisitionId: null,
            setSelectedAcquisitionId: vi.fn(),
            expandedRowIds: [],
            expandRow: vi.fn(),
            collapseRow: vi.fn(),
        })
    })

    describe('useAcquisitionListQuery', () => {
        it('fetches acquisition list successfully', async () => {
            vi.mocked(api.listAcquisitions).mockResolvedValue(mockAcquisitionList)

            const { result } = renderHook(
                () => useAcquisitionListQuery('session-1'),
                {
                    wrapper: createWrapper(),
                },
            )

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true)
            })

            expect(result.current.data).toBeDefined()
            expect(api.listAcquisitions).toHaveBeenCalledWith('session-1', {
                page: 1,
                pageSize: 25,
            })
        })

        it('applies filters from store', async () => {
            vi.mocked(api.listAcquisitions).mockResolvedValue(mockAcquisitionList)
            useAcquisitionStore.mockReturnValue({
                filters: {
                    statuses: ['completed'],
                    showDownloadFailuresOnly: false,
                },
            })

            const { result } = renderHook(
                () => useAcquisitionListQuery('session-1'),
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
            const { result } = renderHook(() => useAcquisitionListQuery(null), {
                wrapper: createWrapper(),
            })

            expect(result.current.isLoading).toBe(false)
            expect(api.listAcquisitions).not.toHaveBeenCalled()
        })

        it('handles error state', async () => {
            const error = new Error('Failed to fetch acquisitions')
            vi.mocked(api.listAcquisitions).mockRejectedValue(error)

            const { result } = renderHook(
                () => useAcquisitionListQuery('session-1'),
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

    describe('useAcquisitionQuery', () => {
        it('fetches acquisition successfully', async () => {
            vi.mocked(api.getAcquisition).mockResolvedValue(mockAcquisition)

            const { result } = renderHook(
                () => useAcquisitionQuery('session-1', 'acq-1'),
                {
                    wrapper: createWrapper(),
                },
            )

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true)
            })

            expect(result.current.data).toEqual(mockAcquisition)
            expect(api.getAcquisition).toHaveBeenCalledWith('session-1', 'acq-1')
        })

        it('does not fetch when sessionId or acquisitionId is null', () => {
            const { result } = renderHook(
                () => useAcquisitionQuery(null, 'acq-1'),
                {
                    wrapper: createWrapper(),
                },
            )

            expect(result.current.isLoading).toBe(false)
            expect(api.getAcquisition).not.toHaveBeenCalled()
        })

        it('handles error state', async () => {
            const error = new Error('Failed to fetch acquisition')
            vi.mocked(api.getAcquisition).mockRejectedValue(error)

            const { result } = renderHook(
                () => useAcquisitionQuery('session-1', 'acq-1'),
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

    describe('useAcquisitionInitiateMutation', () => {
        it('initiates acquisition successfully', async () => {
            vi.mocked(api.initiateAcquisition).mockResolvedValue(mockAcquisition)
            const setSelectedAcquisitionId = vi.fn()

            vi.spyOn(useAcquisitionStore, 'getState').mockReturnValue({
                setSelectedAcquisitionId,
            } as any)

            const { result } = renderHook(
                () => useAcquisitionInitiateMutation('session-1'),
                {
                    wrapper: createWrapper(),
                },
            )

            const payload = {
                evaluationIds: ['eval-1'],
            }

            result.current.mutate(payload)

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true)
            })

            expect(api.initiateAcquisition).toHaveBeenCalledWith('session-1', payload)
            expect(setSelectedAcquisitionId).toHaveBeenCalledWith('acq-1')
        })

        it('handles error state', async () => {
            const error = new Error('Failed to initiate acquisition')
            vi.mocked(api.initiateAcquisition).mockRejectedValue(error)

            const { result } = renderHook(
                () => useAcquisitionInitiateMutation('session-1'),
                {
                    wrapper: createWrapper(),
                },
            )

            result.current.mutate({
                evaluationIds: ['eval-1'],
            })

            await waitFor(() => {
                expect(result.current.isError).toBe(true)
            })

            expect(result.current.error).toEqual(error)
        })
    })

    describe('useAcquisitionUpdateMutation', () => {
        it('updates acquisition successfully', async () => {
            const updatedAcquisition = {
                ...mockAcquisition,
                status: 'failed' as const,
                errorMessage: 'Download failed',
            }
            vi.mocked(api.updateAcquisition).mockResolvedValue(updatedAcquisition)

            const { result } = renderHook(
                () => useAcquisitionUpdateMutation('session-1'),
                {
                    wrapper: createWrapper(),
                },
            )

            const payload = {
                status: 'failed' as const,
                errorMessage: 'Download failed',
            }

            result.current.mutate({ acquisitionId: 'acq-1', payload })

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true)
            })

            expect(api.updateAcquisition).toHaveBeenCalledWith(
                'session-1',
                'acq-1',
                payload,
            )
        })

        it('handles error state', async () => {
            const error = new Error('Failed to update acquisition')
            vi.mocked(api.updateAcquisition).mockRejectedValue(error)

            const { result } = renderHook(
                () => useAcquisitionUpdateMutation('session-1'),
                {
                    wrapper: createWrapper(),
                },
            )

            result.current.mutate({
                acquisitionId: 'acq-1',
                payload: { status: 'failed' },
            })

            await waitFor(() => {
                expect(result.current.isError).toBe(true)
            })

            expect(result.current.error).toEqual(error)
        })
    })

    describe('useAcquisitionSelection', () => {
        it('returns selection state from store', () => {
            const mockState = {
                selectedAcquisitionId: 'acq-1',
                setSelectedAcquisitionId: vi.fn(),
                expandedRowIds: ['acq-1', 'acq-2'],
                expandRow: vi.fn(),
                collapseRow: vi.fn(),
            }

            useAcquisitionStore.mockReturnValue(mockState)

            const { result } = renderHook(() => useAcquisitionSelection())

            expect(result.current.selectedAcquisitionId).toBe('acq-1')
            expect(result.current.expandedRowIds).toEqual(['acq-1', 'acq-2'])
            expect(typeof result.current.setSelectedAcquisitionId).toBe('function')
            expect(typeof result.current.expandRow).toBe('function')
            expect(typeof result.current.collapseRow).toBe('function')
        })
    })
})
