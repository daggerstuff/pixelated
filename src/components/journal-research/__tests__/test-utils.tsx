import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, type RenderOptions } from '@testing-library/react'
import { ReactElement } from 'react'
import { JournalResearchQueryProvider } from '@/lib/api/journal-research/react-query'

/**
 * Creates a test QueryClient with default options for testing
 */
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  })
}

/**
 * Custom render function that includes React Query provider
 */
export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'> & {
    queryClient?: QueryClient
  },
) {
  const { queryClient = createTestQueryClient(), ...renderOptions } = options ?? {}

  const Wrapper = ({ children }: { children: React.ReactNode }) => {
    return (
      <JournalResearchQueryProvider client={queryClient}>
        {children}
      </JournalResearchQueryProvider>
    )
  }

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    queryClient,
  }
}

/**
 * Mock session data for testing
 */
export const mockSession = {
  sessionId: 'test-session-1',
  startDate: new Date('2024-01-01'),
  targetSources: ['PubMed', 'arXiv'],
  searchKeywords: {
    mental_health: ['depression', 'anxiety'],
    therapy: ['CBT', 'DBT'],
  },
  weeklyTargets: {
    sources: 10,
    datasets: 5,
  },
  currentPhase: 'discovery',
  progressMetrics: {
    progress_percentage: 45,
    sources_identified: 8,
    datasets_evaluated: 3,
    datasets_acquired: 2,
    integration_plans_created: 1,
  },
}

/**
 * Mock session list for testing
 */
export const mockSessionList = {
  items: [mockSession],
  total: 1,
  page: 1,
  pageSize: 10,
  totalPages: 1,
}

/**
 * Mock source data for testing
 */
export const mockSource = {
  sourceId: 'source-1',
  title: 'Test Research Paper',
  authors: ['John Doe', 'Jane Smith'],
  publicationDate: new Date('2023-06-01'),
  sourceType: 'journal_article',
  url: 'https://example.com/paper',
  doi: '10.1234/test',
  abstract: 'This is a test abstract',
  keywords: ['depression', 'therapy'],
  openAccess: true,
  dataAvailability: 'available',
  discoveryDate: new Date('2024-01-15'),
  discoveryMethod: 'automated',
}

/**
 * Mock progress data for testing
 */
export const mockProgress = {
  sessionId: 'test-session-1',
  currentPhase: 'discovery',
  phaseProgress: {
    discovery: 80,
    evaluation: 0,
    acquisition: 0,
    integration: 0,
    reporting: 0,
  },
  overallProgress: 45,
  lastUpdated: new Date('2024-01-15'),
}

/**
 * Mock progress metrics for testing
 */
export const mockProgressMetrics = {
  sourcesIdentified: 8,
  datasetsEvaluated: 3,
  datasetsAcquired: 2,
  integrationPlansCreated: 1,
  lastUpdated: new Date('2024-01-15'),
}

