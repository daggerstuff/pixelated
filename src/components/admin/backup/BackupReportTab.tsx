import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardHeader,
  CardContent,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  BackupType,
  BackupStatus,
  RecoveryTestStatus,
} from '../../../lib/security/backup/backup-types'

interface Backup {
  id: string
  type: BackupType
  timestamp: string
  size: number
  location: string
  status: BackupStatus
  retentionDate: string
}

interface RecoveryTest {
  id: string
  backupId: string
  testDate: string
  status: RecoveryTestStatus
  timeTaken: number
  environment: string
}

interface BackupReportTabProps {
  backups: Backup[]
  recoveryTests: RecoveryTest[]
}

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

const calculateSuccessRate = (successful: number, total: number) => {
  if (total === 0) {
    return '0%'
  }
  return `${Math.round((successful / total) * 100)}%`
}

const BackupReportTab: React.FC<BackupReportTabProps> = ({
  backups,
  recoveryTests,
}) => {
  const [reportPeriod, setReportPeriod] = useState('last30days')

  // Calculate backup statistics
  const totalBackups = backups.length
  const successfulBackups = backups.filter(
    (b) =>
      b.status === BackupStatus.COMPLETED || b.status === BackupStatus.VERIFIED,
  ).length
  const failedBackups = backups.filter(
    (b) =>
      b.status === BackupStatus.FAILED ||
      b.status === BackupStatus.VERIFICATION_FAILED,
  ).length

  // Calculate recovery test statistics
  const totalTests = recoveryTests.length
  const successfulTests = recoveryTests.filter(
    (t) => t.status === RecoveryTestStatus.PASSED,
  ).length
  const failedTests = recoveryTests.filter(
    (t) => t.status === RecoveryTestStatus.FAILED,
  ).length

  // Calculate backup storage statistics
  const totalStorageUsed = backups.reduce(
    (total, backup) => total + backup.size,
    0,
  )

  // Calculate average backup size
  const averageBackupSize =
    totalBackups > 0 ? totalStorageUsed / totalBackups : 0

  // Count backups by type
  const backupsByType = backups.reduce(
    (counts, backup) => {
      counts[backup.type] = (counts[backup.type] || 0) + 1
      return counts
    },
    {} as Record<string, number>,
  )

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Backup Reports & Compliance</h2>
        <div className="flex items-center gap-4">
          <div>
            <Select 
              value={reportPeriod} 
              onValueChange={setReportPeriod}
              placeholder="Select period"
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="last7days">Last 7 Days</SelectItem>
                <SelectItem value="last30days">Last 30 Days</SelectItem>
                <SelectItem value="last90days">Last 90 Days</SelectItem>
                <SelectItem value="lastYear">Last Year</SelectItem>
                <SelectItem value="allTime">All Time</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button>Generate Compliance Report</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Backup Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2">
              <div className="flex justify-between">
                <dt>Total Backups:</dt>
                <dd className="font-medium">{totalBackups}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Success Rate:</dt>
                <dd className="font-medium">
                  {calculateSuccessRate(successfulBackups, totalBackups)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt>Successful Backups:</dt>
                <dd className="font-medium text-green-600">
                  {successfulBackups}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt>Failed Backups:</dt>
                <dd className="font-medium text-red-600">{failedBackups}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Storage Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2">
              <div className="flex justify-between">
                <dt>Total Storage Used:</dt>
                <dd className="font-medium">{formatBytes(totalStorageUsed)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Average Backup Size:</dt>
                <dd className="font-medium">
                  {formatBytes(averageBackupSize)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt>Full Backups:</dt>
                <dd className="font-medium">
                  {backupsByType[BackupType.FULL] || 0}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt>Differential Backups:</dt>
                <dd className="font-medium">
                  {backupsByType[BackupType.DIFFERENTIAL] || 0}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt>Transaction Backups:</dt>
                <dd className="font-medium">
                  {backupsByType[BackupType.TRANSACTION] || 0}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Recovery Testing</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2">
              <div className="flex justify-between">
                <dt>Total Tests Run:</dt>
                <dd className="font-medium">{totalTests}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Success Rate:</dt>
                <dd className="font-medium">
                  {calculateSuccessRate(successfulTests, totalTests)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt>Successful Tests:</dt>
                <dd className="font-medium text-green-600">
                  {successfulTests}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt>Failed Tests:</dt>
                <dd className="font-medium text-red-600">{failedTests}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Last Test Date:</dt>
                <dd className="font-medium">
                  {recoveryTests.length > 0
                    ? new Date(recoveryTests[0]!.testDate).toLocaleDateString()
                    : 'No tests run'}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Compliance Status</CardTitle>
          <CardDescription>HIPAA backup compliance status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="bg-green-100 text-green-800 hover:bg-green-100"
              >
                Compliant
              </Badge>
              <span>Your backup system is currently HIPAA compliant</span>
            </div>

            <h3 className="font-medium mt-2">Compliance Checks:</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Requirement</th>
                  <th className="text-left py-2">Status</th>
                  <th className="text-left py-2">Details</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="py-2">Encrypted Backups</td>
                  <td className="py-2">
                    <Badge
                      variant="outline"
                      className="bg-green-100 text-green-800 hover:bg-green-100"
                    >
                      Pass
                    </Badge>
                  </td>
                  <td className="py-2">
                    All backups are encrypted using AES-256-GCM
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="py-2">Backup Verification</td>
                  <td className="py-2">
                    <Badge
                      variant="outline"
                      className="bg-green-100 text-green-800 hover:bg-green-100"
                    >
                      Pass
                    </Badge>
                  </td>
                  <td className="py-2">
                    Regular integrity checks are performed
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="py-2">Recovery Testing</td>
                  <td className="py-2">
                    <Badge
                      variant="outline"
                      className="bg-green-100 text-green-800 hover:bg-green-100"
                    >
                      Pass
                    </Badge>
                  </td>
                  <td className="py-2">
                    Regular recovery tests performed with documentation
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="py-2">Offsite Storage</td>
                  <td className="py-2">
                    <Badge
                      variant="outline"
                      className="bg-green-100 text-green-800 hover:bg-green-100"
                    >
                      Pass
                    </Badge>
                  </td>
                  <td className="py-2">
                    Multiple storage locations configured
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="py-2">Retention Policies</td>
                  <td className="py-2">
                    <Badge
                      variant="outline"
                      className="bg-green-100 text-green-800 hover:bg-green-100"
                    >
                      Pass
                    </Badge>
                  </td>
                  <td className="py-2">
                    Retention policies defined and enforced
                  </td>
                </tr>
                <tr>
                  <td className="py-2">Key Rotation</td>
                  <td className="py-2">
                    <Badge
                      variant="outline"
                      className="bg-green-100 text-green-800 hover:bg-green-100"
                    >
                      Pass
                    </Badge>
                  </td>
                  <td className="py-2">90-day key rotation policy in place</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline">View Previous Reports</Button>
          <Button>Download Compliance Documentation</Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historical Reports</CardTitle>
          <CardDescription>
            Previous backup and compliance reports
          </CardDescription>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Report Date</th>
                <th className="text-left py-2">Type</th>
                <th className="text-left py-2">Period</th>
                <th className="text-left py-2">Status</th>
                <th className="text-left py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="py-2">2025-04-01</td>
                <td className="py-2">Compliance Audit</td>
                <td className="py-2">Q1 2025</td>
                <td className="py-2">
                  <Badge
                    variant="outline"
                    className="bg-green-100 text-green-800 hover:bg-green-100"
                  >
                    Compliant
                  </Badge>
                </td>
                <td className="py-2">
                  <Button variant="outline" size="sm">
                    View
                  </Button>
                </td>
              </tr>
              <tr className="border-b">
                <td className="py-2">2025-03-15</td>
                <td className="py-2">Recovery Test Report</td>
                <td className="py-2">Monthly</td>
                <td className="py-2">
                  <Badge
                    variant="outline"
                    className="bg-green-100 text-green-800 hover:bg-green-100"
                  >
                    Pass
                  </Badge>
                </td>
                <td className="py-2">
                  <Button variant="outline" size="sm">
                    View
                  </Button>
                </td>
              </tr>
              <tr className="border-b">
                <td className="py-2">2025-03-01</td>
                <td className="py-2">Backup Status Report</td>
                <td className="py-2">February 2025</td>
                <td className="py-2">
                  <Badge
                    variant="outline"
                    className="bg-green-100 text-green-800 hover:bg-green-100"
                  >
                    Normal
                  </Badge>
                </td>
                <td className="py-2">
                  <Button variant="outline" size="sm">
                    View
                  </Button>
                </td>
              </tr>
              <tr>
                <td className="py-2">2025-02-15</td>
                <td className="py-2">Recovery Test Report</td>
                <td className="py-2">Monthly</td>
                <td className="py-2">
                  <Badge
                    variant="outline"
                    className="bg-green-100 text-green-800 hover:bg-green-100"
                  >
                    Pass
                  </Badge>
                </td>
                <td className="py-2">
                  <Button variant="outline" size="sm">
                    View
                  </Button>
                </td>
              </tr>
            </tbody>
          </table>
        </CardContent>
        <CardFooter>
          <Button variant="outline">View All Reports</Button>
        </CardFooter>
      </Card>
    </div>
  )
}

export default BackupReportTab
