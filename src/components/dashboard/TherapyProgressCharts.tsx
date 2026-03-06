/**
 * Therapy Progress Charts Component
 * Displays therapist analytics and progress visualization
 */

import React from 'react'

import type { TherapistAnalyticsChartData } from '@/types/analytics'
import { AnalyticsCharts } from './AnalyticsCharts'

interface TherapyProgressChartsProps {
  data: TherapistAnalyticsChartData | null
}

export default function TherapyProgressCharts({
  data,
}: TherapyProgressChartsProps) {
  if (!data) {
    return (
      <div className='text-muted-foreground flex items-center justify-center p-8'>
        No therapy progress data available
      </div>
    )
  }

  // Use AnalyticsCharts for visualization - it handles data internally via hook
  return (
    <div className='therapy-progress-charts'>
      <AnalyticsCharts />
    </div>
  )
}
