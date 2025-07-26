import React from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  BackupType,
  BackupStatus,
} from '../../../lib/security/backup/backup-types'

// Helper function to format file size
const formatBytes = (bytes: number, decimals = 2) => {
  if (bytes === 0) {
    return '0 Bytes'
  }

  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']

  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

// Helper function to format date string
const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleString()
}

// Helper function to render status badge
const renderStatusBadge = (status: BackupStatus) => {
  switch (status) {
    case BackupStatus.PENDING:
      return <Badge variant="outline">Pending</Badge>

    case BackupStatus.IN_PROGRESS:
      return (
        <Badge
          variant="secondary"
          className="bg-blue-100 text-blue-800 hover:bg-blue-100"
        >
          In Progress
        </Badge>
      )

    case BackupStatus.COMPLETED:
      return (
        <Badge
          variant="outline"
          className="bg-green-100 text-green-800 hover:bg-green-100"
        >
          Completed
        </Badge>
      )

    case BackupStatus.FAILED:
      return <Badge variant="destructive">Failed</Badge>

    case BackupStatus.VERIFIED:
      return (
        <Badge
          variant="outline"
          className="bg-green-100 text-green-800 hover:bg-green-100"
        >
          Verified
        </Badge>
      )

    case BackupStatus.VERIFICATION_FAILED:
      return <Badge variant="destructive">Verification Failed</Badge>

    case BackupStatus.EXPIRED:
      return (
        <Badge
          variant="outline"
          className="bg-gray-100 text-gray-800 hover:bg-gray-100"
        >
          Expired
        </Badge>
      )

    default:
      return null
  }
}

// Helper function to render backup type badge
const renderTypeBadge = (type: BackupType) => {
  switch (type) {
    case BackupType.FULL:
      return (
        <Badge
          variant="outline"
          className="bg-purple-100 text-purple-800 hover:bg-purple-100"
        >
          Full
        </Badge>
      )

    case BackupType.DIFFERENTIAL:
      return (
        <Badge
          variant="outline"
          className="bg-blue-100 text-blue-800 hover:bg-blue-100"
        >
          Differential
        </Badge>
      )

    case BackupType.TRANSACTION:
      return (
        <Badge
          variant="outline"
          className="bg-gray-100 text-gray-800 hover:bg-gray-100"
        >
          Transaction
        </Badge>
      )

    default:
      return null
  }
}

interface Backup {
  id: string
  type: BackupType
  timestamp: string
  size: number
  location: string
  status: BackupStatus
  retentionDate: string
}

interface BackupStatusTabProps {
  backups: Backup[]
  onCreateBackup: (type: BackupType) => void
  onVerifyBackup: (backupId: string) => void
}

const BackupStatusTab: React.FC<BackupStatusTabProps> = ({
  backups,
  onCreateBackup,
  onVerifyBackup,
}) => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Backup Status</h2>
        <div className="flex gap-2">
          <Button
            onClick={() => onCreateBackup(BackupType.TRANSACTION)}
            variant="outline"
            size="sm"
          >
            Create Transaction Backup
          </Button>
          <Button
            onClick={() => onCreateBackup(BackupType.DIFFERENTIAL)}
            variant="outline"
            size="sm"
          >
            Create Differential Backup
          </Button>
          <Button onClick={() => onCreateBackup(BackupType.FULL)} size="sm">
            Create Full Backup
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {backups.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="py-8 text-center text-gray-500">
              No backups have been created yet. Use the buttons above to create
              your first backup.
            </CardContent>
          </Card>
        ) : (
          backups.map((backup) => (
            <Card
              key={backup.id}
              className={
                backup.status === BackupStatus.FAILED ||
                backup.status === BackupStatus.VERIFICATION_FAILED
                  ? 'border-red-200'
                  : ''
              }
            >
              <CardHeader className="pb-2">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-base">
                    {renderTypeBadge(backup.type)}
                  </CardTitle>
                  {renderStatusBadge(backup.status)}
                </div>
                <CardDescription>
                  Created: {formatDate(backup.timestamp)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div>
                    <span className="font-medium">ID:</span>
                    <br />
                    <span className="text-gray-600 text-xs">{backup.id}</span>
                  </div>
                  <div>
                    <span className="font-medium">Size:</span>
                    <br />
                    <span className="text-gray-600">
                      {formatBytes(backup.size)}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium">Location:</span>
                    <br />
                    <span className="text-gray-600">{backup.location}</span>
                  </div>
                  <div>
                    <span className="font-medium">Retention Until:</span>
                    <br />
                    <span className="text-gray-600">
                      {new Date(backup.retentionDate).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-end space-x-2 pt-0">
                {[
                  BackupStatus.COMPLETED,
                  BackupStatus.VERIFICATION_FAILED,
                ].includes(backup.status) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onVerifyBackup(backup.id)}
                  >
                    Verify
                  </Button>
                )}
                {backup.status === BackupStatus.IN_PROGRESS && (
                  <Button variant="outline" size="sm" disabled>
                    <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-current border-r-transparent"></span>
                    In Progress
                  </Button>
                )}
                <Button variant="outline" size="sm">
                  Details
                </Button>
              </CardFooter>
            </Card>
          ))
        )}
      </div>

      <div className="mt-6">
        <h3 className="text-lg font-semibold mb-2">Backup Schedule</h3>
        <Card>
          <CardContent className="py-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Type</th>
                  <th className="text-left py-2">Schedule</th>
                  <th className="text-left py-2">Next Run</th>
                  <th className="text-left py-2">Retention</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="py-2">Full Backup</td>
                  <td className="py-2">Weekly (Sunday at midnight)</td>
                  <td className="py-2">
                    {(() => {
                      // Calculate next Sunday
                      const now = new Date()
                      const daysUntilSunday = 7 - now.getDay()
                      const nextSunday = new Date(now)
                      nextSunday.setDate(now.getDate() + daysUntilSunday)
                      nextSunday.setHours(0, 0, 0, 0)
                      return nextSunday.toLocaleDateString()
                    })()}
                  </td>
                  <td className="py-2">365 days</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2">Differential Backup</td>
                  <td className="py-2">Daily at midnight (except Sunday)</td>
                  <td className="py-2">
                    {(() => {
                      // Calculate next day at midnight
                      const now = new Date()
                      const tomorrow = new Date(now)
                      tomorrow.setDate(now.getDate() + 1)
                      tomorrow.setHours(0, 0, 0, 0)
                      return tomorrow.toLocaleDateString()
                    })()}
                  </td>
                  <td className="py-2">30 days</td>
                </tr>
                <tr>
                  <td className="py-2">Transaction Backup</td>
                  <td className="py-2">Hourly</td>
                  <td className="py-2">
                    {(() => {
                      // Calculate next hour
                      const now = new Date()
                      const nextHour = new Date(now)
                      nextHour.setHours(now.getHours() + 1, 0, 0, 0)
                      return nextHour.toLocaleTimeString()
                    })()}
                  </td>
                  <td className="py-2">7 days</td>
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default BackupStatusTab
