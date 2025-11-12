import { useState, useMemo } from 'react'
import type {
  Evaluation,
  EvaluationList as EvaluationListType,
} from '@/lib/api/journal-research/types'
import { Table } from '@/components/ui/table'
import type { TableColumn, TableState, TableDataSource } from '@/components/ui/table-types'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

export interface EvaluationListProps {
  evaluations: EvaluationListType
  onEvaluationClick?: (evaluation: Evaluation) => void
  isLoading?: boolean
  className?: string
}

export function EvaluationList({
  evaluations,
  onEvaluationClick,
  isLoading = false,
  className,
}: EvaluationListProps) {
  const [tableState, setTableState] = useState<TableState>({
    currentPage: evaluations.page ?? 1,
    pageSize: evaluations.pageSize ?? 10,
  })

  const [searchTerm, setSearchTerm] = useState('')
  const [tierFilter, setTierFilter] = useState<string>('all')
  const [scoreFilter, setScoreFilter] = useState<string>('all')

  const filteredAndSortedEvaluations = useMemo(() => {
    let filtered = evaluations.items

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(
        (eval) =>
          eval.evaluationId.toLowerCase().includes(term) ||
          eval.sourceId.toLowerCase().includes(term) ||
          eval.priorityTier.toLowerCase().includes(term) ||
          eval.evaluator.toLowerCase().includes(term),
      )
    }

    // Apply tier filter
    if (tierFilter !== 'all') {
      filtered = filtered.filter((eval) => eval.priorityTier === tierFilter)
    }

    // Apply score filter
    if (scoreFilter === 'high') {
      filtered = filtered.filter((eval) => eval.overallScore >= 8)
    } else if (scoreFilter === 'medium') {
      filtered = filtered.filter(
        (eval) => eval.overallScore >= 6 && eval.overallScore < 8,
      )
    } else if (scoreFilter === 'low') {
      filtered = filtered.filter((eval) => eval.overallScore < 6)
    }

    // Apply sorting
    if (tableState.sort) {
      const { sortBy, direction } = tableState.sort
      filtered = [...filtered].sort((a, b) => {
        let aValue: string | number | Date
        let bValue: string | number | Date

        switch (sortBy) {
          case 'overallScore':
            aValue = a.overallScore
            bValue = b.overallScore
            break
          case 'priorityTier':
            aValue = a.priorityTier
            bValue = b.priorityTier
            break
          case 'evaluationDate':
            aValue = a.evaluationDate
            bValue = b.evaluationDate
            break
          case 'therapeuticRelevance':
            aValue = a.therapeuticRelevance
            bValue = b.therapeuticRelevance
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
  }, [evaluations.items, searchTerm, tierFilter, scoreFilter, tableState.sort])

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-600 dark:text-green-400'
    if (score >= 6) return 'text-yellow-600 dark:text-yellow-400'
    return 'text-red-600 dark:text-red-400'
  }

  const getPriorityColor = (tier: string) => {
    const colors: Record<string, string> = {
      high: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      low: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    }
    return (
      colors[tier.toLowerCase()] ??
      'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
    )
  }

  const columns: TableColumn<Evaluation & { id: string }>[] = [
    {
      id: 'evaluationId',
      header: 'Evaluation ID',
      accessor: (row) => (
        <button
          onClick={() => onEvaluationClick?.(row)}
          className="text-left font-medium text-primary hover:underline font-mono text-sm"
        >
          {row.evaluationId.slice(0, 8)}...
        </button>
      ),
      sortable: false,
    },
    {
      id: 'sourceId',
      header: 'Source ID',
      accessor: (row) => (
        <span className="font-mono text-sm">{row.sourceId.slice(0, 8)}...</span>
      ),
      hideMobile: true,
    },
    {
      id: 'overallScore',
      header: 'Score',
      accessor: (row) => (
        <span className={`font-bold ${getScoreColor(row.overallScore)}`}>
          {row.overallScore.toFixed(1)}
        </span>
      ),
      sortable: true,
      align: 'right',
    },
    {
      id: 'priorityTier',
      header: 'Priority',
      accessor: (row) => (
        <span
          className={`rounded-full px-2 py-1 text-xs font-medium capitalize ${getPriorityColor(row.priorityTier)}`}
        >
          {row.priorityTier}
        </span>
      ),
      sortable: true,
    },
    {
      id: 'metrics',
      header: 'Metrics',
      accessor: (row) => (
        <div className="flex gap-1 text-xs">
          <span>T:{row.therapeuticRelevance.toFixed(1)}</span>
          <span>D:{row.dataStructureQuality.toFixed(1)}</span>
          <span>I:{row.trainingIntegration.toFixed(1)}</span>
          <span>E:{row.ethicalAccessibility.toFixed(1)}</span>
        </div>
      ),
      hideMobile: true,
    },
    {
      id: 'evaluationDate',
      header: 'Date',
      accessor: (row) => format(row.evaluationDate, 'MMM d, yyyy'),
      sortable: true,
      hideMobile: true,
    },
  ]

  const tableDataSource: TableDataSource<Evaluation & { id: string }> = {
    data: filteredAndSortedEvaluations.map((evaluation) => ({
      ...evaluation,
      id: evaluation.evaluationId,
    })),
    totalCount: filteredAndSortedEvaluations.length,
    loading: isLoading,
  }

  const tiers = Array.from(
    new Set(evaluations.items.map((e) => e.priorityTier)),
  )

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 gap-2">
          <input
            type="text"
            placeholder="Search evaluations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm capitalize"
          >
            <option value="all">All Tiers</option>
            {tiers.map((tier) => (
              <option key={tier} value={tier}>
                {tier}
              </option>
            ))}
          </select>
          <select
            value={scoreFilter}
            onChange={(e) => setScoreFilter(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="all">All Scores</option>
            <option value="high">High (≥8)</option>
            <option value="medium">Medium (6-8)</option>
            <option value="low">Low (&lt;6)</option>
          </select>
        </div>
        <div className="text-sm text-muted-foreground">
          Showing {filteredAndSortedEvaluations.length} of {evaluations.total}{' '}
          evaluations
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

