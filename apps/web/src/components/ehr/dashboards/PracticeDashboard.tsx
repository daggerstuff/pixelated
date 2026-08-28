/**
 * @file dashboards/PracticeDashboard.tsx
 * @description Practice Overview dashboard — total patients, appointments,
 *   no-show rate, open encounters, pending tasks, avg wait time.
 * @module ehr/dashboards
 */

import React, { type FC } from 'react'

import type { ClinicalRole } from '@/lib/ehr-native/auth'

import { DashboardGrid, type DashboardGridProps } from './DashboardGrid'
import type { DashboardType } from './types'

export interface PracticeDashboardProps extends Omit<
  DashboardGridProps,
  'dashboard'
> {
  /** Allows overriding dashboard type (defaults to 'practice') */
  dashboardType?: DashboardType
}

/**
 * Practice Overview dashboard wrapper.
 * Renders the DashboardGrid with the 'practice' type pre-selected.
 */
const PracticeDashboard: FC<PracticeDashboardProps> = ({
  dashboardType = 'practice',
  ...props
}) => {
  return <DashboardGrid dashboard={dashboardType} {...props} />
}

export default PracticeDashboard
