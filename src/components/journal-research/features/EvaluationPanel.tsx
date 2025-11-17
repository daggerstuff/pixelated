import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card/card'
import { EvaluationList } from '../lists/EvaluationList'
import { EvaluationForm } from '../forms/EvaluationForm'
import {
  useEvaluationListQuery,
  useEvaluationInitiateMutation,
  useEvaluationQuery,
  useEvaluationUpdateMutation,
} from '@/lib/hooks/journal-research'
import { cn } from '@/lib/utils'

export interface EvaluationPanelProps {
  sessionId: string | null
  className?: string
}

export function EvaluationPanel({ sessionId, className }: EvaluationPanelProps) {
  const [isInitiating, setIsInitiating] = useState(false)
  const [editingEvaluationId, setEditingEvaluationId] = useState<string | null>(
    null,
  )
  const { data: evaluations, isLoading } = useEvaluationListQuery(sessionId, {
    page: 1,
    pageSize: 25,
  })
  const initiateMutation = useEvaluationInitiateMutation(sessionId)
  const { data: editingEvaluation } = useEvaluationQuery(
    sessionId,
    editingEvaluationId,
  )
  const updateMutation = useEvaluationUpdateMutation(sessionId)

  if (!sessionId) {
    return (
      <div className={cn('text-center py-8', className)}>
        <p className="text-muted-foreground">
          Please select a session to view evaluations
        </p>
      </div>
    )
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Evaluation</h1>
          <p className="text-muted-foreground mt-1">
            Evaluate discovered sources for relevance and quality
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setIsInitiating(true)}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            disabled={initiateMutation.isPending}
          >
            {initiateMutation.isPending ? 'Evaluating...' : 'Start Evaluation'}
          </button>
        </div>
      </div>

      {/* Initiate Evaluation Form */}
      {isInitiating && (
        <Card>
          <CardHeader>
            <CardTitle>Configure Evaluation</CardTitle>
          </CardHeader>
          <CardContent>
            <EvaluationForm
              onSubmit={(payload) => {
                initiateMutation.mutate(payload, {
                  onSuccess: () => {
                    setIsInitiating(false)
                  },
                })
              }}
              onCancel={() => setIsInitiating(false)}
            />
          </CardContent>
        </Card>
      )}

      {/* Edit Evaluation Form */}
      {editingEvaluation && (
        <Card>
          <CardHeader>
            <CardTitle>Edit Evaluation</CardTitle>
          </CardHeader>
          <CardContent>
            <EvaluationForm
              evaluation={editingEvaluation}
              onSubmit={(payload) => {
                if (editingEvaluationId) {
                  updateMutation.mutate(
                    {
                      evaluationId: editingEvaluationId,
                      payload,
                    },
                    {
                      onSuccess: () => {
                        setEditingEvaluationId(null)
                      },
                    },
                  )
                }
              }}
              onCancel={() => setEditingEvaluationId(null)}
            />
          </CardContent>
        </Card>
      )}

      {/* Evaluations List */}
      <Card>
        <CardHeader>
          <CardTitle>Evaluations</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading evaluations...
            </div>
          ) : (
            <EvaluationList
              evaluations={evaluations ?? { items: [], total: 0, page: 1, pageSize: 25, totalPages: 0 }}
              isLoading={isLoading}
              onEvaluationClick={(evaluation) => {
                setEditingEvaluationId(evaluation.evaluationId)
              }}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

