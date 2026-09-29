import { format } from 'date-fns'
import { CheckCircle2, Loader2, Play } from 'lucide-react'
import { useState, useMemo } from 'react'

import { Button } from '@/components/ui/button/button'
import { Table } from '@/components/ui/table'
import type {
  TableColumn,
  TableState,
  TableDataSource,
} from '@/components/ui/table-types'
import type {
  Acquisition,
  AcquisitionList as AcquisitionListType,
} from '@/lib/api/journal-research/types'
import {
  useIntegrateDataset,
  useTrainingStatus,
} from '@/lib/hooks/journal-research/useTraining'
import { cn } from '@/lib/utils'

export interface AcquisitionListProps {
  acquisitions: AcquisitionListType
  onAcquisitionClick?: (acquisition: Acquisition) => void
  isLoading?: boolean
  className?: string
  sessionId?: string | null
}

export function AcquisitionList({
  acquisitions,
  onAcquisitionClick,
  isLoading = false,
  className,
  sessionId,
}: AcquisitionListProps) {
  const integrateMutation = useIntegrateDataset(sessionId ?? '')
  const { data: trainingStatus } = useTrainingStatus(
    sessionId ?? '',
    !!sessionId,
  )

  // Create a map of integration statuses
  const integrationStatusMap = useMemo(() => {
    const map = new Map<string, boolean>()
    if (trainingStatus?.datasets) {
      trainingStatus.datasets.forEach((ds) => {
        map.set(ds.source_id, ds.integrated)
      })
    }
    return map
  }, [trainingStatus])
  const [tableState, setTableState] = useState<TableState>({
    currentPage: acquisitions.page ?? 1,
    pageSize: acquisitions.pageSize ?? 10,
  })
  const handleTableStateChange: (newState: Partial<TableState>) => void = (
    newState,
  ) => {
    setTableState((prevState) => ({
      ...prevState,
      ...newState,
    }))
  }

  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const filteredAndSortedAcquisitions = useMemo(() => {
    let filtered = acquisitions.items

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(
        (acq) =>
          acq.acquisitionId.toLowerCase().includes(term) ||
          acq.sourceId.toLowerCase().includes(term) ||
          acq.status.toLowerCase().includes(term),
      )
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((acq) => acq.status === statusFilter)
    }

    // Apply sorting
    if (tableState.sort) {
      const { sortBy, direction } = tableState.sort
      filtered = [...filtered].sort((a, b) => {
        let aValue: string | number | Date | null
        let bValue: string | number | Date | null

        switch (sortBy) {
          case 'status':
            aValue = a.status
            bValue = b.status
            break
          case 'acquiredDate':
            aValue = a.acquiredDate
            bValue = b.acquiredDate
            break
          case 'downloadProgress':
            aValue = a.downloadProgress ?? 0
            bValue = b.downloadProgress ?? 0
            break
          case 'fileSizeMb':
            aValue = a.fileSizeMb ?? 0
            bValue = b.fileSizeMb ?? 0
            break
          default:
            return 0
        }

        if (aValue === null) return 1
        if (bValue === null) return -1
        if (aValue < bValue) return direction === 'asc' ? -1 : 1
        if (aValue > bValue) return direction === 'asc' ? 1 : -1
        return 0
      })
    }

    return filtered
  }, [acquisitions.items, searchTerm, statusFilter, tableState.sort])

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'completed': 'bg-secondary border border-input text-foreground',
      'in-progress':
        'bg-secondary border border-ring text-foreground font-medium',
      'pending': 'bg-secondary border border-input text-muted-foreground',
      'approved': 'bg-secondary border border-border text-muted-foreground',
      'failed': 'bg-primary text-primary-foreground font-semibold',
    }
    return (
      colors[status.toLowerCase()] ??
      'bg-secondary border border-border text-muted-foreground'
    )
  }

  const columns: TableColumn<Acquisition & { id: string }>[] = [
    {
      id: 'acquisitionId',
      header: 'Acquisition ID',
      accessor: (row) => (
        <button
          onClick={() => onAcquisitionClick?.(row)}
          className="text-left font-mono text-sm font-medium text-primary hover:underline"
        >
          {row.acquisitionId.slice(0, 8)}...
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
      id: 'status',
      header: 'Status',
      accessor: (row) => (
        <span
          className={`rounded-none px-2 py-1 text-xs font-medium capitalize ${getStatusColor(row.status)}`}
        >
          {row.status.replace('-', ' ')}
        </span>
      ),
      sortable: true,
    },
    {
      id: 'downloadProgress',
      header: 'Progress',
      accessor: (row) => {
        const progress = row.downloadProgress ?? 0
        if (progress === 0 && row.status !== 'in-progress')
          return <span>-</span>
        return (
          <div className="flex items-center gap-2">
            <div className="h-2 w-24 overflow-hidden rounded-none bg-muted">
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
      id: 'fileSizeMb',
      header: 'Size',
      accessor: (row) =>
        row.fileSizeMb ? (
          <span className="text-sm">
            {row.fileSizeMb < 1024
              ? `${row.fileSizeMb.toFixed(1)} MB`
              : `${(row.fileSizeMb / 1024).toFixed(1)} GB`}
          </span>
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
      sortable: true,
      align: 'right',
      hideMobile: true,
    },
    {
      id: 'acquiredDate',
      header: 'Date',
      accessor: (row) =>
        row.acquiredDate ? (
          format(row.acquiredDate, 'MMM d, yyyy')
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
      sortable: true,
      hideMobile: true,
    },
    {
      id: 'trainingIntegration',
      header: 'Training Pipeline',
      accessor: (row) => {
        const isIntegrated = integrationStatusMap.get(row.sourceId) ?? false
        const isIntegrating = integrateMutation.isPending

        if (isIntegrated) {
          return (
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-foreground" />
              <span className="text-xs text-foreground">Integrated</span>
            </div>
          )
        }

        if (isIntegrating) {
          return (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                Integrating...
              </span>
            </div>
          )
        }

        if (row.status === 'completed' && sessionId) {
          return (
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation()
                integrateMutation.mutate({ sourceId: row.sourceId })
              }}
              className="h-7 text-xs"
            >
              <Play className="mr-1 h-3 w-3" />
              Integrate
            </Button>
          )
        }

        return <span className="text-xs text-muted-foreground">-</span>
      },
      sortable: false,
      align: 'center',
    },
  ]

  const tableDataSource: TableDataSource<Acquisition & { id: string }> = {
    data: filteredAndSortedAcquisitions.map((acquisition) => ({
      ...acquisition,
      id: acquisition.acquisitionId,
    })),
    totalCount: filteredAndSortedAcquisitions.length,
    loading: isLoading,
  }

  const statuses = Array.from(new Set(acquisitions.items.map((a) => a.status)))

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 gap-2">
          <input
            type="text"
            placeholder="Search acquisitions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 rounded-none border border-input bg-background px-3 py-2 text-sm"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-none border border-input bg-background px-3 py-2 text-sm capitalize"
          >
            <option value="all">All Statuses</option>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status.replace('-', ' ')}
              </option>
            ))}
          </select>
        </div>
        <div className="text-sm text-muted-foreground">
          Showing {filteredAndSortedAcquisitions.length} of {acquisitions.total}{' '}
          acquisitions
        </div>
      </div>

      <Table
        columns={columns}
        dataSource={tableDataSource}
        tableState={tableState}
        onStateChange={handleTableStateChange}
        hoverable
        striped
        bordered
      />
    </div>
  )
}
