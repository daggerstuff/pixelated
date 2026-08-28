/**
 * @file dashboards/OutcomesDashboard.tsx
 * @description Clinical Outcomes dashboard — PHQ-9, GAD-7, OQ-45 trends,
 *   improvement/deterioration metrics, total assessments.
 * @module ehr/dashboards
 */

import React, { type FC } from 'react'

import { DashboardGrid, type DashboardGridProps } from './DashboardGrid'

export type OutcomesDashboardProps = Omit<DashboardGridProps, 'dashboard'>

/**
 * Clinical Outcomes dashboard wrapper.
 */
const OutcomesDashboard: FC<OutcomesDashboardProps> = (props) => {
  return <DashboardGrid dashboard="outcomes" {...props} />
}

export default OutcomesDashboard
