/**
 * EHR UI Components — barrel export
 *
 * React 19 components for the EHR module.
 * Organized by clinical domain area.
 *
 * @see docs/plans/ehr-module-build-plan.md
 */

// Responsive layout shell (F1.13)
export {
  EHRResponsiveShell,
  type EHRResponsiveShellProps,
  type EHRViewCategory,
  type EHRRNavItem,
} from './EHRResponsiveShell'
export { EHRMobileLayout } from './EHRMobileLayout'
export { EHRDesktopLayout } from './EHRDesktopLayout'

// Submodule exports
export * from './portal'
export * from './telehealth'
export * from './supervisor/risk-queue'
export * from './dashboards'
export * from './integrations'
