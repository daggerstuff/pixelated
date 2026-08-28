/**
 * @file dashboards/index.ts
 * @description Barrel exports for EHR customizable dashboards (PIX-4413).
 * @module ehr/dashboards
 */

export * from './types'
export { DashboardGrid } from './DashboardGrid'
export type { DashboardGridProps, WidgetData } from './DashboardGrid'
export * from './widgets'
export { default as PracticeDashboard } from './PracticeDashboard'
export { default as OutcomesDashboard } from './OutcomesDashboard'
export { default as UtilizationDashboard } from './UtilizationDashboard'
export { default as BillingDashboard } from './BillingDashboard'
export { default as ComplianceDashboard } from './ComplianceDashboard'
