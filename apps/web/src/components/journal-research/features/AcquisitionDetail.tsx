import { format } from 'date-fns'
import {
  Download,
  CheckCircle,
  XCircle,
  Clock,
  Play,
  CheckCircle2,
  Loader2,
} from 'lucide-react'

import { Button } from '@/components/ui/button/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card/card'
import {
  useAcquisitionQuery,
  useAcquisitionUpdateMutation,
} from '@/lib/hooks/journal-research'
import {
  useIntegrateDataset,
  useTrainingStatus,
} from '@/lib/hooks/journal-research/useTraining'
import { cn } from '@/lib/utils'

export interface AcquisitionDetailProps {
  sessionId: string
  acquisitionId: string
  className?: string
}

export function AcquisitionDetail({
  sessionId,
  acquisitionId,
  className,
}: AcquisitionDetailProps) {
  const { data: acquisition, isLoading } = useAcquisitionQuery(
    sessionId,
    acquisitionId,
  )
  const updateMutation = useAcquisitionUpdateMutation(sessionId)
  const integrateMutation = useIntegrateDataset(sessionId)
  const { data: trainingStatus } = useTrainingStatus(sessionId, true)

  // Check if this acquisition is integrated
  const isIntegrated =
    trainingStatus?.datasets?.find(
      (ds) => ds.source_id === acquisition?.sourceId,
    )?.integrated ?? false

  if (isLoading) {
    return (
      <div className={cn('text-center py-8', className)}>
        <p className="text-muted-foreground">Loading acquisition...</p>
      </div>
    )
  }

  if (!acquisition) {
    return (
      <div className={cn('text-center py-8', className)}>
        <p className="text-muted-foreground">Acquisition not found</p>
      </div>
    )
  }

  const statusIcons = {
    'pending': Clock,
    'approved': CheckCircle,
    'in-progress': Download,
    'completed': CheckCircle,
    'failed': XCircle,
  }

  const StatusIcon =
    statusIcons[acquisition.status as keyof typeof statusIcons] ?? Clock

  const statusColors = {
    'pending': 'text-muted-foreground',
    'approved': 'text-foreground font-medium',
    'in-progress': 'text-foreground font-medium',
    'completed': 'text-foreground font-semibold',
    'failed': 'text-foreground font-bold',
  }

  const statusColor =
    statusColors[acquisition.status as keyof typeof statusColors] ??
    'text-muted-foreground'

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Acquisition Details</h1>
          <p className="mt-1 text-muted-foreground">
            <span className="capitalize">{acquisition.status}</span>
            {acquisition.acquiredDate &&
              ` • Acquired ${format(acquisition.acquiredDate, 'MMM d, yyyy')}`}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <StatusIcon className={cn('h-5 w-5', statusColor)} />
            <span className="font-medium capitalize">{acquisition.status}</span>
          </div>

          {/* Training Pipeline Integration */}
          {acquisition.status === 'completed' && (
            <div className="flex items-center gap-2">
              {isIntegrated ? (
                <div className="flex items-center gap-2 rounded-none border border-input bg-secondary px-3 py-1.5">
                  <CheckCircle2 className="h-4 w-4 text-foreground" />
                  <span className="text-sm font-medium text-foreground">
                    Integrated
                  </span>
                </div>
              ) : (
                <Button
                  size="sm"
                  onClick={() => {
                    if (acquisition.sourceId) {
                      integrateMutation.mutate({
                        sourceId: acquisition.sourceId,
                      })
                    }
                  }}
                  disabled={integrateMutation.isPending}
                >
                  {integrateMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Integrating...
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      Integrate with Training Pipeline
                    </>
                  )}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Acquisition Details */}
      <Card>
        <CardHeader>
          <CardTitle>Acquisition Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Acquisition ID
              </p>
              <p className="mt-1">{acquisition.acquisitionId}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Source ID
              </p>
              <p className="mt-1">{acquisition.sourceId}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Status
              </p>
              <p className="mt-1 capitalize">{acquisition.status}</p>
            </div>
            {acquisition.acquiredDate && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Acquired Date
                </p>
                <p className="mt-1">
                  {format(acquisition.acquiredDate, 'PPpp')}
                </p>
              </div>
            )}
            {acquisition.downloadProgress !== null && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Download Progress
                </p>
                <div className="mt-2">
                  <div
                    className="h-2 w-full overflow-hidden rounded-none bg-muted"
                    role="progressbar"
                    aria-valuenow={acquisition.downloadProgress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Download Progress"
                  >
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${acquisition.downloadProgress}%` }}
                    />
                  </div>
                  <p className="mt-1 text-sm" aria-hidden="true">
                    {acquisition.downloadProgress}%
                  </p>
                </div>
              </div>
            )}
            {acquisition.filePath && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  File Path
                </p>
                <p className="mt-1 font-mono text-sm">{acquisition.filePath}</p>
              </div>
            )}
            {acquisition.fileSizeMb !== null && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  File Size
                </p>
                <p className="mt-1">{acquisition.fileSizeMb.toFixed(2)} MB</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Status Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Status Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {acquisition.status === 'pending' && (
              <>
                <button
                  onClick={() => {
                    updateMutation.mutate({
                      acquisitionId: acquisition.acquisitionId,
                      payload: { status: 'approved' },
                    })
                  }}
                  className="hover:bg-primary/90 rounded-none bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                >
                  Approve
                </button>
                <button
                  onClick={() => {
                    updateMutation.mutate({
                      acquisitionId: acquisition.acquisitionId,
                      payload: { status: 'failed' },
                    })
                  }}
                  className="hover:bg-destructive/90 rounded-none bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground"
                >
                  Reject
                </button>
              </>
            )}
            {acquisition.status === 'approved' && (
              <button
                onClick={() => {
                  updateMutation.mutate({
                    acquisitionId: acquisition.acquisitionId,
                    payload: { status: 'in-progress' },
                  })
                }}
                className="hover:bg-primary/90 rounded-none bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              >
                Start Download
              </button>
            )}
            {acquisition.status === 'in-progress' && (
              <button
                onClick={() => {
                  updateMutation.mutate({
                    acquisitionId: acquisition.acquisitionId,
                    payload: { status: 'completed' },
                  })
                }}
                className="rounded-none bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-accent"
              >
                Mark Complete
              </button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
