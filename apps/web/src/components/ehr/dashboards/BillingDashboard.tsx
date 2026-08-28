/**
 * @file dashboards/BillingDashboard.tsx
 * @description Billing & Claims dashboard — total charges, collections,
 *   outstanding A/R, days in A/R, denial rate, clean claim rate, revenue
 *   trend, claims by status, top payers.
 * @module ehr/dashboards
 */

import React, { type FC } from 'react'

import { DashboardGrid, type DashboardGridProps } from './DashboardGrid'

export type BillingDashboardProps = Omit<DashboardGridProps, 'dashboard'>

/**
 * Billing & Claims dashboard wrapper.
 */
const BillingDashboard: FC<BillingDashboardProps> = (props) => {
  return <DashboardGrid dashboard="billing" {...props} />
}

export default BillingDashboard
