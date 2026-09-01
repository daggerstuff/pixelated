/**
 * @file dashboards/DashboardGrid.tsx
 * @description Customizable dashboard widget grid with CSS Grid layout and
 *   HTML5 drag-and-drop reordering. No external DnD library — uses the
 *   native Drag and Drop API for widget repositioning and a resize handle
 *   for size adjustments. Responsive 12-column grid that collapses to a
 *   single column on tablet/phone.
 * @module ehr/dashboards
 */

import {
  LayoutDashboard,
  Plus,
  Save,
  RotateCcw,
  Download,
  GripVertical,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react'
import React, {
  useCallback,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type FC,
  type ReactNode,
} from 'react'

import type { ClinicalRole } from '@/lib/ehr-native/auth'

import type {
  DashboardType,
  DashboardLayout,
  WidgetDefinition,
  WidgetPosition,
  WidgetSize,
} from './types'
import {
  DASHBOARD_LABELS,
  GRID_COLUMNS,
  WIDGET_REGISTRY,
  WIDGET_SIZE_SPANS,
  canViewWidget,
  createDefaultLayout,
  getAccessibleWidgets,
} from './types'
import { WidgetContainer } from './widgets'
import { AreaChartWidget } from './widgets/AreaChartWidget'
import { BarChartWidget } from './widgets/BarChartWidget'
import { LineChartWidget } from './widgets/LineChartWidget'
import { MetricCard } from './widgets/MetricCard'
import { PieChartWidget } from './widgets/PieChartWidget'
import { DonutChartWidget } from './widgets/PieChartWidget'
import { TableWidget } from './widgets/TableWidget'

// ---------------------------------------------------------------------------
// Widget data prop — each widget receives its slice of dashboard data
// ---------------------------------------------------------------------------

export interface WidgetData {
  /** The widget definition */
  definition: WidgetDefinition
  /** Arbitrary payload from the dashboard API */
  data: unknown
  /** Loading flag */
  loading?: boolean
  /** Error message */
  error?: string
}

// ---------------------------------------------------------------------------
// Widget renderer — maps chartType to the right widget component
// ---------------------------------------------------------------------------

function renderWidgetContent(
  widget: WidgetDefinition,
  data: unknown,
  loading?: boolean,
  error?: string,
): ReactNode {
  if (loading) {
    return (
      <div
        style={{
          padding: '24px',
          textAlign: 'center',
          color: 'var(--np-muted)',
        }}
        role="status"
        aria-live="polite"
      >
        Loading…
      </div>
    )
  }

  if (error) {
    return (
      <div
        style={{
          padding: '24px',
          textAlign: 'center',
          color: 'var(--np-danger)',
        }}
        role="alert"
      >
        {error}
      </div>
    )
  }

  // Metric cards
  if (widget.chartType === 'metric-card') {
    const metric = data as {
      value?: number | string
      unit?: string
      delta?: number
      deltaLabel?: string
      subtext?: string
      lowerIsBetter?: boolean
    }
    return (
      <MetricCard
        label={widget.title}
        value={metric.value ?? 0}
        unit={metric.unit}
        subtext={metric.subtext}
        lowerIsBetter={metric.lowerIsBetter}
      />
    )
  }

  // Line chart
  if (widget.chartType === 'line') {
    const chartData = data as {
      data: Record<string, unknown>[]
      xKey: string
      series: { key: string; label: string; color?: string }[]
    }
    return (
      <LineChartWidget
        widget={widget}
        data={chartData.data as Array<Record<string, string | number | null>>}
        xKey={chartData.xKey}
        yKeys={chartData.series.map((s) => s.key)}
      />
    )
  }

  // Area chart
  if (widget.chartType === 'area') {
    const chartData = data as {
      data: Record<string, unknown>[]
      xKey: string
      series: { key: string; label: string; color?: string }[]
      stacked?: boolean
    }
    return (
      <AreaChartWidget
        data={chartData.data as Array<Record<string, string | number | null>>}
        xKey={chartData.xKey}
        yKeys={chartData.series.map((s) => s.key)}
        stacked={chartData.stacked}
      />
    )
  }

  // Bar chart
  if (widget.chartType === 'bar') {
    const chartData = data as {
      data: Record<string, unknown>[]
      xKey: string
      series: { key: string; label: string; color?: string }[]
      horizontal?: boolean
      stacked?: boolean
      statusColors?: Record<string, string>
    }
    return (
      <BarChartWidget
        data={chartData.data as Array<Record<string, string | number | null>>}
        xKey={chartData.xKey}
        yKeys={chartData.series.map((s) => s.key)}
        horizontal={chartData.horizontal}
        stacked={chartData.stacked}
      />
    )
  }

  // Pie / donut chart
  if (widget.chartType === 'pie' || widget.chartType === 'donut') {
    const chartData = data as {
      data: Record<string, unknown>[]
      dataKey: string
      nameKey: string
      colors?: string[]
    }
    const pieData = chartData.data as Array<{
      name: string
      value: number
      color?: string
    }>
    if (widget.chartType === 'donut') {
      return <DonutChartWidget data={pieData} />
    }
    return <PieChartWidget data={pieData} />
  }

  // Table widget
  if (widget.category === 'table') {
    const tableData = data as {
      rows: Record<string, unknown>[]
      columns: {
        key: string
        label: string
        align?: 'left' | 'right' | 'center'
        format?: (v: unknown) => string
        sortable?: boolean
      }[]
      pageSize?: number
    }
    return <TableWidget {...tableData} />
  }

  return (
    <div style={{ padding: '16px', color: 'var(--np-muted)' }}>
      No renderer for chart type: {widget.chartType}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Resize handle — bottom-right corner drag to adjust rowSpan
// ---------------------------------------------------------------------------

interface ResizeHandleProps {
  onResize: (deltaRows: number) => void
  currentRows: number
}

const ResizeHandle: FC<ResizeHandleProps> = ({ onResize, currentRows }) => {
  const startY = useRef(0)
  const startRows = useRef(currentRows)
  const [isResizing, setIsResizing] = useState(false)

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      startY.current = e.clientY
      startRows.current = currentRows
      setIsResizing(true)

      const handleMouseMove = (ev: MouseEvent) => {
        const delta = ev.clientY - startY.current
        const deltaRows = Math.round(delta / 60) // 60px per grid row
        if (deltaRows !== 0) {
          onResize(startRows.current + deltaRows - currentRows)
        }
      }

      const handleMouseUp = () => {
        setIsResizing(false)
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }

      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    },
    [onResize, currentRows],
  )

  return (
    <div
      onMouseDown={handleMouseDown}
      style={{
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 20,
        height: 20,
        cursor: 'ns-resize',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'flex-end',
        padding: '2px 4px',
        opacity: isResizing ? 1 : 0.5,
        transition: 'opacity 0.15s',
      }}
      aria-label="Resize widget height"
      role="separator"
    >
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
        <circle cx="2" cy="2" r="1" fill="var(--np-muted)" />
        <circle cx="8" cy="2" r="1" fill="var(--np-muted)" />
        <circle cx="2" cy="8" r="1" fill="var(--np-muted)" />
        <circle cx="8" cy="8" r="1" fill="var(--np-muted)" />
      </svg>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Widget picker — add new widgets to the grid
// ---------------------------------------------------------------------------

interface WidgetPickerProps {
  dashboard: DashboardType
  role: ClinicalRole
  activeWidgetIds: string[]
  onAdd: (widgetId: string) => void
  onClose: () => void
}

const WidgetPicker: FC<WidgetPickerProps> = ({
  dashboard,
  role,
  activeWidgetIds,
  onAdd,
  onClose,
}) => {
  const available = useMemo(() => {
    const accessible = getAccessibleWidgets(role, dashboard)
    return accessible.filter((w) => !activeWidgetIds.includes(w.id))
  }, [dashboard, role, activeWidgetIds])

  if (available.length === 0) {
    return (
      <div
        style={{
          padding: '24px',
          textAlign: 'center',
          color: 'var(--np-muted)',
        }}
      >
        <p>No additional widgets available for your role.</p>
        <button
          onClick={onClose}
          style={{
            marginTop: 8,
            padding: '6px 16px',
            borderRadius: 6,
            border: '1px solid var(--np-line)',
            background: 'var(--np-surface)',
            color: 'var(--np-text)',
            cursor: 'pointer',
          }}
        >
          Close
        </button>
      </div>
    )
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--np-surface)',
          borderRadius: 12,
          border: '1px solid var(--np-line)',
          maxWidth: 600,
          width: '90%',
          maxHeight: '70vh',
          overflowY: 'auto',
          padding: 24,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          <h3 style={{ margin: 0, fontSize: 18, color: 'var(--np-text)' }}>
            Add Widgets
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--np-muted)',
              padding: 4,
            }}
            aria-label="Close widget picker"
          >
            <X size={20} />
          </button>
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          {available.map((widget) => (
            <button
              key={widget.id}
              onClick={() => {
                onAdd(widget.id)
                onClose()
              }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: 4,
                padding: '12px 16px',
                borderRadius: 8,
                border: '1px solid var(--np-line)',
                background: 'var(--np-bg)',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => {
                ;(e.currentTarget as HTMLElement).style.background =
                  'var(--np-hover)'
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLElement).style.background =
                  'var(--np-bg)'
              }}
            >
              <span style={{ fontWeight: 600, color: 'var(--np-text)' }}>
                {widget.title}
              </span>
              <span style={{ fontSize: 13, color: 'var(--np-muted)' }}>
                {widget.description}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main DashboardGrid Component
// ---------------------------------------------------------------------------

export interface DashboardGridProps {
  /** Dashboard type */
  dashboard: DashboardType
  /** User's clinical role for RBAC */
  role: ClinicalRole
  /** User ID for layout ownership */
  userId: string
  /** Saved layout (optional — defaults to createDefaultLayout) */
  layout?: DashboardLayout
  /** Widget data keyed by widgetId */
  widgetData: Record<string, unknown>
  /** Loading state per widget (keyed by widgetId) */
  widgetLoading?: Record<string, boolean>
  /** Error state per widget (keyed by widgetId) */
  widgetErrors?: Record<string, string>
  /** Callback when layout changes (drag, resize, add, remove) */
  onLayoutChange?: (layout: DashboardLayout) => void
  /** Callback to refresh a widget's data */
  onRefreshWidget?: (widgetId: string) => void
  /** Callback to save the current layout */
  onSaveLayout?: () => void
  /** Callback to export the dashboard */
  onExport?: (format: 'pdf' | 'csv') => void
  /** Callback to load a saved view */
  onLoadView?: (layoutId: string) => void
  /** Available saved views */
  savedViews?: DashboardLayout[]
  /** Whether save/export buttons are disabled */
  busy?: boolean
}

export const DashboardGrid: FC<DashboardGridProps> = ({
  dashboard,
  role,
  userId,
  layout: savedLayout,
  widgetData,
  widgetLoading = {},
  widgetErrors = {},
  onLayoutChange,
  onRefreshWidget,
  onSaveLayout,
  onExport,
  onLoadView,
  savedViews = [],
  busy = false,
}) => {
  // --- Layout state ---------------------------------------------------------
  const [layout, setLayout] = useState<DashboardLayout>(
    () => savedLayout ?? createDefaultLayout(dashboard, userId),
  )
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [showPicker, setShowPicker] = useState(false)
  const [showViewMenu, setShowViewMenu] = useState(false)

  // --- RBAC: filter widgets by role ----------------------------------------
  const accessibleWidgets = useMemo(
    () => getAccessibleWidgets(role, dashboard),
    [role, dashboard],
  )

  const accessibleWidgetIds = useMemo(
    () => new Set(accessibleWidgets.map((w) => w.id)),
    [accessibleWidgets],
  )

  // Filter layout to only include widgets the role can see
  const visiblePositions = useMemo(
    () =>
      layout.widgets
        .filter((w) => accessibleWidgetIds.has(w.widgetId))
        .sort((a, b) => a.order - b.order),
    [layout.widgets, accessibleWidgetIds],
  )

  // --- Emit layout changes -------------------------------------------------
  const emitLayoutChange = useCallback(
    (newWidgets: WidgetPosition[]) => {
      const updated: DashboardLayout = {
        ...layout,
        widgets: newWidgets,
        updatedAt: new Date().toISOString(),
      }
      setLayout(updated)
      onLayoutChange?.(updated)
    },
    [layout, onLayoutChange],
  )

  // --- Drag and Drop handlers ----------------------------------------------
  const handleDragStart = useCallback(
    (e: DragEvent<HTMLDivElement>, index: number) => {
      setDragIndex(index)
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', String(index))
    },
    [],
  )

  const handleDragOver = useCallback(
    (e: DragEvent<HTMLDivElement>, index: number) => {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      if (dragIndex !== null && dragIndex !== index) {
        setDragOverIndex(index)
      }
    },
    [dragIndex],
  )

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>, dropIndex: number) => {
      e.preventDefault()
      if (dragIndex === null || dragIndex === dropIndex) {
        setDragIndex(null)
        setDragOverIndex(null)
        return
      }

      const positions = [...visiblePositions]
      const [moved] = positions.splice(dragIndex, 1)
      positions.splice(dropIndex, 0, moved)

      // Reassign order values
      const reordered = positions.map((pos, i) => ({ ...pos, order: i }))

      // Merge back into full layout (preserving hidden widgets)
      const hiddenWidgets = layout.widgets.filter(
        (w) => !accessibleWidgetIds.has(w.widgetId),
      )
      emitLayoutChange([...reordered, ...hiddenWidgets])
      setDragIndex(null)
      setDragOverIndex(null)
    },
    [
      dragIndex,
      visiblePositions,
      layout.widgets,
      accessibleWidgetIds,
      emitLayoutChange,
    ],
  )

  const handleDragEnd = useCallback(() => {
    setDragIndex(null)
    setDragOverIndex(null)
  }, [])

  // --- Resize handler ------------------------------------------------------
  const handleResize = useCallback(
    (index: number, newRowCount: number) => {
      const targetId = visiblePositions[index]?.widgetId
      if (!targetId) return
      const positions = layout.widgets.map((p) =>
        p.widgetId === targetId
          ? { ...p, rowSpan: Math.max(1, Math.min(6, newRowCount)) }
          : p,
      )
      emitLayoutChange(positions)
    },
    [layout.widgets, visiblePositions, emitLayoutChange],
  )

  // --- Add/Remove widget ---------------------------------------------------
  const handleAddWidget = useCallback(
    (widgetId: string) => {
      const def = WIDGET_REGISTRY.find((w) => w.id === widgetId)
      if (!def) return
      const spans = WIDGET_SIZE_SPANS[def.defaultSize]
      const newPos: WidgetPosition = {
        widgetId,
        colSpan: spans.colSpan,
        rowSpan: spans.rowSpan,
        order: layout.widgets.length,
      }
      emitLayoutChange([...layout.widgets, newPos])
    },
    [layout.widgets, emitLayoutChange],
  )

  const handleRemoveWidget = useCallback(
    (widgetId: string) => {
      const filtered = layout.widgets.filter((w) => w.widgetId !== widgetId)
      // Re-order remaining
      const reordered = filtered
        .sort((a, b) => a.order - b.order)
        .map((w, i) => ({ ...w, order: i }))
      emitLayoutChange(reordered)
    },
    [layout.widgets, emitLayoutChange],
  )

  // --- Reset to default ----------------------------------------------------
  const handleReset = useCallback(() => {
    const def = createDefaultLayout(dashboard, userId)
    setLayout(def)
    onLayoutChange?.(def)
  }, [dashboard, userId, onLayoutChange])

  // --- Load saved view -----------------------------------------------------
  const handleLoadView = useCallback(
    (layoutId: string) => {
      const view = savedViews.find((v) => v.id === layoutId)
      if (view) {
        setLayout(view)
        onLayoutChange?.(view)
      }
      setShowViewMenu(false)
    },
    [savedViews, onLayoutChange],
  )

  // --- Grid style ----------------------------------------------------------
  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `repeat(${GRID_COLUMNS}, minmax(0, 1fr))`,
    gap: 16,
    padding: 16,
    minHeight: 200,
  }

  return (
    <div
      style={{
        background: 'var(--np-bg)',
        minHeight: '100%',
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid var(--np-line)',
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <LayoutDashboard size={20} style={{ color: 'var(--np-muted)' }} />
          <h2 style={{ margin: 0, fontSize: 18, color: 'var(--np-text)' }}>
            {DASHBOARD_LABELS[dashboard]}
          </h2>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          {/* Saved views dropdown */}
          {savedViews.length > 0 && (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowViewMenu((v) => !v)}
                disabled={busy}
                style={toolbarButtonStyle}
              >
                <Save size={16} />
                Views
                <ChevronDown size={14} />
              </button>
              {showViewMenu && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: 4,
                    background: 'var(--np-surface)',
                    border: '1px solid var(--np-line)',
                    borderRadius: 8,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    zIndex: 100,
                    minWidth: 180,
                    maxHeight: 300,
                    overflowY: 'auto',
                  }}
                >
                  {savedViews.map((view) => (
                    <button
                      key={view.id}
                      onClick={() => handleLoadView(view.id)}
                      style={{
                        display: 'block',
                        width: '100%',
                        padding: '8px 16px',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--np-text)',
                        textAlign: 'left',
                        fontSize: 14,
                      }}
                      onMouseEnter={(e) => {
                        ;(e.currentTarget as HTMLElement).style.background =
                          'var(--np-hover)'
                      }}
                      onMouseLeave={(e) => {
                        ;(e.currentTarget as HTMLElement).style.background =
                          'none'
                      }}
                    >
                      {view.name}
                      {view.isDefault && (
                        <span
                          style={{
                            color: 'var(--np-muted)',
                            marginLeft: 8,
                            fontSize: 12,
                          }}
                        >
                          (default)
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <button
            onClick={() => setShowPicker(true)}
            disabled={busy}
            style={toolbarButtonStyle}
            aria-label="Add widget"
          >
            <Plus size={16} />
            Add Widget
          </button>

          <button
            onClick={handleReset}
            disabled={busy}
            style={toolbarButtonStyle}
            aria-label="Reset to default layout"
          >
            <RotateCcw size={16} />
            Reset
          </button>

          {onSaveLayout && (
            <button
              onClick={onSaveLayout}
              disabled={busy}
              style={toolbarButtonStyle}
              aria-label="Save current layout"
            >
              <Save size={16} />
              Save
            </button>
          )}

          {onExport && (
            <>
              <button
                onClick={() => onExport('pdf')}
                disabled={busy}
                style={toolbarButtonStyle}
                aria-label="Export as PDF"
              >
                <Download size={16} />
                PDF
              </button>
              <button
                onClick={() => onExport('csv')}
                disabled={busy}
                style={toolbarButtonStyle}
                aria-label="Export as CSV"
              >
                <Download size={16} />
                CSV
              </button>
            </>
          )}
        </div>
      </div>

      {/* Widget Grid */}
      <div style={gridStyle}>
        {visiblePositions.length === 0 && (
          <div
            style={{
              gridColumn: `1 / -1`,
              padding: 48,
              textAlign: 'center',
              color: 'var(--np-muted)',
            }}
          >
            <p style={{ marginBottom: 16 }}>No widgets on this dashboard.</p>
            <button
              onClick={() => setShowPicker(true)}
              style={toolbarButtonStyle}
            >
              <Plus size={16} />
              Add your first widget
            </button>
          </div>
        )}

        {visiblePositions.map((pos, index) => {
          const widget = WIDGET_REGISTRY.find((w) => w.id === pos.widgetId)
          if (!widget) return null

          const isDragging = dragIndex === index
          const isDragOver = dragOverIndex === index && dragIndex !== null
          const data = widgetData[pos.widgetId]
          const loading = widgetLoading[pos.widgetId]
          const error = widgetErrors[pos.widgetId]

          return (
            <div
              key={pos.widgetId}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              style={{
                gridColumn: `span ${Math.min(pos.colSpan, GRID_COLUMNS)}`,
                gridRow: `span ${pos.rowSpan}`,
                opacity: isDragging ? 0.4 : 1,
                position: 'relative',
                border: isDragOver
                  ? '2px dashed var(--np-elevated)'
                  : '1px solid var(--np-line)',
                borderRadius: 8,
                background: 'var(--np-surface)',
                transition: 'opacity 0.15s, border-color 0.15s',
                minHeight: pos.rowSpan * 60,
              }}
            >
              <WidgetContainer
                widget={widget}
                loading={loading}
                error={error}
                onRefresh={
                  onRefreshWidget
                    ? () => onRefreshWidget(pos.widgetId)
                    : undefined
                }
                onRemove={() => handleRemoveWidget(pos.widgetId)}
                isDragging={isDragging}
              >
                {renderWidgetContent(widget, data, loading, error)}
              </WidgetContainer>

              <ResizeHandle
                onResize={(delta) =>
                  handleResize(index, visiblePositions[index].rowSpan + delta)
                }
                currentRows={pos.rowSpan}
              />
            </div>
          )
        })}
      </div>

      {/* Widget Picker Modal */}
      {showPicker && (
        <WidgetPicker
          dashboard={dashboard}
          role={role}
          activeWidgetIds={layout.widgets.map((w) => w.widgetId)}
          onAdd={handleAddWidget}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------

const toolbarButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 12px',
  borderRadius: 6,
  border: '1px solid var(--np-line)',
  background: 'var(--np-surface)',
  color: 'var(--np-text)',
  fontSize: 14,
  cursor: 'pointer',
  transition: 'background 0.15s, opacity 0.15s',
}

export default DashboardGrid
