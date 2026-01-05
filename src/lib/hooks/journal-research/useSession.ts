import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createSession,
  deleteSession,
  getSession,
  listSessions,
  updateSession,
  type CreateSessionPayload,
  type Session,
  type SessionList,
  type UpdateSessionPayload,
} from '@/lib/api/journal-research'
import {
  journalResearchMutationKeys,
  journalResearchQueryKeys,
} from '@/lib/api/journal-research/react-query'
import {
  type SessionPhase,
  useJournalSessionStore,
} from '@/lib/stores/journal-research'

const PAGE_SIZE = 25

interface UseSessionListOptions {
  page?: number
  pageSize?: number
  enabled?: boolean
}

const matchesSearchTerm = (session: Session, searchTerm: string) => {
  if (!searchTerm) {
    return true
  }
  const lowerSearch = searchTerm.toLowerCase()
  if (session.sessionId.toLowerCase().includes(lowerSearch)) {
    return true
  }
  if (session.targetSources.some((source) => source.toLowerCase().includes(lowerSearch))) {
    return true
  }
  return Object.entries(session.searchKeywords).some(([category, keywords]) => {
    if (category.toLowerCase().includes(lowerSearch)) {
      return true
    }
    return keywords.some((keyword) => keyword.toLowerCase().includes(lowerSearch))
  })
}

const matchesPhaseFilter = (session: Session, phases: SessionPhase[]) => {
  if (!phases.length) {
    return true
  }
  const currentPhase = (session.currentPhase ?? 'unknown').toLowerCase()
  return phases.some((phase) => phase === 'unknown'
    ? !currentPhase
    : currentPhase.includes(phase))
}

const applySessionFilters = (
  data: SessionList,
  searchTerm: string,
  phases: SessionPhase[],
): SessionList => {
  const filteredItems = data.items.filter(
    (session) =>
      matchesSearchTerm(session, searchTerm) &&
      matchesPhaseFilter(session, phases),
  )

  const total = filteredItems.length
  const pageSize = data.pageSize
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return {
    ...data,
    items: filteredItems,
    total,
    page: Math.min(data.page, totalPages),
    totalPages,
  }
}

export const useSessionListQuery = ({
  page = 1,
  pageSize = PAGE_SIZE,
  enabled = true,
}: UseSessionListOptions = {}) => {
  const filters = useJournalSessionStore((state) => state.filters)

  return useQuery({
    queryKey: journalResearchQueryKeys.sessions.list({
      page,
      pageSize,
      filters,
    }),
    queryFn: () => listSessions({ page, pageSize }),
    enabled,
    select: (data) => applySessionFilters(data, filters.searchTerm, filters.phases),
  })
}

export const useSessionQuery = (
  sessionId: string | null,
  options: { enabled?: boolean } = {},
) => {
  const { enabled = true } = options
  return useQuery({
    queryKey: journalResearchQueryKeys.sessions.detail(sessionId ?? 'unknown'),
    queryFn: () => getSession(sessionId ?? ''),
    enabled: Boolean(sessionId) && enabled,
  })
}

export const useCreateSessionMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: journalResearchMutationKeys.sessions.create(),
    mutationFn: (payload: CreateSessionPayload) => createSession(payload),
    onSuccess: (session) => {
      queryClient.invalidateQueries({
        queryKey: journalResearchQueryKeys.sessions.root,
      })
      useJournalSessionStore.getState().setSelectedSessionId(session.sessionId)
      useJournalSessionStore.getState().closeCreateDrawer()
    },
  })
}

export const useUpdateSessionMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: journalResearchMutationKeys.sessions.update(),
    mutationFn: ({
      sessionId,
      payload,
    }: {
      sessionId: string
      payload: UpdateSessionPayload
    }) => updateSession(sessionId, payload),
    onSuccess: (session) => {
      queryClient.invalidateQueries({
        queryKey: journalResearchQueryKeys.sessions.detail(session.sessionId),
      })
      queryClient.invalidateQueries({
        queryKey: journalResearchQueryKeys.sessions.list({}),
        exact: false,
      })
    },
  })
}

export const useDeleteSessionMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: journalResearchMutationKeys.sessions.delete(),
    mutationFn: (sessionId: string) => deleteSession(sessionId),
    onSuccess: (_, sessionId) => {
      queryClient.invalidateQueries({
        queryKey: journalResearchQueryKeys.sessions.root,
      })
      const { selectedSessionId, setSelectedSessionId } =
        useJournalSessionStore.getState()
      if (selectedSessionId === sessionId) {
        setSelectedSessionId(null)
      }
    },
  })
}


