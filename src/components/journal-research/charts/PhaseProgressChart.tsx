import { useMemo } from 'react'
import type { Progress, ProgressMetrics } from '@/lib/api/journal-research/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card/card'
import ChartComponent from '@/components/analytics/ChartComponent'
import { cn } from '@/lib/utils'

export interface PhaseProgressChartProps {
  progress: Progress
  metrics?: ProgressMetrics
  className?: string
}

export function PhaseProgressChart({
  progress,
  metrics: _metrics,
  className,
}: PhaseProgressChartProps) {
  const phaseData = useMemo(() => {
    const phases = [
      { name: 'Discovery', key: 'discovery' },
      { name: 'Evaluation', key: 'evaluation' },
      { name: 'Acquisition', key: 'acquisition' },
      { name: 'Integration', key: 'integration' },
      { name: 'Reporting', key: 'reporting' },
    ]

    return phases.map((phase) => {
      let progressValue = 0
      const isCurrentPhase = progress.currentPhase === phase.key

      if (isCurrentPhase) {
        // Current phase shows overall progress
        progressValue = progress.progressPercentage
      } else {
        // Completed phases show 100%, future phases show 0%
        const phaseOrder = ['discovery', 'evaluation', 'acquisition', 'integration', 'reporting']
        const currentIndex = phaseOrder.indexOf(progress.currentPhase)
        const phaseIndex = phaseOrder.indexOf(phase.key)

        if (phaseIndex < currentIndex) {
          progressValue = 100
        } else if (phaseIndex === currentIndex) {
          progressValue = progress.progressPercentage
        } else {
          progressValue = 0
        }
      }

      return {
        phase: phase.name,
        progress: progressValue,
        isCurrent: isCurrentPhase,
      }
    })
  }, [progress])

  const chartData = useMemo(() => {
    return {
      labels: phaseData.map((p) => p.phase),
      datasets: [
        {
          label: 'Progress %',
          data: phaseData.map((p) => p.progress),
          backgroundColor: phaseData.map((p) =>
            p.isCurrent
              ? 'rgba(59, 130, 246, 0.7)'
              : p.progress === 100
                ? 'rgba(34, 197, 94, 0.5)'
                : 'rgba(156, 163, 175, 0.3)',
          ),
          borderColor: phaseData.map((p) =>
            p.isCurrent
              ? 'rgba(59, 130, 246, 1)'
              : p.progress === 100
                ? 'rgba(34, 197, 94, 1)'
                : 'rgba(156, 163, 175, 0.5)',
          ),
          borderWidth: 2,
        },
      ],
    }
  }, [phaseData])

  const pieData = useMemo(() => {
    const completedPhases = phaseData.filter((p) => p.progress === 100).length
    const inProgressPhases = phaseData.filter((p) => p.isCurrent).length
    const pendingPhases = phaseData.filter(
      (p) => p.progress === 0 && !p.isCurrent,
    ).length

    return {
      labels: ['Completed', 'In Progress', 'Pending'],
      datasets: [
        {
          data: [completedPhases, inProgressPhases, pendingPhases],
          backgroundColor: [
            'rgba(34, 197, 94, 0.7)',
            'rgba(59, 130, 246, 0.7)',
            'rgba(156, 163, 175, 0.7)',
          ],
          borderColor: [
            'rgba(34, 197, 94, 1)',
            'rgba(59, 130, 246, 1)',
            'rgba(156, 163, 175, 1)',
          ],
          borderWidth: 2,
        },
      ],
    }
  }, [phaseData])

  return (
    <div className={cn('grid gap-4 md:grid-cols-2', className)}>
      <Card>
        <CardHeader>
          <CardTitle>Phase Progress Bar</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartComponent
            type="bar"
            data={chartData}
            title="Progress by Phase"
            options={{
              indexAxis: 'y' as const,
              scales: {
                x: {
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

      <Card>
        <CardHeader>
          <CardTitle>Phase Status</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartComponent
            type="pie"
            data={pieData}
            title="Phase Status Distribution"
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  position: 'bottom' as const,
                },
              },
            }}
          />
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Phase Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {phaseData.map((phase) => (
              <div key={phase.phase} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">
                    {phase.phase}
                    {phase.isCurrent && (
                      <span className="ml-2 text-xs text-primary">
                        (Current)
                      </span>
                    )}
                  </span>
                  <span className="text-muted-foreground">
                    {Math.round(phase.progress)}%
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full transition-all ${phase.isCurrent
                        ? 'bg-primary'
                        : phase.progress === 100
                          ? 'bg-green-500'
                          : 'bg-gray-300'
                      }`}
                    style={{ width: `${phase.progress}%` }}
                    role="progressbar"
                    aria-valuenow={phase.progress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

