import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card/card'
import {
  useAcquisitionQuery,
  useAcquisitionUpdateMutation,
} from '@/lib/hooks/journal-research'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { Download, CheckCircle, XCircle, Clock } from 'lucide-react'

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
    pending: Clock,
    approved: CheckCircle,
    'in-progress': Download,
    completed: CheckCircle,
    failed: XCircle,
  }

  const StatusIcon = statusIcons[acquisition.status as keyof typeof statusIcons] ?? Clock

  const statusColors = {
    pending: 'text-yellow-600',
    approved: 'text-blue-600',
    'in-progress': 'text-blue-600',
    completed: 'text-green-600',
    failed: 'text-red-600',
  }

  const statusColor = statusColors[acquisition.status as keyof typeof statusColors] ?? 'text-gray-600'

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Acquisition Details</h1>
          <p className="text-muted-foreground mt-1">
            <span className="capitalize">{acquisition.status}</span>
            {acquisition.acquiredDate &&
              ` • Acquired ${format(acquisition.acquiredDate, 'MMM d, yyyy')}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusIcon className={cn('h-5 w-5', statusColor)} />
          <span className="capitalize font-medium">{acquisition.status}</span>
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
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${acquisition.downloadProgress}%` }}
                    />
                  </div>
                  <p className="mt-1 text-sm">
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
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
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
                  className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
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
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
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
                className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
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

