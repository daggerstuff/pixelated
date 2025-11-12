import { useMemo } from 'react'
import type { Progress, ProgressMetrics } from '@/lib/api/journal-research/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card/card'
import { ChartComponent } from '@/components/analytics/ChartComponent'
import { cn } from '@/lib/utils'

export interface ProgressChartsProps {
  progress: Progress
  metrics?: ProgressMetrics
  className?: string
}

export function ProgressCharts({
  progress,
  metrics,
  className,
}: ProgressChartsProps) {
  const progressData = useMemo(() => {
    const phases = ['discovery', 'evaluation', 'acquisition', 'integration']
    const phaseProgress = phases.map((phase) => {
      // Calculate progress for each phase based on metrics
      let phaseValue = 0
      if (metrics) {
        switch (phase) {
          case 'discovery':
            phaseValue =
              metrics.sourcesIdentified > 0
                ? Math.min(100, (metrics.sourcesIdentified / 10) * 100)
                : 0
            break
          case 'evaluation':
            phaseValue =
              metrics.datasetsEvaluated > 0
                ? Math.min(100, (metrics.datasetsEvaluated / 10) * 100)
                : 0
            break
          case 'acquisition':
            phaseValue =
              metrics.datasetsAcquired > 0
                ? Math.min(100, (metrics.datasetsAcquired / 10) * 100)
                : 0
            break
          case 'integration':
            phaseValue =
              metrics.integrationPlansCreated > 0
                ? Math.min(100, (metrics.integrationPlansCreated / 5) * 100)
                : 0
            break
        }
      }
      return {
        phase: phase.charAt(0).toUpperCase() + phase.slice(1),
        progress: phaseValue,
      }
    })

    return {
      labels: phaseProgress.map((p) => p.phase),
      datasets: [
        {
          label: 'Progress %',
          data: phaseProgress.map((p) => p.progress),
          backgroundColor: [
            'rgba(59, 130, 246, 0.5)',
            'rgba(234, 179, 8, 0.5)',
            'rgba(34, 197, 94, 0.5)',
            'rgba(168, 85, 247, 0.5)',
          ],
          borderColor: [
            'rgba(59, 130, 246, 1)',
            'rgba(234, 179, 8, 1)',
            'rgba(34, 197, 94, 1)',
            'rgba(168, 85, 247, 1)',
          ],
          borderWidth: 2,
        },
      ],
    }
  }, [metrics])

  const overallProgressData = useMemo(() => {
    return {
      labels: ['Overall Progress'],
      datasets: [
        {
          label: 'Progress',
          data: [progress.progressPercentage],
          backgroundColor: 'rgba(59, 130, 246, 0.5)',
          borderColor: 'rgba(59, 130, 246, 1)',
          borderWidth: 2,
        },
      ],
    }
  }, [progress.progressPercentage])

  const metricsData = useMemo(() => {
    if (!metrics) return null

    return {
      labels: [
        'Sources Identified',
        'Datasets Evaluated',
        'Datasets Acquired',
        'Integration Plans',
      ],
      datasets: [
        {
          label: 'Count',
          data: [
            metrics.sourcesIdentified,
            metrics.datasetsEvaluated,
            metrics.datasetsAcquired,
            metrics.integrationPlansCreated,
          ],
          backgroundColor: [
            'rgba(59, 130, 246, 0.5)',
            'rgba(234, 179, 8, 0.5)',
            'rgba(34, 197, 94, 0.5)',
            'rgba(168, 85, 247, 0.5)',
          ],
          borderColor: [
            'rgba(59, 130, 246, 1)',
            'rgba(234, 179, 8, 1)',
            'rgba(34, 197, 94, 1)',
            'rgba(168, 85, 247, 1)',
          ],
          borderWidth: 2,
        },
      ],
    }
  }, [metrics])

  return (
    <div className={cn('grid gap-4 md:grid-cols-2', className)}>
      <Card>
        <CardHeader>
          <CardTitle>Overall Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartComponent
            type="bar"
            data={overallProgressData}
            title="Overall Progress"
            options={{
              scales: {
                y: {
                  beginAtZero: true,
                  max: 100,
                  ticks: {
                    callback: (value) => `${value}%`,
                  },
                },
              },
            }}
          />
        </CardContent>
      </Card>

      {metricsData && (
        <Card>
          <CardHeader>
            <CardTitle>Progress Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartComponent
              type="bar"
              data={metricsData}
              title="Metrics Overview"
              options={{
                scales: {
                  y: {
                    beginAtZero: true,
                  },
                },
              }}
            />
          </CardContent>
        </Card>
      )}

      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Phase Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartComponent
            type="bar"
            data={progressData}
            title="Progress by Phase"
            options={{
              scales: {
                y: {
                  beginAtZero: true,
                  max: 100,
                  ticks: {
                    callback: (value) => `${value}%`,
                  },
                },
              },
            }}
          />
        </CardContent>
      </Card>
    </div>
  )
}

