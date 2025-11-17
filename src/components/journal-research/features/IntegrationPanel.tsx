import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card/card'
import {
  useIntegrationPlanListQuery,
  useIntegrationInitiateMutation,
} from '@/lib/hooks/journal-research'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

export interface IntegrationPanelProps {
  sessionId: string | null
  className?: string
}

export function IntegrationPanel({ sessionId, className }: IntegrationPanelProps) {
  const [isInitiating, setIsInitiating] = useState(false)
  const { data: plans, isLoading } = useIntegrationPlanListQuery(sessionId, {
    page: 1,
    pageSize: 25,
  })
  const initiateMutation = useIntegrationInitiateMutation(sessionId)

  if (!sessionId) {
    return (
      <div className={cn('text-center py-8', className)}>
        <p className="text-muted-foreground">
          Please select a session to view integration plans
        </p>
      </div>
    )
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Integration Planning</h1>
          <p className="text-muted-foreground mt-1">
            Plan and visualize dataset integration strategies
          </p>
        </div>
        <button
          onClick={() => setIsInitiating(true)}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          disabled={initiateMutation.isPending}
        >
          {initiateMutation.isPending ? 'Planning...' : 'Start Integration Planning'}
        </button>
      </div>

      {/* Initiate Integration */}
      {isInitiating && (
        <Card>
          <CardHeader>
            <CardTitle>Configure Integration Planning</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Select sources to create integration plans for. Leave empty to
                plan for all acquired sources.
              </p>
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Target Format
                </label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  defaultValue="chatml"
                >
                  <option value="chatml">ChatML</option>
                  <option value="json">JSON</option>
                  <option value="csv">CSV</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    initiateMutation.mutate(
                      { sourceIds: [], targetFormat: 'chatml' },
                      {
                        onSuccess: () => {
                          setIsInitiating(false)
                        },
                      },
                    )
                  }}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Plan for All Acquired
                </button>
                <button
                  onClick={() => setIsInitiating(false)}
                  className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
                >
                  Cancel
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Integration Plans List */}
      <Card>
        <CardHeader>
          <CardTitle>Integration Plans</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading integration plans...
            </div>
          ) : plans?.items.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No integration plans yet. Start integration planning to create
              plans.
            </div>
          ) : (
            <div className="space-y-4">
              {plans?.items.map((plan) => (
                <Card key={plan.planId}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{plan.planId}</CardTitle>
                      <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium capitalize">
                        {plan.complexity}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">
                          Source ID
                        </p>
                        <p className="mt-1">{plan.sourceId}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">
                          Target Format
                        </p>
                        <p className="mt-1">{plan.targetFormat}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">
                          Estimated Effort
                        </p>
                        <p className="mt-1">{plan.estimatedEffortHours} hours</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">
                          Created Date
                        </p>
                        <p className="mt-1">
                          {format(plan.createdDate, 'PPpp')}
                        </p>
                      </div>
                      {plan.requiredTransformations.length > 0 && (
                        <div className="md:col-span-2">
                          <p className="text-sm font-medium text-muted-foreground">
                            Required Transformations
                          </p>
                          <ul className="mt-1 list-inside list-disc space-y-1">
                            {plan.requiredTransformations.map((transformation) => (
                              <li key={transformation} className="text-sm">
                                {transformation}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {Object.keys(plan.schemaMapping).length > 0 && (
                        <div className="md:col-span-2">
                          <p className="text-sm font-medium text-muted-foreground">
                            Schema Mapping
                          </p>
                          <div className="mt-1 space-y-1">
                            {Object.entries(plan.schemaMapping).map(
                              ([key, value]) => (
                                <div key={key} className="text-sm">
                                  <span className="font-medium">{key}:</span>{' '}
                                  {value}
                                </div>
                              ),
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

