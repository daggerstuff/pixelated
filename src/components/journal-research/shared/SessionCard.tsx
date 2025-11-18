import type { Session } from '@/lib/api/journal-research/types'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card/card'
import { ProgressBar } from './ProgressBar'
import { format } from 'date-fns'

export interface SessionCardProps {
  session: Session
  onClick?: () => void
  className?: string
}

export function SessionCard({ session, onClick, className }: SessionCardProps) {
  const progressPercentage =
    session.progressMetrics?.progress_percentage ?? 0

  const phaseColors: Record<string, string> = {
    discovery: 'bg-blue-500',
    evaluation: 'bg-yellow-500',
    acquisition: 'bg-green-500',
    integration: 'bg-purple-500',
    reporting: 'bg-gray-500',
  }

  const phaseColor = phaseColors[session.currentPhase] ?? 'bg-gray-500'

  return (
    <Card
      className={`cursor-pointer transition-shadow hover:shadow-lg ${className ?? ''}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick?.()
        }
      }}
    >
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg font-semibold">
              {session.sessionId}
            </CardTitle>
            <CardDescription className="mt-1">
              Started {format(session.startDate, 'MMM d, yyyy')}
            </CardDescription>
          </div>
          <div
            className={`h-3 w-3 rounded-full ${phaseColor}`}
            aria-label={`Current phase: ${session.currentPhase}`}
            title={`Current phase: ${session.currentPhase}`}
          />
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          <div>
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{progressPercentage}%</span>
            </div>
            <ProgressBar value={progressPercentage} />
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Phase:</span>
              <span className="ml-2 font-medium capitalize">
                {session.currentPhase}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Sources:</span>
              <span className="ml-2 font-medium">
                {session.targetSources.length}
              </span>
            </div>
          </div>

          {session.progressMetrics && (
            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <div>
                Identified:{' '}
                <span className="font-medium text-foreground">
                  {session.progressMetrics.sources_identified ?? 0}
                </span>
              </div>
              <div>
                Evaluated:{' '}
                <span className="font-medium text-foreground">
                  {session.progressMetrics.datasets_evaluated ?? 0}
                </span>
              </div>
              <div>
                Acquired:{' '}
                <span className="font-medium text-foreground">
                  {session.progressMetrics.datasets_acquired ?? 0}
                </span>
              </div>
              <div>
                Integrated:{' '}
                <span className="font-medium text-foreground">
                  {session.progressMetrics.integration_plans_created ?? 0}
                </span>
              </div>
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter className="text-xs text-muted-foreground">
        {session.targetSources.join(', ')}
      </CardFooter>
    </Card>
  )
}

