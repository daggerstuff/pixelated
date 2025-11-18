import { useState, useMemo } from 'react'
import type { Source, SourceList as SourceListType } from '@/lib/api/journal-research/types'
import { Table } from '@/components/ui/table'
import type { TableColumn, TableState, TableDataSource } from '@/components/ui/table-types'
import { format } from 'date-fns'
import { ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SourceListProps {
  sources: SourceListType
  onSourceClick?: (source: Source) => void
  isLoading?: boolean
  className?: string
}

export function SourceList({
  sources,
  onSourceClick,
  isLoading = false,
  className,
}: SourceListProps) {
  const [tableState, setTableState] = useState<TableState>({
    currentPage: sources.page ?? 1,
    pageSize: sources.pageSize ?? 10,
  })

  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [accessFilter, setAccessFilter] = useState<string>('all')

  const filteredAndSortedSources = useMemo(() => {
    let filtered = sources.items

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(
        (source) =>
          source.title.toLowerCase().includes(term) ||
          source.authors.some((author) =>
            author.toLowerCase().includes(term),
          ) ||
          source.keywords.some((keyword) =>
            keyword.toLowerCase().includes(term),
          ) ||
          source.abstract.toLowerCase().includes(term),
      )
    }

    // Apply type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter((source) => source.sourceType === typeFilter)
    }

    // Apply access filter
    if (accessFilter === 'open') {
      filtered = filtered.filter((source) => source.openAccess)
    } else if (accessFilter === 'closed') {
      filtered = filtered.filter((source) => !source.openAccess)
    }

    // Apply sorting
    if (tableState.sort) {
      const { sortBy, direction } = tableState.sort
      filtered = [...filtered].sort((a, b) => {
        let aValue: string | number | Date
        let bValue: string | number | Date

        switch (sortBy) {
          case 'title':
            aValue = a.title
            bValue = b.title
            break
          case 'publicationDate':
            aValue = a.publicationDate
            bValue = b.publicationDate
            break
          case 'sourceType':
            aValue = a.sourceType
            bValue = b.sourceType
            break
          case 'discoveryDate':
            aValue = a.discoveryDate
            bValue = b.discoveryDate
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
  }, [sources.items, searchTerm, typeFilter, accessFilter, tableState.sort])

  const columns: TableColumn<Source & { id: string }>[] = [
    {
      id: 'title',
      header: 'Title',
      accessor: (row) => (
        <button
          onClick={() => onSourceClick?.(row)}
          className="text-left font-medium text-primary hover:underline line-clamp-2"
        >
          {row.title}
        </button>
      ),
      sortable: true,
    },
    {
      id: 'authors',
      header: 'Authors',
      accessor: (row) => (
        <span className="text-sm line-clamp-1">
          {row.authors.slice(0, 2).join(', ')}
          {row.authors.length > 2 && ` +${row.authors.length - 2}`}
        </span>
      ),
      hideMobile: true,
    },
    {
      id: 'publicationDate',
      header: 'Published',
      accessor: (row) => format(row.publicationDate, 'MMM yyyy'),
      sortable: true,
      hideMobile: true,
    },
    {
      id: 'sourceType',
      header: 'Type',
      accessor: (row) => (
        <span className="capitalize text-sm">{row.sourceType}</span>
      ),
      sortable: true,
    },
    {
      id: 'access',
      header: 'Access',
      accessor: (row) =>
        row.openAccess ? (
          <span className="rounded bg-green-100 px-2 py-1 text-xs text-green-800 dark:bg-green-900 dark:text-green-200">
            Open
          </span>
        ) : (
          <span className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-800 dark:bg-gray-900 dark:text-gray-200">
            Closed
          </span>
        ),
    },
    {
      id: 'actions',
      header: '',
      accessor: (row) => (
        <a
          href={row.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:text-primary/80"
          onClick={(e) => e.stopPropagation()}
          aria-label={`Open ${row.title} in new tab`}
        >
          <ExternalLink className="h-4 w-4" />
        </a>
      ),
      align: 'right',
    },
  ]

  const tableDataSource: TableDataSource<Source & { id: string }> = {
    data: filteredAndSortedSources.map((source) => ({
      ...source,
      id: source.sourceId,
    })),
    totalCount: filteredAndSortedSources.length,
    loading: isLoading,
  }

  const sourceTypes = Array.from(
    new Set(sources.items.map((s) => s.sourceType)),
  )

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 gap-2">
          <input
            type="text"
            placeholder="Search sources..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm capitalize"
          >
            <option value="all">All Types</option>
            {sourceTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          <select
            value={accessFilter}
            onChange={(e) => setAccessFilter(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="all">All Access</option>
            <option value="open">Open Access</option>
            <option value="closed">Closed Access</option>
          </select>
        </div>
        <div className="text-sm text-muted-foreground">
          Showing {filteredAndSortedSources.length} of {sources.total} sources
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

