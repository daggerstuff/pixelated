import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { Dashboard } from '../Dashboard'
import { renderWithProviders, mockSession, mockProgress, mockProgressMetrics } from '../../__tests__/test-utils'
import * as hooks from '@/lib/hooks/journal-research'
import * as store from '@/lib/stores/journal-research'

// Mock hooks
vi.mock('@/lib/hooks/journal-research', () => ({
  useSessionListQuery: vi.fn(),
  useSessionQuery: vi.fn(),
  useProgressQuery: vi.fn(),
  useProgressMetricsQuery: vi.fn(),
}))

// Mock store
vi.mock('@/lib/stores/journal-research', () => ({
  useJournalSessionStore: vi.fn(),
}))

describe('Dashboard', () => {
  const mockUseSessionListQuery = hooks.useSessionListQuery as ReturnType<typeof vi.fn>
  const mockUseSessionQuery = hooks.useSessionQuery as ReturnType<typeof vi.fn>
  const mockUseProgressQuery = hooks.useProgressQuery as ReturnType<typeof vi.fn>
  const mockUseProgressMetricsQuery = hooks.useProgressMetricsQuery as ReturnType<typeof vi.fn>
  const mockUseJournalSessionStore = store.useJournalSessionStore as ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()

    // Default mock implementations
    mockUseJournalSessionStore.mockReturnValue(null)
    mockUseSessionListQuery.mockReturnValue({
      data: { items: [mockSession], total: 1, page: 1, pageSize: 10, totalPages: 1 },
      isLoading: false,
    })
    mockUseSessionQuery.mockReturnValue({
      data: null,
      isLoading: false,
    })
    mockUseProgressQuery.mockReturnValue({
      data: null,
      isLoading: false,
    })
    mockUseProgressMetricsQuery.mockReturnValue({
      data: null,
      isLoading: false,
    })
  })

  it('renders dashboard header', () => {
    renderWithProviders(<Dashboard />)

    expect(screen.getByText('Journal Research Dashboard')).toBeInTheDocument()
    expect(screen.getByText(/Monitor and manage your research sessions/)).toBeInTheDocument()
  })

  it('renders quick action buttons', () => {
    renderWithProviders(<Dashboard />)

    expect(screen.getByText('New Session')).toBeInTheDocument()
    expect(screen.getByText('View All Sessions')).toBeInTheDocument()
  })

  it('displays recent sessions', () => {
    renderWithProviders(<Dashboard />)

    expect(screen.getByText('Recent Sessions')).toBeInTheDocument()
    expect(screen.getByText(mockSession.sessionId)).toBeInTheDocument()
  })

  it('displays loading state for sessions', () => {
    mockUseSessionListQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
    })

    renderWithProviders(<Dashboard />)

    expect(screen.getByText('Loading sessions...')).toBeInTheDocument()
  })

  it('displays empty state when no sessions', () => {
    mockUseSessionListQuery.mockReturnValue({
      data: { items: [], total: 0, page: 1, pageSize: 10, totalPages: 0 },
      isLoading: false,
    })

    renderWithProviders(<Dashboard />)

    expect(screen.getByText(/No sessions yet/)).toBeInTheDocument()
  })

  it('displays selected session progress when session is selected', () => {
    mockUseJournalSessionStore.mockReturnValue('test-session-1')
    mockUseSessionQuery.mockReturnValue({
      data: mockSession,
      isLoading: false,
    })
    mockUseProgressQuery.mockReturnValue({
      data: mockProgress,
      isLoading: false,
    })
    mockUseProgressMetricsQuery.mockReturnValue({
      data: mockProgressMetrics,
      isLoading: false,
    })

    renderWithProviders(<Dashboard />)

    expect(screen.getByText('Current Session Progress')).toBeInTheDocument()
    expect(screen.getByText(mockSession.sessionId)).toBeInTheDocument()
  })

  it('displays all sessions list', () => {
    renderWithProviders(<Dashboard />)

    expect(screen.getByText('All Sessions')).toBeInTheDocument()
  })

  it('displays recent activity', () => {
    renderWithProviders(<Dashboard />)

    expect(screen.getByText('Recent Activity')).toBeInTheDocument()
  })

  it('handles quick action click for new session', () => {
    const openCreateDrawer = vi.fn()
    mockUseJournalSessionStore.mockReturnValue(null)
    
    // Mock store methods
    vi.spyOn(store.useJournalSessionStore, 'getState').mockReturnValue({
      openCreateDrawer,
      closeCreateDrawer: vi.fn(),
      setSelectedSessionId: vi.fn(),
    } as any)

    renderWithProviders(<Dashboard />)

    const newSessionButton = screen.getByText('New Session')
    newSessionButton.click()

    expect(openCreateDrawer).toHaveBeenCalled()
  })

  it('applies custom className', () => {
    const { container } = renderWithProviders(<Dashboard className="custom-class" />)

    const dashboard = container.querySelector('.custom-class')
    expect(dashboard).toBeInTheDocument()
  })
})

