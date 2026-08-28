import { ChevronUp, ChevronDown } from 'lucide-react'
import React, { FC, useState, useMemo } from 'react'

export interface TableColumn {
  key: string
  label: string
  align?: 'left' | 'center' | 'right'
  width?: string
  format?: (value: unknown) => string
  sortable?: boolean
}

export interface TableWidgetProps {
  columns: TableColumn[]
  rows: Array<Record<string, unknown>>
  pageSize?: number
  maxRows?: number
  showHeader?: boolean
  emptyMessage?: string
}

export const TableWidget: FC<TableWidgetProps> = ({
  columns,
  rows,
  pageSize = 10,
  maxRows,
  showHeader = true,
  emptyMessage = 'No data available',
}) => {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(0)

  const displayRows = useMemo(() => {
    let result = [...rows]
    if (maxRows && result.length > maxRows) {
      result = result.slice(0, maxRows)
    }
    if (sortKey) {
      const col = columns.find((c) => c.key === sortKey)
      result.sort((a, b) => {
        const aVal = a[sortKey]
        const bVal = b[sortKey]
        let cmp = 0
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          cmp = aVal - bVal
        } else {
          cmp = String(aVal ?? '').localeCompare(String(bVal ?? ''))
        }
        return sortDir === 'asc' ? cmp : -cmp
      })
    }
    if (pageSize > 0) {
      result = result.slice(page * pageSize, (page + 1) * pageSize)
    }
    return result
  }, [rows, sortKey, sortDir, page, pageSize, maxRows, columns])

  const totalPages = Math.ceil(rows.length / pageSize)

  const handleSort = (col: TableColumn) => {
    if (!col.sortable) return
    if (sortKey === col.key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(col.key)
      setSortDir('asc')
    }
  }

  const cellStyle = (align: TableColumn['align']): React.CSSProperties => ({
    textAlign: align ?? 'left',
    padding: '6px 12px',
    fontSize: 12,
    color: 'var(--np-text)',
    borderBottom: '1px solid var(--np-line)',
  })

  if (rows.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          minHeight: 120,
          color: 'var(--np-muted)',
          fontSize: 13,
        }}
      >
        {emptyMessage}
      </div>
    )
  }

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        {showHeader && (
          <thead>
            <tr style={{ borderBottom: '2px solid var(--np-line)' }}>
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col)}
                  style={{
                    ...cellStyle(col.align),
                    cursor: col.sortable ? 'pointer' : 'default',
                    fontWeight: 600,
                    fontSize: 11,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    color: 'var(--np-muted)',
                    width: col.width,
                    userSelect: 'none',
                  }}
                >
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    {col.label}
                    {col.sortable &&
                      sortKey === col.key &&
                      (sortDir === 'asc' ? (
                        <ChevronUp size={12} />
                      ) : (
                        <ChevronDown size={12} />
                      ))}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {displayRows.map((row, rowIdx) => (
            <tr
              key={rowIdx}
              style={{ transition: 'background-color 0.15s' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--np-hover)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              {columns.map((col) => {
                const value = row[col.key]
                const display = col.format
                  ? col.format(value)
                  : (value?.toString() ?? '')
                return (
                  <td key={col.key} style={cellStyle(col.align)}>
                    {display}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {totalPages > 1 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '8px 12px',
            fontSize: 11,
            color: 'var(--np-muted)',
          }}
        >
          <span>
            Page {page + 1} of {totalPages}
          </span>
          <span>
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              style={{
                background: 'none',
                border: `1px solid var(--np-line)`,
                color: 'var(--np-text)',
                padding: '2px 8px',
                borderRadius: 4,
                cursor: page === 0 ? 'not-allowed' : 'pointer',
                opacity: page === 0 ? 0.5 : 1,
                marginRight: 4,
              }}
            >
              ← Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              style={{
                background: 'none',
                border: `1px solid var(--np-line)`,
                color: 'var(--np-text)',
                padding: '2px 8px',
                borderRadius: 4,
                cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer',
                opacity: page >= totalPages - 1 ? 0.5 : 1,
              }}
            >
              Next →
            </button>
          </span>
        </div>
      )}
    </div>
  )
}

export default TableWidget
