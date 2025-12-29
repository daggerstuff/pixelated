import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode } from 'react'
import {
    useReportListQuery,
    useReportQuery,
    useGenerateReportMutation,
} from '../useReports'
import * as api from '@/lib/api/journal-research'

// Mock API functions
vi.mock('@/lib/api/journal-research', () => ({
    listReports: vi.fn(),
    getReport: vi.fn(),
    generateReport: vi.fn(),
}))

const mockReport = {
    reportId: 'report-1',
    sessionId: 'session-1',
    reportType: 'summary' as const,
    format: 'json' as const,
    generatedAt: '2024-01-01T00:00:00Z',
    content: {
        summary: 'Test report',
        metrics: {},
    },
}

const mockReportList = {
    items: [mockReport],
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

describe('useReports hooks', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('useReportListQuery', () => {
        it('fetches report list successfully', async () => {
            vi.mocked(api.listReports).mockResolvedValue(mockReportList)

            const { result } = renderHook(
                () => useReportListQuery('session-1'),
                {
                    wrapper: createWrapper(),
                },
            )

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true)
            })

            expect(result.current.data).toEqual(mockReportList)
            expect(api.listReports).toHaveBeenCalledWith('session-1', {
                page: 1,
                pageSize: 25,
            })
        })

        it('does not fetch when sessionId is null', () => {
            const { result } = renderHook(() => useReportListQuery(null), {
                wrapper: createWrapper(),
            })

            expect(result.current.isLoading).toBe(false)
            expect(api.listReports).not.toHaveBeenCalled()
        })

        it('handles error state', async () => {
            const error = new Error('Failed to fetch reports')
            vi.mocked(api.listReports).mockRejectedValue(error)

            const { result } = renderHook(() => useReportListQuery('session-1'), {
                wrapper: createWrapper(),
            })

            await waitFor(() => {
                expect(result.current.isError).toBe(true)
            })

            expect(result.current.error).toEqual(error)
        })
    })

    describe('useReportQuery', () => {
        it('fetches report successfully', async () => {
            vi.mocked(api.getReport).mockResolvedValue(mockReport)

            const { result } = renderHook(
                () => useReportQuery('session-1', 'report-1'),
                {
                    wrapper: createWrapper(),
                },
            )

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true)
            })

            expect(result.current.data).toEqual(mockReport)
            expect(api.getReport).toHaveBeenCalledWith('session-1', 'report-1')
        })

        it('does not fetch when sessionId or reportId is null', () => {
            const { result } = renderHook(
                () => useReportQuery(null, 'report-1'),
                {
                    wrapper: createWrapper(),
                },
            )

            expect(result.current.isLoading).toBe(false)
            expect(api.getReport).not.toHaveBeenCalled()
        })

        it('handles error state', async () => {
            const error = new Error('Failed to fetch report')
            vi.mocked(api.getReport).mockRejectedValue(error)

            const { result } = renderHook(
                () => useReportQuery('session-1', 'report-1'),
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

    describe('useGenerateReportMutation', () => {
        it('generates report successfully', async () => {
            vi.mocked(api.generateReport).mockResolvedValue(mockReport)

            const { result } = renderHook(
                () => useGenerateReportMutation('session-1'),
                {
                    wrapper: createWrapper(),
                },
            )

            const payload = {
                reportType: 'summary' as const,
                format: 'json' as const,
            }

            result.current.mutate(payload)

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true)
            })

            expect(api.generateReport).toHaveBeenCalledWith('session-1', payload)
        })

        it('handles error state', async () => {
            const error = new Error('Failed to generate report')
            vi.mocked(api.generateReport).mockRejectedValue(error)

            const { result } = renderHook(
                () => useGenerateReportMutation('session-1'),
                {
                    wrapper: createWrapper(),
                },
            )

            result.current.mutate({
                reportType: 'summary',
                format: 'json',
            })

            await waitFor(() => {
                expect(result.current.isError).toBe(true)
            })

            expect(result.current.error).toEqual(error)
        })
    })
})
