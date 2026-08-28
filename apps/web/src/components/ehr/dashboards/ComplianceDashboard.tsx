/**
 * @file dashboards/ComplianceDashboard.tsx
 * @description Compliance & Audit dashboard — audit events, access
 *   violations, break-glass events, PHI exports, consent coverage,
 *   training completion, violation trends, audit by category.
 * @module ehr/dashboards
 */

import React, { type FC } from 'react'

import { DashboardGrid, type DashboardGridProps } from './DashboardGrid'

export type ComplianceDashboardProps = Omit<DashboardGridProps, 'dashboard'>

/**
 * Compliance & Audit dashboard wrapper.
 */
const ComplianceDashboard: FC<ComplianceDashboardProps> = (props) => {
  return <DashboardGrid dashboard="compliance" {...props} />
}

export default ComplianceDashboard
