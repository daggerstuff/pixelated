import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card/card'
import { SessionCard } from '../shared/SessionCard'
import { SessionForm } from '../forms/SessionForm'
import { ProgressCharts } from '../charts/ProgressCharts'
import {
  useSessionQuery,
  useUpdateSessionMutation,
  useDeleteSessionMutation,
} from '@/lib/hooks/journal-research'
import { useProgressQuery, useProgressMetricsQuery } from '@/lib/hooks/journal-research'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { useState } from 'react'

export interface SessionDetailProps {
  sessionId: string
  className?: string
}

export function SessionDetail({ sessionId, className }: SessionDetailProps) {
  const [isEditing, setIsEditing] = useState(false)
  const { data: session, isLoading } = useSessionQuery(sessionId)
  const { data: progress } = useProgressQuery(sessionId)
  const { data: metrics } = useProgressMetricsQuery(sessionId, {
    refetchInterval: 5000,
  })
  const updateMutation = useUpdateSessionMutation()
  const deleteMutation = useDeleteSessionMutation()

  if (isLoading) {
    return (
      <div className={cn('text-center py-8', className)}>
        <p className="text-muted-foreground">Loading session...</p>
      </div>
    )
  }

  if (!session) {
    return (
      <div className={cn('text-center py-8', className)}>
        <p className="text-muted-foreground">Session not found</p>
      </div>
    )
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{session.sessionId}</h1>
          <p className="text-muted-foreground mt-1">
            Started {format(session.startDate, 'MMM d, yyyy')} • Current phase:{' '}
            <span className="capitalize">{session.currentPhase}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            {isEditing ? 'Cancel' : 'Edit'}
          </button>
          <button
            onClick={() => {
              if (
                confirm(
                  `Are you sure you want to delete session ${session.sessionId}?`,
                )
              ) {
                deleteMutation.mutate(session.sessionId)
              }
            }}
            className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Session Card */}
      <SessionCard session={session} />

      {/* Edit Form */}
      {isEditing && (
        <Card>
          <CardHeader>
            <CardTitle>Edit Session</CardTitle>
          </CardHeader>
          <CardContent>
            <SessionForm
              session={session}
              onSubmit={(payload) => {
                updateMutation.mutate(
                  { sessionId: session.sessionId, payload },
                  {
                    onSuccess: () => {
                      setIsEditing(false)
                    },
                  },
                )
              }}
            />
          </CardContent>
        </Card>
      )}

      {/* Progress Charts */}
      {progress && (
        <Card>
          <CardHeader>
            <CardTitle>Progress Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <ProgressCharts progress={progress} metrics={metrics ?? undefined} />
          </CardContent>
        </Card>
      )}

      {/* Session Details */}
      <Card>
        <CardHeader>
          <CardTitle>Session Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Session ID
              </p>
              <p className="mt-1">{session.sessionId}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Start Date
              </p>
              <p className="mt-1">{format(session.startDate, 'PPpp')}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Current Phase
              </p>
              <p className="mt-1 capitalize">{session.currentPhase}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Target Sources
              </p>
              <p className="mt-1">{session.targetSources.join(', ')}</p>
            </div>
            <div className="md:col-span-2">
              <p className="text-sm font-medium text-muted-foreground">
                Search Keywords
              </p>
              <div className="mt-1 space-y-1">
                {Object.entries(session.searchKeywords).map(([category, keywords]) => (
                  <div key={category}>
                    <span className="font-medium">{category}:</span>{' '}
                    {keywords.join(', ')}
                  </div>
                ))}
              </div>
            </div>
            {session.progressMetrics && (
              <div className="md:col-span-2">
                <p className="text-sm font-medium text-muted-foreground">
                  Progress Metrics
                </p>
                <div className="mt-2 grid grid-cols-2 gap-4 md:grid-cols-4">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Sources Identified
                    </p>
                    <p className="text-lg font-semibold">
                      {session.progressMetrics.sources_identified ?? 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Datasets Evaluated
                    </p>
                    <p className="text-lg font-semibold">
                      {session.progressMetrics.datasets_evaluated ?? 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Datasets Acquired
                    </p>
                    <p className="text-lg font-semibold">
                      {session.progressMetrics.datasets_acquired ?? 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Integration Plans
                    </p>
                    <p className="text-lg font-semibold">
                      {session.progressMetrics.integration_plans_created ?? 0}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

