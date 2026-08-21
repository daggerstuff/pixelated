import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Download,
  Loader2,
  RotateCcw,
  Search,
} from 'lucide-react'
import React, { useCallback, useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'

const API_BASE = '/api/ehr/v1'
const PAGE_SIZE = 50

interface AuditLogViewerProps {
  patientId?: string
}

export interface AuditEntry {
  id: string
  timestamp: string
  userId: string
  action: string
  resourceType: string
  resourceId: string
  patientId: string
  outcome: 'success' | 'denied' | 'error'
  details: string
}

type SortDirection = 'asc' | 'desc'

type SortColumn =
  | 'timestamp'
  | 'userId'
  | 'action'
  | 'resourceType'
  | 'resourceId'
  | 'patientId'
  | 'outcome'

interface Filters {
  dateFrom: string
  dateTo: string
  user: string
  action: string
  resourceType: string
  outcome: string
  search: string
}

const ACTION_OPTIONS = ['', 'read', 'write', 'delete', 'create', 'update']
const OUTCOME_OPTIONS = ['', 'success', 'denied', 'error']
const RESOURCE_TYPE_OPTIONS = [
  '',
  'Patient',
  'Encounter',
  'Consent',
  'Observation',
  'DocumentReference',
  'Claim',
  'Appointment',
  'Provenance',
]

const EMPTY_FILTERS: Filters = {
  dateFrom: '',
  dateTo: '',
  user: '',
  action: '',
  resourceType: '',
  outcome: '',
  search: '',
}

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

function exportToCsv(entries: AuditEntry[]): void {
  const headers = [
    'Timestamp',
    'User',
    'Action',
    'Resource Type',
    'Resource ID',
    'Patient ID',
    'Outcome',
    'Details',
  ]
  const rows = entries.map((e) => [
    e.timestamp,
    e.userId,
    e.action,
    e.resourceType,
    e.resourceId,
    e.patientId,
    e.outcome,
    e.details.replace(/"/g, '""'),
  ])
  const csv = [
    headers.join(','),
    ...rows.map((r) => r.map((c) => `"${c}"`).join(',')),
  ].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function AuditLogViewer({ patientId }: AuditLogViewerProps) {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(0)
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [sortColumn, setSortColumn] = useState<SortColumn>('timestamp')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const fetchAuditLogs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (patientId) {
        params.set('patient', patientId)
      }
      const res = await fetch(
        `${API_BASE}/audit-logs${params.size > 0 ? `?${params.toString()}` : ''}`,
      )
      if (!res.ok) {
        throw new Error(`Failed to fetch audit logs: ${res.status}`)
      }
      const data = (await res.json()) as AuditEntry[]
      setEntries(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit logs')
    } finally {
      setLoading(false)
    }
  }, [patientId])

  useEffect(() => {
    void fetchAuditLogs()
  }, [fetchAuditLogs])

  const filteredEntries = useMemo(() => {
    let result = entries

    if (filters.dateFrom) {
      result = result.filter(
        (e) => e.timestamp >= filters.dateFrom,
      )
    }
    if (filters.dateTo) {
      result = result.filter((e) => e.timestamp <= filters.dateTo + 'T23:59:59')
    }
    if (filters.user) {
      const lower = filters.user.toLowerCase()
      result = result.filter((e) =>
        e.userId.toLowerCase().includes(lower),
      )
    }
    if (filters.action) {
      result = result.filter((e) => e.action === filters.action)
    }
    if (filters.resourceType) {
      result = result.filter((e) => e.resourceType === filters.resourceType)
    }
    if (filters.outcome) {
      result = result.filter((e) => e.outcome === filters.outcome)
    }
    if (filters.search) {
      const lower = filters.search.toLowerCase()
      result = result.filter((e) =>
        e.details.toLowerCase().includes(lower),
      )
    }

    result = [...result].sort((a, b) => {
      const aVal = a[sortColumn]
      const bVal = b[sortColumn]
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0
      return sortDirection === 'asc' ? cmp : -cmp
    })

    return result
  }, [entries, filters, sortColumn, sortDirection])

  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / PAGE_SIZE))
  const safePage = Math.min(currentPage, totalPages - 1)
  const pageEntries = filteredEntries.slice(
    safePage * PAGE_SIZE,
    (safePage + 1) * PAGE_SIZE,
  )

  useEffect(() => {
    setCurrentPage(0)
  }, [filters])

  const handleSort = useCallback(
    (column: SortColumn) => {
      if (sortColumn === column) {
        setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      } else {
        setSortColumn(column)
        setSortDirection('asc')
      }
    },
    [sortColumn],
  )

  const handleClearFilters = useCallback(() => {
    setFilters(EMPTY_FILTERS)
  }, [])

  const handleExport = useCallback(() => {
    exportToCsv(filteredEntries)
  }, [filteredEntries])

  const toggleExpand = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }, [])

  const renderSortIcon = (column: SortColumn) => {
    if (sortColumn !== column) return null
    return sortDirection === 'asc' ? (
      <ArrowUp className="inline h-3 w-3" />
    ) : (
      <ArrowDown className="inline h-3 w-3" />
    )
  }

  const columns: { key: SortColumn; label: string }[] = [
    { key: 'timestamp', label: 'Timestamp' },
    { key: 'userId', label: 'User' },
    { key: 'action', label: 'Action' },
    { key: 'resourceType', label: 'Resource Type' },
    { key: 'resourceId', label: 'Resource ID' },
    { key: 'patientId', label: 'Patient ID' },
    { key: 'outcome', label: 'Outcome' },
  ]

  const OUTCOME_BADGE: Record<string, string> = {
    success: 'bg-green-100 text-green-700',
    denied: 'bg-red-100 text-red-700',
    error: 'bg-orange-100 text-orange-700',
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Audit Log Viewer</h2>
          <p className="text-sm text-muted-foreground">
            {patientId
              ? `Filtered for patient ${patientId}`
              : 'Showing all audit entries'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={filteredEntries.length === 0}
            aria-label="Export filtered results as CSV"
          >
            <Download className="h-3 w-3" />
            Export CSV
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void fetchAuditLogs()}
            aria-label="Refresh audit logs"
          >
            <RotateCcw className="h-3 w-3" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="border rounded-lg p-4 space-y-3">
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
          <div>
            <label
              htmlFor="filter-date-from"
              className="text-xs font-medium block mb-1"
            >
              Date From
            </label>
            <input
              id="filter-date-from"
              type="date"
              value={filters.dateFrom}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, dateFrom: e.target.value }))
              }
              className="w-full px-2 py-1.5 border rounded-md text-sm"
              aria-label="Filter by start date"
            />
          </div>
          <div>
            <label
              htmlFor="filter-date-to"
              className="text-xs font-medium block mb-1"
            >
              Date To
            </label>
            <input
              id="filter-date-to"
              type="date"
              value={filters.dateTo}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, dateTo: e.target.value }))
              }
              className="w-full px-2 py-1.5 border rounded-md text-sm"
              aria-label="Filter by end date"
            />
          </div>
          <div>
            <label
              htmlFor="filter-user"
              className="text-xs font-medium block mb-1"
            >
              User
            </label>
            <input
              id="filter-user"
              type="text"
              value={filters.user}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, user: e.target.value }))
              }
              placeholder="User ID"
              className="w-full px-2 py-1.5 border rounded-md text-sm"
              aria-label="Filter by user"
            />
          </div>
          <div>
            <label
              htmlFor="filter-action"
              className="text-xs font-medium block mb-1"
            >
              Action
            </label>
            <select
              id="filter-action"
              value={filters.action}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, action: e.target.value }))
              }
              className="w-full px-2 py-1.5 border rounded-md text-sm"
              aria-label="Filter by action type"
            >
              {ACTION_OPTIONS.map((a) => (
                <option key={a} value={a}>
                  {a || 'All Actions'}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="filter-resource-type"
              className="text-xs font-medium block mb-1"
            >
              Resource Type
            </label>
            <select
              id="filter-resource-type"
              value={filters.resourceType}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  resourceType: e.target.value,
                }))
              }
              className="w-full px-2 py-1.5 border rounded-md text-sm"
              aria-label="Filter by resource type"
            >
              {RESOURCE_TYPE_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r || 'All Types'}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="filter-outcome"
              className="text-xs font-medium block mb-1"
            >
              Outcome
            </label>
            <select
              id="filter-outcome"
              value={filters.outcome}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, outcome: e.target.value }))
              }
              className="w-full px-2 py-1.5 border rounded-md text-sm"
              aria-label="Filter by outcome"
            >
              {OUTCOME_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o || 'All Outcomes'}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-3 lg:col-span-2">
            <label
              htmlFor="filter-search"
              className="text-xs font-medium block mb-1"
            >
              Search Details
            </label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <input
                id="filter-search"
                type="text"
                value={filters.search}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, search: e.target.value }))
                }
                placeholder="Search in details..."
                className="w-full pl-7 pr-2 py-1.5 border rounded-md text-sm"
                aria-label="Search audit entry details"
              />
            </div>
          </div>
        </div>
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearFilters}
            aria-label="Clear all filters"
          >
            Clear Filters
          </Button>
        </div>
      </div>

      {/* Table */}
      {loading && (
        <div className="border rounded-lg p-4">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">
              Loading audit entries...
            </span>
          </div>
          {/* Skeleton rows */}
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-8 bg-gray-100 rounded animate-pulse"
                aria-hidden="true"
              />
            ))}
          </div>
        </div>
      )}

      {error && !loading && (
        <div className="border border-red-200 bg-red-50 rounded-lg p-4">
          <p className="text-sm text-red-700" role="alert">
            {error}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => void fetchAuditLogs()}
          >
            Retry
          </Button>
        </div>
      )}

      {!loading && !error && filteredEntries.length === 0 && (
        <div className="border rounded-lg p-4 text-center py-8">
          <p className="text-sm text-muted-foreground">
            No audit entries found
          </p>
        </div>
      )}

      {!loading && !error && filteredEntries.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-sm" role="table">
              <thead className="sticky top-0 bg-white z-10">
                <tr className="border-b">
                  <th className="text-left py-2 px-2 w-8" />
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      className="text-left py-2 px-2 cursor-pointer select-none hover:bg-gray-50"
                      onClick={() => handleSort(col.key)}
                      aria-sort={
                        sortColumn === col.key
                          ? sortDirection === 'asc'
                            ? 'ascending'
                            : 'descending'
                          : 'none'
                      }
                    >
                      {col.label} {renderSortIcon(col.key)}
                    </th>
                  ))}
                  <th className="text-left py-2 px-2">Details</th>
                </tr>
              </thead>
              <tbody>
                {pageEntries.map((entry) => (
                  <React.Fragment key={entry.id}>
                    <tr className="border-b hover:bg-gray-50">
                      <td className="py-1 px-2">
                        <button
                          onClick={() => toggleExpand(entry.id)}
                          className="p-1 rounded hover:bg-gray-100"
                          aria-label={
                            expandedId === entry.id
                              ? 'Collapse entry details'
                              : 'Expand entry details'
                          }
                          aria-expanded={expandedId === entry.id}
                        >
                          {expandedId === entry.id ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </button>
                      </td>
                      <td className="py-1 px-2 text-xs text-muted-foreground">
                        {formatTimestamp(entry.timestamp)}
                      </td>
                      <td className="py-1 px-2 font-mono text-xs">
                        {entry.userId}
                      </td>
                      <td className="py-1 px-2">
                        <span className="px-2 py-0.5 bg-gray-100 rounded text-xs">
                          {entry.action}
                        </span>
                      </td>
                      <td className="py-1 px-2 text-xs">
                        {entry.resourceType}
                      </td>
                      <td className="py-1 px-2 font-mono text-xs">
                        {entry.resourceId}
                      </td>
                      <td className="py-1 px-2 font-mono text-xs">
                        {entry.patientId}
                      </td>
                      <td className="py-1 px-2">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium ${
                            OUTCOME_BADGE[entry.outcome] ??
                            'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {entry.outcome}
                        </span>
                      </td>
                      <td className="py-1 px-2 text-xs text-muted-foreground max-w-xs truncate">
                        {entry.details}
                      </td>
                    </tr>
                    {expandedId === entry.id && (
                      <tr>
                        <td colSpan={9} className="px-2 pb-2">
                          <div className="border-t pt-2 space-y-1 text-xs">
                            <div>
                              <span className="font-medium">Full Details:</span>
                              <p className="mt-1 text-muted-foreground whitespace-pre-wrap">
                                {entry.details}
                              </p>
                            </div>
                            <div className="flex gap-4">
                              <div>
                                <span className="font-medium">Entry ID:</span>{' '}
                                <span className="font-mono">{entry.id}</span>
                              </div>
                              <div>
                                <span className="font-medium">Timestamp:</span>{' '}
                                {formatTimestamp(entry.timestamp)}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between border-t px-4 py-2">
            <span className="text-xs text-muted-foreground">
              Showing {safePage * PAGE_SIZE + 1}-
              {Math.min((safePage + 1) * PAGE_SIZE, filteredEntries.length)} of{' '}
              {filteredEntries.length}
            </span>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                disabled={safePage === 0}
                aria-label="Previous page"
              >
                Previous
              </Button>
              <span className="text-xs text-muted-foreground self-center px-2">
                Page {safePage + 1} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages - 1, p + 1))
                }
                disabled={safePage >= totalPages - 1}
                aria-label="Next page"
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
