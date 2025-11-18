import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card/card'
import { EvaluationCard } from '../shared/EvaluationCard'
import { EvaluationForm } from '../forms/EvaluationForm'
import {
  useEvaluationQuery,
  useEvaluationUpdateMutation,
} from '@/lib/hooks/journal-research'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

export interface EvaluationDetailProps {
  sessionId: string
  evaluationId: string
  className?: string
}

export function EvaluationDetail({
  sessionId,
  evaluationId,
  className,
}: EvaluationDetailProps) {
  const [isEditing, setIsEditing] = useState(false)
  const { data: evaluation, isLoading } = useEvaluationQuery(
    sessionId,
    evaluationId,
  )
  const updateMutation = useEvaluationUpdateMutation(sessionId)

  if (isLoading) {
    return (
      <div className={cn('text-center py-8', className)}>
        <p className="text-muted-foreground">Loading evaluation...</p>
      </div>
    )
  }

  if (!evaluation) {
    return (
      <div className={cn('text-center py-8', className)}>
        <p className="text-muted-foreground">Evaluation not found</p>
      </div>
    )
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Evaluation Details</h1>
          <p className="text-muted-foreground mt-1">
            Evaluated {format(evaluation.evaluationDate, 'MMM d, yyyy')} by{' '}
            {evaluation.evaluator}
          </p>
        </div>
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
        >
          {isEditing ? 'Cancel' : 'Edit'}
        </button>
      </div>

      {/* Evaluation Card */}
      <EvaluationCard evaluation={evaluation} />

      {/* Edit Form */}
      {isEditing && (
        <Card>
          <CardHeader>
            <CardTitle>Edit Evaluation</CardTitle>
          </CardHeader>
          <CardContent>
            <EvaluationForm
              evaluation={evaluation}
              onSubmit={(payload) => {
                updateMutation.mutate(
                  {
                    evaluationId: evaluation.evaluationId,
                    payload,
                  },
                  {
                    onSuccess: () => {
                      setIsEditing(false)
                    },
                  },
                )
              }}
              onCancel={() => setIsEditing(false)}
            />
          </CardContent>
        </Card>
      )}

      {/* Evaluation Details */}
      <Card>
        <CardHeader>
          <CardTitle>Evaluation Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Evaluation ID
              </p>
              <p className="mt-1">{evaluation.evaluationId}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Source ID
              </p>
              <p className="mt-1">{evaluation.sourceId}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Overall Score
              </p>
              <p className="mt-1 text-lg font-semibold">
                {evaluation.overallScore.toFixed(1)} / 10
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Priority Tier
              </p>
              <p className="mt-1 capitalize">{evaluation.priorityTier}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Therapeutic Relevance
              </p>
              <p className="mt-1">{evaluation.therapeuticRelevance} / 10</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Data Structure Quality
              </p>
              <p className="mt-1">{evaluation.dataStructureQuality} / 10</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Training Integration
              </p>
              <p className="mt-1">{evaluation.trainingIntegration} / 10</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Ethical Accessibility
              </p>
              <p className="mt-1">{evaluation.ethicalAccessibility} / 10</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Evaluation Date
              </p>
              <p className="mt-1">{format(evaluation.evaluationDate, 'PPpp')}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Evaluator
              </p>
              <p className="mt-1">{evaluation.evaluator}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

