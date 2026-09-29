import { format } from 'date-fns'

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card/card'
import type { Evaluation } from '@/lib/api/journal-research/types'

export interface EvaluationCardProps {
  evaluation: Evaluation
  onClick?: () => void
  className?: string
}

export function EvaluationCard({
  evaluation,
  onClick,
  className,
}: EvaluationCardProps) {
  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-foreground font-semibold'
    if (score >= 6) return 'text-foreground font-medium'
    return 'text-muted-foreground'
  }

  const getScoreBarColor = (score: number) => {
    if (score >= 8) return 'bg-primary'
    if (score >= 6) return 'bg-foreground'
    return 'bg-muted-foreground'
  }

  const getPriorityColor = (tier: string) => {
    const colors: Record<string, string> = {
      high: 'bg-primary text-primary-foreground font-semibold',
      medium: 'bg-secondary border border-ring text-foreground font-medium',
      low: 'bg-secondary border border-border text-muted-foreground',
    }
    return (
      colors[tier.toLowerCase()] ??
      'bg-secondary border border-border text-muted-foreground'
    )
  }

  const metrics = [
    {
      label: 'Therapeutic Relevance',
      value: evaluation.therapeuticRelevance,
    },
    {
      label: 'Data Structure Quality',
      value: evaluation.dataStructureQuality,
    },
    {
      label: 'Training Integration',
      value: evaluation.trainingIntegration,
    },
    {
      label: 'Ethical Accessibility',
      value: evaluation.ethicalAccessibility,
    },
  ]

  return (
    <Card
      className={`transition-colors hover:border-ring ${onClick ? 'cursor-pointer' : ''} ${className ?? ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClick()
              }
            }
          : undefined
      }
    >
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg font-semibold">
              Evaluation {evaluation.evaluationId.slice(0, 8)}
            </CardTitle>
            <CardDescription className="mt-1">
              Source: {evaluation.sourceId.slice(0, 8)}...
            </CardDescription>
          </div>
          <span
            className={`rounded-none px-2 py-1 text-xs font-medium capitalize ${getPriorityColor(evaluation.priorityTier)}`}
          >
            {evaluation.priorityTier}
          </span>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Overall Score</span>
            <span
              className={`text-2xl font-bold ${getScoreColor(evaluation.overallScore)}`}
            >
              {evaluation.overallScore.toFixed(1)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {metrics.map((metric) => (
              <div key={metric.label} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{metric.label}</span>
                  <span
                    className={`font-medium ${getScoreColor(metric.value)}`}
                  >
                    {metric.value.toFixed(1)}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-none bg-muted">
                  <div
                    className={`h-full ${getScoreBarColor(metric.value)}`}
                    style={{ width: `${(metric.value / 10) * 100}%` }}
                    role="progressbar"
                    aria-valuenow={metric.value}
                    aria-valuemin={0}
                    aria-valuemax={10}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Evaluated {format(evaluation.evaluationDate, 'MMM d, yyyy')}
        </span>
        <span>By {evaluation.evaluator}</span>
      </CardFooter>
    </Card>
  )
}
