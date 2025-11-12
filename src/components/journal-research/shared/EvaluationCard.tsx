import type { Evaluation } from '@/lib/api/journal-research/types'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card/card'
import { format } from 'date-fns'

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
    if (score >= 8) return 'text-green-600 dark:text-green-400'
    if (score >= 6) return 'text-yellow-600 dark:text-yellow-400'
    return 'text-red-600 dark:text-red-400'
  }

  const getPriorityColor = (tier: string) => {
    const colors: Record<string, string> = {
      high: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      low: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    }
    return colors[tier.toLowerCase()] ?? 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
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
      className={`transition-shadow hover:shadow-lg ${onClick ? 'cursor-pointer' : ''} ${className ?? ''}`}
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
            className={`rounded-full px-2 py-1 text-xs font-medium capitalize ${getPriorityColor(evaluation.priorityTier)}`}
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
                  <span className={`font-medium ${getScoreColor(metric.value)}`}>
                    {metric.value.toFixed(1)}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full ${getScoreColor(metric.value).replace('text-', 'bg-').replace('-600', '-500').replace('-400', '-400')}`}
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
        <span>Evaluated {format(evaluation.evaluationDate, 'MMM d, yyyy')}</span>
        <span>By {evaluation.evaluator}</span>
      </CardFooter>
    </Card>
  )
}

