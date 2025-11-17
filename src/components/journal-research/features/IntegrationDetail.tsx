import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card/card'
import { useIntegrationPlanQuery } from '@/lib/hooks/journal-research'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { Code, Download } from 'lucide-react'

export interface IntegrationDetailProps {
  sessionId: string
  planId: string
  className?: string
}

export function IntegrationDetail({
  sessionId,
  planId,
  className,
}: IntegrationDetailProps) {
  const { data: plan, isLoading } = useIntegrationPlanQuery(sessionId, planId)

  if (isLoading) {
    return (
      <div className={cn('text-center py-8', className)}>
        <p className="text-muted-foreground">Loading integration plan...</p>
      </div>
    )
  }

  if (!plan) {
    return (
      <div className={cn('text-center py-8', className)}>
        <p className="text-muted-foreground">Integration plan not found</p>
      </div>
    )
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Integration Plan</h1>
          <p className="text-muted-foreground mt-1">
            Created {format(plan.createdDate, 'MMM d, yyyy')} •{' '}
            <span className="capitalize">{plan.complexity}</span> complexity
          </p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent">
            <Code className="h-4 w-4" />
            Generate Script
          </button>
          <button className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <Download className="h-4 w-4" />
            Export Plan
          </button>
        </div>
      </div>

      {/* Plan Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Plan Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Plan ID
              </p>
              <p className="mt-1">{plan.planId}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Source ID
              </p>
              <p className="mt-1">{plan.sourceId}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Complexity
              </p>
              <p className="mt-1 capitalize">{plan.complexity}</p>
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
              <p className="mt-1 text-lg font-semibold">
                {plan.estimatedEffortHours} hours
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Created Date
              </p>
              <p className="mt-1">{format(plan.createdDate, 'PPpp')}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Required Transformations */}
      {plan.requiredTransformations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Required Transformations</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {plan.requiredTransformations.map((transformation, index) => (
                <li
                  key={index}
                  className="flex items-start gap-3 border-b pb-3 last:border-0"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                    {index + 1}
                  </span>
                  <span className="flex-1 text-sm">{transformation}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Schema Mapping */}
      {Object.keys(plan.schemaMapping).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Schema Mapping</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="px-4 py-2 text-left text-sm font-medium">
                      Source Field
                    </th>
                    <th className="px-4 py-2 text-left text-sm font-medium">
                      Target Field
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(plan.schemaMapping).map(([key, value]) => (
                    <tr key={key} className="border-b last:border-0">
                      <td className="px-4 py-2 font-mono text-sm">{key}</td>
                      <td className="px-4 py-2 font-mono text-sm">{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preprocessing Script Preview */}
      <Card>
        <CardHeader>
          <CardTitle>Preprocessing Script</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md bg-muted p-4">
            <pre className="text-sm">
              {`# Integration script for ${plan.planId}
# Target format: ${plan.targetFormat}
# Estimated effort: ${plan.estimatedEffortHours} hours

import json
from typing import Dict, Any

def transform_data(source_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Transform source data to target format: ${plan.targetFormat}
    """
    # TODO: Implement transformations
    # Required transformations:
${plan.requiredTransformations.map((t) => `    # - ${t}`).join('\n')}
    
    return transformed_data

# Schema mapping:
${Object.entries(plan.schemaMapping).map(([k, v]) => `# ${k} -> ${v}`).join('\n')}
`}
            </pre>
          </div>
          <div className="mt-4 flex gap-2">
            <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              Generate Full Script
            </button>
            <button className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent">
              Download Script
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

