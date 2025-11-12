import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card/card'
import { ProgressCharts } from '../charts/ProgressCharts'
import { ProgressBar } from '../shared/ProgressBar'
import {
  useProgressQuery,
  useProgressMetricsQuery,
} from '@/lib/hooks/journal-research'
import { cn } from '@/lib/utils'
import { useMemo } from 'react'

export interface ProgressTrackerProps {
  sessionId: string | null
  className?: string
}

export function ProgressTracker({ sessionId, className }: ProgressTrackerProps) {
  const { data: progress, isLoading: progressLoading } = useProgressQuery(
    sessionId,
  )
  const { data: metrics, isLoading: metricsLoading } = useProgressMetricsQuery(
    sessionId,
    {
      refetchInterval: 5000,
    },
  )

  const isLoading = progressLoading || metricsLoading

  const progressAgainstTargets = useMemo(() => {
    if (!progress || !metrics) return null

    const targets = progress.weeklyTargets
    const currentMetrics = {
      sourcesIdentified: metrics.sourcesIdentified,
      datasetsEvaluated: metrics.datasetsEvaluated,
      datasetsAcquired: metrics.datasetsAcquired,
      integrationPlansCreated: metrics.integrationPlansCreated,
    }

    return {
      sourcesIdentified: {
        current: currentMetrics.sourcesIdentified,
        target: targets.sources_identified ?? 0,
        percentage:
          targets.sources_identified > 0
            ? Math.min(
                100,
                (currentMetrics.sourcesIdentified / targets.sources_identified) *
                  100,
              )
            : 0,
      },
      datasetsEvaluated: {
        current: currentMetrics.datasetsEvaluated,
        target: targets.datasets_evaluated ?? 0,
        percentage:
          targets.datasets_evaluated > 0
            ? Math.min(
                100,
                (currentMetrics.datasetsEvaluated / targets.datasets_evaluated) *
                  100,
              )
            : 0,
      },
      datasetsAcquired: {
        current: currentMetrics.datasetsAcquired,
        target: targets.datasets_acquired ?? 0,
        percentage:
          targets.datasets_acquired > 0
            ? Math.min(
                100,
                (currentMetrics.datasetsAcquired / targets.datasets_acquired) *
                  100,
              )
            : 0,
      },
      integrationPlansCreated: {
        current: currentMetrics.integrationPlansCreated,
        target: targets.integration_plans_created ?? 0,
        percentage:
          targets.integration_plans_created > 0
            ? Math.min(
                100,
                (currentMetrics.integrationPlansCreated /
                  targets.integration_plans_created) *
                  100,
              )
            : 0,
      },
    }
  }, [progress, metrics])

  if (!sessionId) {
    return (
      <div className={cn('text-center py-8', className)}>
        <p className="text-muted-foreground">
          Please select a session to track progress
        </p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className={cn('text-center py-8', className)}>
        <p className="text-muted-foreground">Loading progress...</p>
      </div>
    )
  }

  if (!progress) {
    return (
      <div className={cn('text-center py-8', className)}>
        <p className="text-muted-foreground">No progress data available</p>
      </div>
    )
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Progress Tracker</h1>
        <p className="text-muted-foreground mt-1">
          Monitor progress against targets in real-time
        </p>
      </div>

      {/* Overall Progress */}
      <Card>
        <CardHeader>
          <CardTitle>Overall Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Session Progress</span>
                <span className="font-medium">
                  {progress.progressPercentage.toFixed(1)}%
                </span>
              </div>
              <ProgressBar value={progress.progressPercentage} />
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-muted-foreground">
                Current Phase
              </p>
              <p className="capitalize text-lg font-semibold">
                {progress.currentPhase}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Progress Charts */}
      {metrics && (
        <Card>
          <CardHeader>
            <CardTitle>Progress Visualizations</CardTitle>
          </CardHeader>
          <CardContent>
            <ProgressCharts progress={progress} metrics={metrics} />
          </CardContent>
        </Card>
      )}

      {/* Progress Against Targets */}
      {progressAgainstTargets && (
        <Card>
          <CardHeader>
            <CardTitle>Progress Against Targets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-medium">Sources Identified</span>
                  <span className="text-muted-foreground">
                    {progressAgainstTargets.sourcesIdentified.current} /{' '}
                    {progressAgainstTargets.sourcesIdentified.target}
                  </span>
                </div>
                <ProgressBar
                  value={progressAgainstTargets.sourcesIdentified.percentage}
                />
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-medium">Datasets Evaluated</span>
                  <span className="text-muted-foreground">
                    {progressAgainstTargets.datasetsEvaluated.current} /{' '}
                    {progressAgainstTargets.datasetsEvaluated.target}
                  </span>
                </div>
                <ProgressBar
                  value={progressAgainstTargets.datasetsEvaluated.percentage}
                />
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-medium">Datasets Acquired</span>
                  <span className="text-muted-foreground">
                    {progressAgainstTargets.datasetsAcquired.current} /{' '}
                    {progressAgainstTargets.datasetsAcquired.target}
                  </span>
                </div>
                <ProgressBar
                  value={progressAgainstTargets.datasetsAcquired.percentage}
                />
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-medium">Integration Plans Created</span>
                  <span className="text-muted-foreground">
                    {progressAgainstTargets.integrationPlansCreated.current} /{' '}
                    {progressAgainstTargets.integrationPlansCreated.target}
                  </span>
                </div>
                <ProgressBar
                  value={
                    progressAgainstTargets.integrationPlansCreated.percentage
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Current Metrics */}
      {metrics && (
        <Card>
          <CardHeader>
            <CardTitle>Current Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Sources Identified
                </p>
                <p className="mt-1 text-2xl font-bold">
                  {metrics.sourcesIdentified}
                </p>
                {metrics.lastUpdated && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Updated {metrics.lastUpdated.toLocaleString()}
                  </p>
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Datasets Evaluated
                </p>
                <p className="mt-1 text-2xl font-bold">
                  {metrics.datasetsEvaluated}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Datasets Acquired
                </p>
                <p className="mt-1 text-2xl font-bold">
                  {metrics.datasetsAcquired}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Integration Plans
                </p>
                <p className="mt-1 text-2xl font-bold">
                  {metrics.integrationPlansCreated}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

