import { useState, useMemo } from 'react'
import type {
  Acquisition,
  AcquisitionList as AcquisitionListType,
} from '@/lib/api/journal-research/types'
import { Table } from '@/components/ui/table'
import type { TableColumn, TableState, TableDataSource } from '@/components/ui/table-types'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

export interface AcquisitionListProps {
  acquisitions: AcquisitionListType
  onAcquisitionClick?: (acquisition: Acquisition) => void
  isLoading?: boolean
  className?: string
}

export function AcquisitionList({
  acquisitions,
  onAcquisitionClick,
  isLoading = false,
  className,
}: AcquisitionListProps) {
  const [tableState, setTableState] = useState<TableState>({
    currentPage: acquisitions.page ?? 1,
    pageSize: acquisitions.pageSize ?? 10,
  })

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
      completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      'in-progress': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      approved: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      failed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    }
    return (
      colors[status.toLowerCase()] ??
      'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
    )
  }

  const columns: TableColumn<Acquisition & { id: string }>[] = [
    {
      id: 'acquisitionId',
      header: 'Acquisition ID',
      accessor: (row) => (
        <button
          onClick={() => onAcquisitionClick?.(row)}
          className="text-left font-medium text-primary hover:underline font-mono text-sm"
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
          className={`rounded-full px-2 py-1 text-xs font-medium capitalize ${getStatusColor(row.status)}`}
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
        if (progress === 0 && row.status !== 'in-progress') return <span>-</span>
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
  ]

  const tableDataSource: TableDataSource<Acquisition & { id: string }> = {
    data: filteredAndSortedAcquisitions.map((acquisition) => ({
      ...acquisition,
      id: acquisition.acquisitionId,
    })),
    totalCount: filteredAndSortedAcquisitions.length,
    loading: isLoading,
  }

  const statuses = Array.from(
    new Set(acquisitions.items.map((a) => a.status)),
  )

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 gap-2">
          <input
            type="text"
            placeholder="Search acquisitions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm capitalize"
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
        onStateChange={setTableState}
        hoverable
        striped
        bordered
      />
    </div>
  )
}

