import { Download, FileText, DollarSign } from 'lucide-react'
import React, { useCallback, useEffect, useState } from 'react'

interface PatientStatement {
  id: string
  patientId: string
  claimId: string
  status: string
  use: string
  created: string
  provider: string
  totalAmount: number
  currency: string
  diagnosis: Array<{ description?: string; code?: string }>
  items: Array<{
    sequence: number
    description?: string
    serviceCode?: string
    quantity?: number
    unitPrice?: number
    net?: number
  }>
  insurance: Array<{ coverage?: string; focal?: boolean; preauthRef?: string }>
}

interface StatementSummary {
  totalStatements: number
  totalBilled: number
  totalPaid: number
  totalOutstanding: number
  currency: string
  recentStatements: Array<{
    id: string
    created: string
    totalAmount: number
    status: string
  }>
}

interface PaginatedResponse<T> {
  data: T[]
  pagination: { limit: number; offset: number; total?: number }
}

interface ErrorResponse {
  error: { code: string; message: string }
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(
    amount,
  )
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function StatementWidget() {
  const [statements, setStatements] = useState<PatientStatement[]>([])
  const [summary, setSummary] = useState<StatementSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [downloading, setDownloading] = useState<string | null>(null)

  const fetchStatements = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      const res = await fetch(`/api/portal/v1/statements?${params.toString()}`)
      if (!res.ok) {
        const err = (await res.json()) as ErrorResponse
        throw new Error(err.error?.message ?? 'Failed to load statements')
      }
      const result = (await res.json()) as PaginatedResponse<PatientStatement>
      setStatements(result.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load statements')
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  const fetchSummary = useCallback(async () => {
    try {
      // Compute summary from all statements
      const res = await fetch('/api/portal/v1/statements')
      if (res.ok) {
        const result = (await res.json()) as PaginatedResponse<PatientStatement>
        const all = result.data
        const totalBilled = all.reduce((sum, s) => sum + s.totalAmount, 0)
        const totalPaid = all
          .filter((s) => s.status === 'adjudicated')
          .reduce((sum, s) => sum + s.totalAmount, 0)
        setSummary({
          totalStatements: all.length,
          totalBilled,
          totalPaid,
          totalOutstanding: totalBilled - totalPaid,
          currency: all[0]?.currency ?? 'USD',
          recentStatements: all.slice(0, 5).map((s) => ({
            id: s.id,
            created: s.created,
            totalAmount: s.totalAmount,
            status: s.status,
          })),
        })
      }
    } catch {
      // Best-effort
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const params = new URLSearchParams()
        if (statusFilter) params.set('status', statusFilter)
        const res = await fetch(
          `/api/portal/v1/statements?${params.toString()}`,
        )
        if (!cancelled && !res.ok) {
          const err = (await res.json()) as ErrorResponse
          throw new Error(err.error?.message ?? 'Failed to load statements')
        }
        if (!cancelled) {
          const result =
            (await res.json()) as PaginatedResponse<PatientStatement>
          if (!cancelled) setStatements(result.data)
        }
      } catch (err) {
        if (!cancelled)
          setError(
            err instanceof Error ? err.message : 'Failed to load statements',
          )
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    void (async () => {
      try {
        const res = await fetch('/api/portal/v1/statements')
        if (!cancelled && res.ok) {
          const result =
            (await res.json()) as PaginatedResponse<PatientStatement>
          if (!cancelled) {
            const all = result.data
            const totalBilled = all.reduce((sum, s) => sum + s.totalAmount, 0)
            const totalPaid = all
              .filter((s) => s.status === 'adjudicated')
              .reduce((sum, s) => sum + s.totalAmount, 0)
            setSummary({
              totalStatements: all.length,
              totalBilled,
              totalPaid,
              totalOutstanding: totalBilled - totalPaid,
              currency: all[0]?.currency ?? 'USD',
              recentStatements: all.slice(0, 5).map((s) => ({
                id: s.id,
                created: s.created,
                totalAmount: s.totalAmount,
                status: s.status,
              })),
            })
          }
        }
      } catch {
        // Best-effort
      }
    })()
    return () => {
      cancelled = true
    }
  }, [statusFilter])

  const handleDownload = async (statementId: string) => {
    setDownloading(statementId)
    try {
      const res = await fetch(
        `/api/portal/v1/statements/${statementId}?format=csv`,
      )
      if (!res.ok) {
        const err = (await res.json()) as ErrorResponse
        throw new Error(err.error?.message ?? 'Failed to download')
      }
      const blob = await res.blob()
      const contentDisposition = res.headers.get('Content-Disposition')
      let filename = 'statement.csv'
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/)
        if (match) filename = match[1]
      }
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download')
    } finally {
      setDownloading(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div
          className="h-6 w-6 animate-spin rounded-full border-2"
          style={{
            borderColor: 'var(--np-muted)',
            borderTopColor: 'var(--np-text)',
          }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2
          className="text-xl font-semibold"
          style={{ color: 'var(--np-text)' }}
        >
          Patient Statements
        </h2>
        <p className="mt-1 text-sm" style={{ color: 'var(--np-muted)' }}>
          View and download your billing statements
        </p>
      </div>

      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div
            className="rounded p-3"
            style={{
              background: 'var(--np-surface)',
              border: '1px solid var(--np-line)',
            }}
          >
            <div className="mb-1 flex items-center gap-2">
              <FileText
                className="h-4 w-4"
                style={{ color: 'var(--np-muted)' }}
              />
              <span className="text-xs" style={{ color: 'var(--np-muted)' }}>
                Statements
              </span>
            </div>
            <p
              className="text-xl font-semibold"
              style={{ color: 'var(--np-text)' }}
            >
              {summary.totalStatements}
            </p>
          </div>
          <div
            className="rounded p-3"
            style={{
              background: 'var(--np-surface)',
              border: '1px solid var(--np-line)',
            }}
          >
            <div className="mb-1 flex items-center gap-2">
              <DollarSign
                className="h-4 w-4"
                style={{ color: 'var(--np-muted)' }}
              />
              <span className="text-xs" style={{ color: 'var(--np-muted)' }}>
                Billed
              </span>
            </div>
            <p
              className="text-xl font-semibold"
              style={{ color: 'var(--np-text)' }}
            >
              {formatCurrency(summary.totalBilled, summary.currency)}
            </p>
          </div>
          <div
            className="rounded p-3"
            style={{
              background: 'var(--np-surface)',
              border: '1px solid var(--np-line)',
            }}
          >
            <div className="mb-1 flex items-center gap-2">
              <DollarSign
                className="h-4 w-4"
                style={{ color: 'var(--np-muted)' }}
              />
              <span className="text-xs" style={{ color: 'var(--np-muted)' }}>
                Paid
              </span>
            </div>
            <p
              className="text-xl font-semibold"
              style={{ color: 'var(--np-text)' }}
            >
              {formatCurrency(summary.totalPaid, summary.currency)}
            </p>
          </div>
          <div
            className="rounded p-3"
            style={{
              background: 'var(--np-surface)',
              border: '1px solid var(--np-line)',
            }}
          >
            <div className="mb-1 flex items-center gap-2">
              <DollarSign
                className="h-4 w-4"
                style={{ color: 'var(--np-muted)' }}
              />
              <span className="text-xs" style={{ color: 'var(--np-muted)' }}>
                Outstanding
              </span>
            </div>
            <p
              className="text-xl font-semibold"
              style={{ color: 'var(--np-text)' }}
            >
              {formatCurrency(summary.totalOutstanding, summary.currency)}
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {['', 'active', 'adjudicated', 'cancelled', 'draft'].map((status) => (
          <button
            key={status || 'all'}
            onClick={() => setStatusFilter(status)}
            className="rounded px-3 py-1.5 text-xs capitalize transition-colors"
            style={{
              background:
                statusFilter === status
                  ? 'var(--np-elevated)'
                  : 'var(--np-surface)',
              color:
                statusFilter === status ? 'var(--np-text)' : 'var(--np-muted)',
              border: '1px solid var(--np-line)',
              fontWeight: statusFilter === status ? 600 : 400,
            }}
          >
            {status || 'All'}
          </button>
        ))}
      </div>

      {error && (
        <div
          className="rounded p-4 text-sm"
          style={{
            background: 'var(--np-surface)',
            color: 'var(--np-text)',
            border: '1px solid var(--np-line)',
          }}
        >
          {error}
        </div>
      )}

      {statements.length === 0 ? (
        <div
          className="rounded py-12 text-center"
          style={{
            background: 'var(--np-surface)',
            border: '1px solid var(--np-line)',
          }}
        >
          <FileText
            className="mx-auto mb-3 h-8 w-8"
            style={{ color: 'var(--np-muted)' }}
          />
          <p className="text-sm" style={{ color: 'var(--np-muted)' }}>
            No statements available.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {statements.map((stmt) => (
            <div
              key={stmt.id}
              className="rounded"
              style={{
                background: 'var(--np-surface)',
                border: '1px solid var(--np-line)',
              }}
            >
              <button
                onClick={() =>
                  setExpandedId(expandedId === stmt.id ? null : stmt.id)
                }
                className="w-full p-4 text-left"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <FileText
                        className="h-4 w-4 flex-shrink-0"
                        style={{ color: 'var(--np-muted)' }}
                      />
                      <span
                        className="text-sm font-medium"
                        style={{ color: 'var(--np-text)' }}
                      >
                        Statement · {formatDate(stmt.created)}
                      </span>
                      <span
                        className="rounded px-2 py-0.5 text-xs capitalize"
                        style={{
                          background: 'var(--np-elevated)',
                          color: 'var(--np-muted)',
                        }}
                      >
                        {stmt.status}
                      </span>
                    </div>
                    <div
                      className="flex items-center gap-4 text-sm"
                      style={{ color: 'var(--np-muted)' }}
                    >
                      <span>{stmt.provider}</span>
                      <span
                        className="font-medium"
                        style={{ color: 'var(--np-text)' }}
                      >
                        {formatCurrency(stmt.totalAmount, stmt.currency)}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      void handleDownload(stmt.id)
                    }}
                    disabled={downloading === stmt.id}
                    className="flex flex-shrink-0 items-center gap-1 rounded px-3 py-1.5 text-xs transition-colors disabled:opacity-50"
                    style={{
                      background: 'var(--np-elevated)',
                      color: 'var(--np-text)',
                    }}
                  >
                    <Download className="h-3.5 w-3.5" />
                    {downloading === stmt.id ? 'Downloading...' : 'CSV'}
                  </button>
                </div>
              </button>

              {expandedId === stmt.id && (
                <div className="space-y-3 px-4 pb-4">
                  {stmt.diagnosis.length > 0 && (
                    <div
                      className="border-t pt-3"
                      style={{ borderColor: 'var(--np-line)' }}
                    >
                      <h4
                        className="mb-2 text-xs font-semibold uppercase"
                        style={{ color: 'var(--np-muted)' }}
                      >
                        Diagnoses
                      </h4>
                      <ul className="space-y-1">
                        {stmt.diagnosis.map((d, i) => (
                          <li
                            key={i}
                            className="text-sm"
                            style={{ color: 'var(--np-text)' }}
                          >
                            {d.code && (
                              <span style={{ color: 'var(--np-muted)' }}>
                                {d.code}:{' '}
                              </span>
                            )}
                            {d.description ?? 'N/A'}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {stmt.items.length > 0 && (
                    <div
                      className="border-t pt-3"
                      style={{ borderColor: 'var(--np-line)' }}
                    >
                      <h4
                        className="mb-2 text-xs font-semibold uppercase"
                        style={{ color: 'var(--np-muted)' }}
                      >
                        Line Items
                      </h4>
                      <table className="w-full text-sm">
                        <thead>
                          <tr style={{ color: 'var(--np-muted)' }}>
                            <th className="py-1 text-left">#</th>
                            <th className="py-1 text-left">Description</th>
                            <th className="py-1 text-right">Qty</th>
                            <th className="py-1 text-right">Net</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stmt.items.map((item) => (
                            <tr
                              key={item.sequence}
                              style={{ color: 'var(--np-text)' }}
                            >
                              <td className="py-1">{item.sequence}</td>
                              <td className="py-1">
                                {item.description ?? item.serviceCode ?? 'N/A'}
                              </td>
                              <td className="py-1 text-right">
                                {item.quantity ?? 1}
                              </td>
                              <td className="py-1 text-right">
                                {item.net != null
                                  ? formatCurrency(item.net, stmt.currency)
                                  : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {stmt.insurance.length > 0 && (
                    <div
                      className="border-t pt-3"
                      style={{ borderColor: 'var(--np-line)' }}
                    >
                      <h4
                        className="mb-2 text-xs font-semibold uppercase"
                        style={{ color: 'var(--np-muted)' }}
                      >
                        Insurance
                      </h4>
                      <ul className="space-y-1">
                        {stmt.insurance.map((ins, i) => (
                          <li
                            key={i}
                            className="text-sm"
                            style={{ color: 'var(--np-text)' }}
                          >
                            {ins.coverage ?? 'N/A'}
                            {ins.focal && (
                              <span
                                className="ml-2 text-xs"
                                style={{ color: 'var(--np-muted)' }}
                              >
                                (primary)
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
