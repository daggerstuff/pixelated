import { useMemo } from 'react'
import type { ProgressMetrics } from '@/lib/api/journal-research/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card/card'
import ChartComponent from '@/components/analytics/ChartComponent'
import { cn } from '@/lib/utils'

export interface MetricsChartProps {
  metrics: ProgressMetrics[]
  timeRange?: 'week' | 'month' | 'all'
  className?: string
}

export function MetricsChart({
  metrics,
  timeRange = 'all',
  className,
}: MetricsChartProps) {
  const chartData = useMemo(() => {
                        // Filter metrics based on time range
                        const now = new Date()
                        let filteredMetrics = metrics
                    
                        if (timeRange === 'week') {
                          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
                          filteredMetrics = metrics.filter(
                            (m) => m.lastUpdated && m.lastUpdated >= weekAgo,
                          )
                        } else if (timeRange === 'month') {
                          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
                          filteredMetrics = metrics.filter(
                            (m) => m.lastUpdated && m.lastUpdated >= monthAgo,
                          )
                        }
                    
                        // Sort by date
                        filteredMetrics.sort((a, b) => {
                          const dateA = a.lastUpdated ?? new Date(0)
                          const dateB = b.lastUpdated ?? new Date(0)
                          return dateA.getTime() - dateB.getTime()
                        })
                    
                        const labels = filteredMetrics.map((m, index) => {
                          if (m.lastUpdated) {
                            return m.lastUpdated.toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })
                          }
                          return `Point ${index + 1}`
                        })
                    
                        return {
                          labels,
                          datasets: [
                            {
                              label: 'Sources Identified',
                              data: filteredMetrics.map((m) => m.sourcesIdentified),
                              borderColor: 'rgba(59, 130, 246, 1)',
                              backgroundColor: 'rgba(59, 130, 246, 0.1)',
                              tension: 0.4,
                              fill: true,
                            },
                            {
                              label: 'Datasets Evaluated',
                              data: filteredMetrics.map((m) => m.datasetsEvaluated),
                              borderColor: 'rgba(234, 179, 8, 1)',
                              backgroundColor: 'rgba(234, 179, 8, 0.1)',
                              tension: 0.4,
                              fill: true,
                            },
                            {
                              label: 'Datasets Acquired',
                              data: filteredMetrics.map((m) => m.datasetsAcquired),
                              borderColor: 'rgba(34, 197, 94, 1)',
                              backgroundColor: 'rgba(34, 197, 94, 0.1)',
                              tension: 0.4,
                              fill: true,
                            },
                            {
                              label: 'Integration Plans',
                              data: filteredMetrics.map((m) => m.integrationPlansCreated),
                              borderColor: 'rgba(168, 85, 247, 1)',
                              backgroundColor: 'rgba(168, 85, 247, 0.1)',
                              tension: 0.4,
                              fill: true,
                            },
                          ],
                        }
                      }, [metrics, timeRange]).slice()

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Metrics Over Time</CardTitle>
          <select
            value={timeRange}
            onChange={(e) => {
              // This would need to be handled by parent component
              // For now, just a visual indicator
            }}
            className="rounded-md border border-input bg-background px-2 py-1 text-sm"
            disabled
          >
            <option value="week">Last Week</option>
            <option value="month">Last Month</option>
            <option value="all">All Time</option>
          </select>
        </div>
      </CardHeader>
      <CardContent>
        <ChartComponent
          type="line"
          data={chartData}
          title="Metrics Over Time"
          options={{
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              y: {
                beginAtZero: true,
              },
            },
            plugins: {
              legend: {
                position: 'top' as const,
              },
            },
          }}
        />
      </CardContent>
    </Card>
  )
}

