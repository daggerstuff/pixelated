/**
 * @file WidgetContainer.tsx
 * @description Wrapper component for dashboard widgets — handles drag handles,
 * resize, title bar, and loading/error states.
 */

import { GripVertical, Maximize2, Minimize2, X, RefreshCw } from 'lucide-react'
import { type ReactNode, useCallback, useState } from 'react'

import type { WidgetDefinition } from '../types'

export interface WidgetContainerProps {
  widget: WidgetDefinition
  /** Render-prop or children function for the widget body */
  children: ReactNode
  /** Loading state */
  loading?: boolean
  /** Error message if data fetch failed */
  error?: string | null
  /** Callback when user requests data refresh */
  onRefresh?: () => void
  /** Callback when user removes widget from layout */
  onRemove?: () => void
  /** Whether this widget is currently being dragged */
  isDragging?: boolean
  /** Draggable handler — sets the drag data */
  onDragStart?: (e: React.DragEvent) => void
  onDragEnd?: (e: React.DragEvent) => void
}

export function WidgetContainer({
  widget,
  children,
  loading = false,
  error = null,
  onRefresh,
  onRemove,
  isDragging = false,
  onDragStart,
  onDragEnd,
}: WidgetContainerProps) {
  const [expanded, setExpanded] = useState(false)

  const handleRefresh = useCallback(() => {
    onRefresh?.()
  }, [onRefresh])

  return (
    <div
      draggable={!!onDragStart}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      style={{
        background: 'var(--np-surface)',
        border: '1px solid var(--np-line)',
        borderRadius: '12px',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: expanded ? '400px' : '200px',
        opacity: isDragging ? 0.5 : 1,
        transition: 'opacity 0.15s ease, box-shadow 0.15s ease',
        boxShadow: isDragging ? '0 4px 12px rgba(0,0,0,0.15)' : 'none',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 14px',
          borderBottom: '1px solid var(--np-line)',
          cursor: onDragStart ? 'grab' : 'default',
          background: 'var(--np-elevated)',
          flexShrink: 0,
        }}
      >
        {onDragStart && (
          <GripVertical
            size={16}
            style={{ color: 'var(--np-muted)', flexShrink: 0, cursor: 'grab' }}
          />
        )}
        <span
          style={{
            fontSize: '0.875rem',
            fontWeight: 600,
            color: 'var(--np-text)',
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {widget.title}
        </span>
        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
          {onRefresh && (
            <button
              type="button"
              onClick={handleRefresh}
              aria-label="Refresh"
              style={iconBtnStyle}
            >
              <RefreshCw size={14} />
            </button>
          )}
          <button
            type="button"
            onClick={() => setExpanded((p) => !p)}
            aria-label={expanded ? 'Collapse' : 'Expand'}
            style={iconBtnStyle}
          >
            {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              aria-label="Remove widget"
              style={iconBtnStyle}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div
        style={{
          flex: 1,
          padding: '14px',
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {loading ? (
          <div style={loadingStyle}>
            <RefreshCw size={20} className="animate-spin" />
            <span style={{ color: 'var(--np-muted)', fontSize: '0.8rem' }}>
              Loading…
            </span>
          </div>
        ) : error ? (
          <div style={errorStyle}>
            <span style={{ color: 'var(--np-danger)', fontSize: '0.8rem' }}>
              {error}
            </span>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  )
}

const iconBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  padding: '4px',
  borderRadius: '4px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--np-muted)',
  transition: 'background 0.15s',
}

const loadingStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  height: '100%',
  minHeight: '100px',
}

const errorStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  minHeight: '80px',
}
