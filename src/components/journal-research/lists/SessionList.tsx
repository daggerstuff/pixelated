import { useState, useMemo } from 'react'
import type { Session, SessionList as SessionListType } from '@/lib/api/journal-research/types'
import { Table } from '@/components/ui/table'
import type { TableColumn, TableState, TableDataSource } from '@/components/ui/table-types'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

export interface SessionListProps {
  sessions: SessionListType
  onSessionClick?: (session: Session) => void
  isLoading?: boolean
  className?: string
}

export function SessionList({
  sessions,
  onSessionClick,
  isLoading = false,
  className,
}: SessionListProps) {
  const [tableState, setTableState] = useState<TableState>({
    currentPage: sessions.page ?? 1,
    pageSize: sessions.pageSize ?? 10,
  })

  const [searchTerm, setSearchTerm] = useState('')
  const [phaseFilter, setPhaseFilter] = useState<string>('all')

  const filteredAndSortedSessions = useMemo(() => {
    let filtered = sessions.items

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(
        (session) =>
          session.sessionId.toLowerCase().includes(term) ||
          session.currentPhase.toLowerCase().includes(term) ||
          session.targetSources.some((source) =>
            source.toLowerCase().includes(term),
          ),
      )
    }

    // Apply phase filter
    if (phaseFilter !== 'all') {
      filtered = filtered.filter(
        (session) => session.currentPhase === phaseFilter,
      )
    }

    // Apply sorting
    if (tableState.sort) {
      const { sortBy, direction } = tableState.sort
      filtered = [...filtered].sort((a, b) => {
        let aValue: string | number | Date
        let bValue: string | number | Date

        switch (sortBy) {
          case 'sessionId':
            aValue = a.sessionId
            bValue = b.sessionId
            break
          case 'startDate':
            aValue = a.startDate
            bValue = b.startDate
            break
          case 'currentPhase':
            aValue = a.currentPhase
            bValue = b.currentPhase
            break
          case 'progress':
            aValue = a.progressMetrics?.progress_percentage ?? 0
            bValue = b.progressMetrics?.progress_percentage ?? 0
            break
          default:
            return 0
        }

        if (aValue < bValue) return direction === 'asc' ? -1 : 1
        if (aValue > bValue) return direction === 'asc' ? 1 : -1
        return 0
      })
    }

    return filtered
  }, [sessions.items, searchTerm, phaseFilter, tableState.sort])

  const columns: TableColumn<Session & { id: string }>[] = [
    {
      id: 'sessionId',
      header: 'Session ID',
      accessor: (row) => (
        <button
          onClick={() => onSessionClick?.(row)}
          className="text-left font-medium text-primary hover:underline"
        >
          {row.sessionId}
        </button>
      ),
      sortable: true,
    },
    {
      id: 'startDate',
      header: 'Start Date',
      accessor: (row) => format(row.startDate, 'MMM d, yyyy'),
      sortable: true,
      hideMobile: true,
    },
    {
      id: 'currentPhase',
      header: 'Phase',
      accessor: (row) => (
        <span className="capitalize">{row.currentPhase}</span>
      ),
      sortable: true,
    },
    {
      id: 'progress',
      header: 'Progress',
      accessor: (row) => {
        const progress = row.progressMetrics?.progress_percentage ?? 0
        return (
          <div className="flex items-center gap-2">
            <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-sm">{Math.round(progress)}%</span>
          </div>
        )
      },
      sortable: true,
      hideMobile: true,
    },
    {
      id: 'sources',
      header: 'Sources',
      accessor: (row) => (
        <span className="text-sm">{row.targetSources.length} sources</span>
      ),
      hideMobile: true,
    },
  ]

  const tableDataSource: TableDataSource<Session & { id: string }> = {
    data: filteredAndSortedSessions.map((session) => ({
      ...session,
      id: session.sessionId,
    })),
    totalCount: filteredAndSortedSessions.length,
    loading: isLoading,
  }

  const phases = ['all', 'discovery', 'evaluation', 'acquisition', 'integration', 'reporting']

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 gap-2">
          <input
            type="text"
            placeholder="Search sessions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <select
            value={phaseFilter}
            onChange={(e) => setPhaseFilter(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm capitalize"
          >
            {phases.map((phase) => (
              <option key={phase} value={phase}>
                {phase === 'all' ? 'All Phases' : phase}
              </option>
            ))}
          </select>
        </div>
        <div className="text-sm text-muted-foreground">
          Showing {filteredAndSortedSessions.length} of {sessions.total} sessions
        </div>
      </div>

      <Table
        columns={columns}
        dataSource={tableDataSource}
        tableState={tableState}
        onStateChange={setTableState}
        hoverable
        striped
        bordered
      />
    </div>
  )
}

