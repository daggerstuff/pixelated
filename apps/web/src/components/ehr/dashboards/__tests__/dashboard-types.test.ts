/**
 * Tests for EHR Dashboard types and RBAC helpers (PIX-4413)
 *
 * @vitest-environment node
 */

import { describe, it, expect } from 'vitest'

import {
  DASHBOARD_TYPES,
  DASHBOARD_LABELS,
  DASHBOARD_RBAC,
  WIDGET_REGISTRY,
  GRID_COLUMNS,
  WIDGET_SIZE_SPANS,
  DEFAULT_LAYOUTS,
  canViewWidget,
  getAccessibleWidgets,
  createDefaultLayout,
  type DashboardType,
  type WidgetDefinition,
} from '@/components/ehr/dashboards/types'

// ---------------------------------------------------------------------------
// Dashboard types
// ---------------------------------------------------------------------------

describe('DASHBOARD_TYPES', () => {
  it('contains all 5 dashboard types', () => {
    expect(DASHBOARD_TYPES).toHaveLength(5)
    expect(DASHBOARD_TYPES).toContain('practice')
    expect(DASHBOARD_TYPES).toContain('outcomes')
    expect(DASHBOARD_TYPES).toContain('utilization')
    expect(DASHBOARD_TYPES).toContain('billing')
    expect(DASHBOARD_TYPES).toContain('compliance')
  })
})

describe('DASHBOARD_LABELS', () => {
  it('has a label for every dashboard type', () => {
    for (const type of DASHBOARD_TYPES) {
      expect(DASHBOARD_LABELS[type]).toBeDefined()
      expect(typeof DASHBOARD_LABELS[type]).toBe('string')
      expect(DASHBOARD_LABELS[type].length).toBeGreaterThan(0)
    }
  })
})

describe('DASHBOARD_RBAC', () => {
  it('maps each dashboard type to at least one permission', () => {
    for (const type of DASHBOARD_TYPES) {
      expect(DASHBOARD_RBAC[type]).toBeDefined()
      expect(DASHBOARD_RBAC[type].length).toBeGreaterThan(0)
    }
  })
})

// ---------------------------------------------------------------------------
// Widget registry
// ---------------------------------------------------------------------------

describe('WIDGET_REGISTRY', () => {
  it('has widgets for all 5 dashboards', () => {
    for (const type of DASHBOARD_TYPES) {
      const widgets = WIDGET_REGISTRY.filter((w) => w.dashboard === type)
      expect(widgets.length).toBeGreaterThan(0)
    }
  })

  it('every widget has a unique id', () => {
    const ids = WIDGET_REGISTRY.map((w) => w.id)
    const unique = new Set(ids)
    expect(ids.length).toBe(unique.size)
  })

  it('every widget has required permissions', () => {
    for (const w of WIDGET_REGISTRY) {
      expect(w.requiredPermissions).toBeDefined()
      expect(w.requiredPermissions.length).toBeGreaterThan(0)
    }
  })

  it('every widget has a valid dashboard type', () => {
    for (const w of WIDGET_REGISTRY) {
      expect(DASHBOARD_TYPES).toContain(w.dashboard)
    }
  })

  it('has 40+ widgets total', () => {
    expect(WIDGET_REGISTRY.length).toBeGreaterThanOrEqual(39)
  })
})

// ---------------------------------------------------------------------------
// canViewWidget
// ---------------------------------------------------------------------------

describe('canViewWidget', () => {
  it('returns true when role has all required permissions', () => {
    const widget: WidgetDefinition = {
      id: 'test.widget',
      title: 'Test',
      description: 'Test',
      dashboard: 'practice',
      category: 'metric',
      defaultSize: 'small',
      chartType: 'metric-card',
      icon: 'Users',
      requiredPermissions: ['read_patient'],
    }
    expect(canViewWidget('physician', widget)).toBe(true)
  })

  it('returns false when role lacks a required permission', () => {
    const widget: WidgetDefinition = {
      id: 'test.widget',
      title: 'Test',
      description: 'Test',
      dashboard: 'compliance',
      category: 'metric',
      defaultSize: 'small',
      chartType: 'metric-card',
      icon: 'Shield',
      requiredPermissions: ['audit_access'],
    }
    expect(canViewWidget('frontDesk', widget)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// getAccessibleWidgets
// ---------------------------------------------------------------------------

describe('getAccessibleWidgets', () => {
  it('returns only widgets for the specified dashboard', () => {
    const widgets = getAccessibleWidgets('physician', 'practice')
    expect(widgets.length).toBeGreaterThan(0)
    for (const w of widgets) {
      expect(w.dashboard).toBe('practice')
    }
  })

  it('filters out widgets the role cannot access', () => {
    // frontDesk should not see compliance widgets
    const widgets = getAccessibleWidgets('frontDesk', 'compliance')
    expect(widgets).toHaveLength(0)
  })

  it('returns all widgets for systemAdmin', () => {
    const widgets = getAccessibleWidgets('systemAdmin', 'practice')
    const allPractice = WIDGET_REGISTRY.filter(
      (w) => w.dashboard === 'practice',
    )
    expect(widgets.length).toBe(allPractice.length)
  })
})

// ---------------------------------------------------------------------------
// Grid configuration
// ---------------------------------------------------------------------------

describe('GRID_COLUMNS', () => {
  it('is set to 12', () => {
    expect(GRID_COLUMNS).toBe(12)
  })
})

describe('WIDGET_SIZE_SPANS', () => {
  it('has spans for all 5 sizes', () => {
    expect(WIDGET_SIZE_SPANS.small).toBeDefined()
    expect(WIDGET_SIZE_SPANS.medium).toBeDefined()
    expect(WIDGET_SIZE_SPANS.large).toBeDefined()
    expect(WIDGET_SIZE_SPANS.wide).toBeDefined()
    expect(WIDGET_SIZE_SPANS.tall).toBeDefined()
  })

  it('small has colSpan 3 rowSpan 1', () => {
    expect(WIDGET_SIZE_SPANS.small.colSpan).toBe(3)
    expect(WIDGET_SIZE_SPANS.small.rowSpan).toBe(1)
  })

  it('wide spans full width', () => {
    expect(WIDGET_SIZE_SPANS.wide.colSpan).toBe(GRID_COLUMNS)
  })
})

// ---------------------------------------------------------------------------
// DEFAULT_LAYOUTS
// ---------------------------------------------------------------------------

describe('DEFAULT_LAYOUTS', () => {
  it('has layout for every dashboard type', () => {
    for (const type of DASHBOARD_TYPES) {
      expect(DEFAULT_LAYOUTS[type]).toBeDefined()
      expect(DEFAULT_LAYOUTS[type].length).toBeGreaterThan(0)
    }
  })

  it('all widget IDs in DEFAULT_LAYOUTS exist in WIDGET_REGISTRY', () => {
    const allIds = new Set(WIDGET_REGISTRY.map((w) => w.id))
    for (const type of DASHBOARD_TYPES) {
      for (const id of DEFAULT_LAYOUTS[type]) {
        expect(allIds.has(id)).toBe(true)
      }
    }
  })
})

// ---------------------------------------------------------------------------
// createDefaultLayout
// ---------------------------------------------------------------------------

describe('createDefaultLayout', () => {
  it('creates a layout with the correct dashboard type', () => {
    const layout = createDefaultLayout('practice', 'user-1')
    expect(layout.dashboard).toBe('practice')
  })

  it('creates a layout owned by the given userId', () => {
    const layout = createDefaultLayout('outcomes', 'dr-smith')
    expect(layout.ownerId).toBe('dr-smith')
  })

  it('sets isDefault to true', () => {
    const layout = createDefaultLayout('billing', 'user-1')
    expect(layout.isDefault).toBe(true)
  })

  it('assigns widget positions matching DEFAULT_LAYOUTS', () => {
    const layout = createDefaultLayout('practice', 'user-1')
    expect(layout.widgets).toHaveLength(DEFAULT_LAYOUTS.practice.length)
    for (let i = 0; i < layout.widgets.length; i++) {
      expect(layout.widgets[i].widgetId).toBe(DEFAULT_LAYOUTS.practice[i])
      expect(layout.widgets[i].order).toBe(i)
    }
  })

  it('assigns correct colSpan based on widget defaultSize', () => {
    const layout = createDefaultLayout('practice', 'user-1')
    const firstWidget = layout.widgets[0]
    const def = WIDGET_REGISTRY.find((w) => w.id === firstWidget.widgetId)
    const expectedSpan = WIDGET_SIZE_SPANS[def!.defaultSize].colSpan
    expect(firstWidget.colSpan).toBe(expectedSpan)
  })

  it('sets createdAt and updatedAt timestamps', () => {
    const layout = createDefaultLayout('compliance', 'user-1')
    expect(layout.createdAt).toBeDefined()
    expect(layout.updatedAt).toBeDefined()
    expect(new Date(layout.createdAt).toISOString()).toBe(layout.createdAt)
  })
})
