import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card/card'
import { SessionList } from '../lists/SessionList'
import { ProgressCharts } from '../charts/ProgressCharts'
import { SessionCard } from '../shared/SessionCard'
import {
  useSessionListQuery,
  useSessionQuery,
} from '@/lib/hooks/journal-research'
import { useJournalSessionStore } from '@/lib/stores/journal-research'
import { useProgressQuery, useProgressMetricsQuery } from '@/lib/hooks/journal-research'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

export interface DashboardProps {
  className?: string
}

export function Dashboard({ className }: DashboardProps) {
  const selectedSessionId = useJournalSessionStore(
    (state) => state.selectedSessionId,
  )

  const { data: sessions, isLoading: sessionsLoading } = useSessionListQuery({
    page: 1,
    pageSize: 5,
  })

  const { data: selectedSession } = useSessionQuery(selectedSessionId)
  const { data: progress } = useProgressQuery(selectedSessionId, {
    enabled: Boolean(selectedSessionId),
  })
  const { data: metrics } = useProgressMetricsQuery(selectedSessionId, {
    enabled: Boolean(selectedSessionId),
    refetchInterval: 5000,
  })

  const recentSessions = useMemo(() => {
    if (!sessions) return []
    return sessions.items
      .sort((a, b) => b.startDate.getTime() - a.startDate.getTime())
      .slice(0, 5)
  }, [sessions])

  const quickActions = [
    {
      label: 'New Session',
      action: () => {
        useJournalSessionStore.getState().openCreateDrawer()
      },
    },
    {
      label: 'View All Sessions',
      action: () => {
        // Navigate to sessions page
      },
    },
  ]

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Journal Research Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Monitor and manage your research sessions
          </p>
        </div>
        <div className="flex gap-2">
          {quickActions.map((action) => (
            <button
              key={action.label}
              onClick={action.action}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>

      {/* Selected Session Progress */}
      {selectedSession && progress && (
        <Card>
          <CardHeader>
            <CardTitle>Current Session Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <SessionCard session={selectedSession} />
              {metrics && (
                <ProgressCharts progress={progress} metrics={metrics} />
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Sessions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Sessions</CardTitle>
        </CardHeader>
        <CardContent>
          {sessionsLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading sessions...
            </div>
          ) : recentSessions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No sessions yet. Create your first session to get started.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {recentSessions.map((session) => (
                <SessionCard
                  key={session.sessionId}
                  session={session}
                  onClick={() => {
                    useJournalSessionStore
                      .getState()
                      .setSelectedSessionId(session.sessionId)
                  }}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* All Sessions List */}
      <Card>
        <CardHeader>
          <CardTitle>All Sessions</CardTitle>
        </CardHeader>
        <CardContent>
          <SessionList
            sessions={sessions ?? { items: [], total: 0, page: 1, pageSize: 10, totalPages: 0 }}
            isLoading={sessionsLoading}
            onSessionClick={(session) => {
              useJournalSessionStore
                .getState()
                .setSelectedSessionId(session.sessionId)
            }}
          />
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentSessions.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                No recent activity
              </div>
            ) : (
              recentSessions.map((session) => (
                <div
                  key={session.sessionId}
                  className="flex items-center justify-between border-b pb-3 last:border-0"
                >
                  <div>
                    <p className="font-medium">{session.sessionId}</p>
                    <p className="text-sm text-muted-foreground">
                      Started {format(session.startDate, 'MMM d, yyyy')} •{' '}
                      {session.currentPhase}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      {session.progressMetrics?.progress_percentage ?? 0}%
                    </p>
                    <p className="text-xs text-muted-foreground">Progress</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

