import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card/card'
import { AcquisitionList } from '../lists/AcquisitionList'
import {
  useAcquisitionListQuery,
  useAcquisitionInitiateMutation,
  useAcquisitionUpdateMutation,
} from '@/lib/hooks/journal-research'
import { cn } from '@/lib/utils'

export interface AcquisitionPanelProps {
  sessionId: string | null
  className?: string
}

export function AcquisitionPanel({ sessionId, className }: AcquisitionPanelProps) {
  const [isInitiating, setIsInitiating] = useState(false)
  const { data: acquisitions, isLoading } = useAcquisitionListQuery(sessionId, {
    page: 1,
    pageSize: 25,
  })
  const initiateMutation = useAcquisitionInitiateMutation(sessionId)
  const updateMutation = useAcquisitionUpdateMutation(sessionId)

  if (!sessionId) {
    return (
      <div className={cn('text-center py-8', className)}>
        <p className="text-muted-foreground">
          Please select a session to view acquisitions
        </p>
      </div>
    )
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Acquisition</h1>
          <p className="text-muted-foreground mt-1">
            Acquire and download evaluated datasets
          </p>
        </div>
        <button
          onClick={() => setIsInitiating(true)}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          disabled={initiateMutation.isPending}
        >
          {initiateMutation.isPending ? 'Acquiring...' : 'Start Acquisition'}
        </button>
      </div>

      {/* Initiate Acquisition */}
      {isInitiating && (
        <Card>
          <CardHeader>
            <CardTitle>Configure Acquisition</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Select sources to acquire. Leave empty to acquire all approved
                sources.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    initiateMutation.mutate({ sourceIds: [] }, {
                      onSuccess: () => {
                        setIsInitiating(false)
                      },
                    })
                  }}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Acquire All Approved
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

      {/* Acquisitions List */}
      <Card>
        <CardHeader>
          <CardTitle>Acquisitions</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading acquisitions...
            </div>
          ) : (
            <AcquisitionList
              acquisitions={acquisitions ?? { items: [], total: 0, page: 1, pageSize: 25, totalPages: 0 }}
              isLoading={isLoading}
              onAcquisitionClick={(acquisition) => {
                // Navigate to acquisition detail
              }}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

