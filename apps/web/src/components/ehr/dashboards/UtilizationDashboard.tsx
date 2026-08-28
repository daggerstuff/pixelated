/**
 * @file dashboards/UtilizationDashboard.tsx
 * @description Utilization dashboard — total encounters, telehealth rate,
 *   avg visit duration, room utilization, department breakdown.
 * @module ehr/dashboards
 */

import React, { type FC } from 'react'

import { DashboardGrid, type DashboardGridProps } from './DashboardGrid'

export type UtilizationDashboardProps = Omit<DashboardGridProps, 'dashboard'>

/**
 * Utilization dashboard wrapper.
 */
const UtilizationDashboard: FC<UtilizationDashboardProps> = (props) => {
  return <DashboardGrid dashboard="utilization" {...props} />
}

export default UtilizationDashboard
