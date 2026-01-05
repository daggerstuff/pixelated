import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card/card'
import { SourceList } from '../lists/SourceList'
import { DiscoveryForm } from '../forms/DiscoveryForm'
import {
  useDiscoveryListQuery,
  useDiscoveryInitiateMutation,
} from '@/lib/hooks/journal-research'

import { cn } from '@/lib/utils'

export interface SourceDiscoveryProps {
  sessionId: string | null
  className?: string
}

export function SourceDiscovery({ sessionId, className }: SourceDiscoveryProps) {
  const [isInitiating, setIsInitiating] = useState(false)
  const { data: sources, isLoading } = useDiscoveryListQuery(sessionId, {
    page: 1,
    pageSize: 25,
  })
  const initiateMutation = useDiscoveryInitiateMutation(sessionId)

  if (!sessionId) {
    return (
      <div className={cn('text-center py-8', className)}>
        <p className="text-muted-foreground">
          Please select a session to start discovery
        </p>
      </div>
    )
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Source Discovery</h1>
          <p className="text-muted-foreground mt-1">
            Discover and identify relevant journal sources
          </p>
        </div>
        <button
          onClick={() => setIsInitiating(true)}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          disabled={initiateMutation.isPending}
        >
          {initiateMutation.isPending ? 'Discovering...' : 'Start Discovery'}
        </button>
      </div>

      {/* Discovery Form */}
      {isInitiating && (
        <Card>
          <CardHeader>
            <CardTitle>Configure Discovery</CardTitle>
          </CardHeader>
          <CardContent>
            <DiscoveryForm
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

      {/* Sources List */}
      <Card>
        <CardHeader>
          <CardTitle>Discovered Sources</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading sources...
            </div>
          ) : (
            <SourceList
              sources={sources ?? { items: [], total: 0, page: 1, pageSize: 25, totalPages: 0 }}
              isLoading={isLoading}
              onSourceClick={(_source) => {
                // Navigate to source detail
              }}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

