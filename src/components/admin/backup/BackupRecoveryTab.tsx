import { useState, type FC } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardHeader,
  CardContent,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RecoveryTestStatus } from '../../../lib/security/backup/backup-types'
import type { BackupType, BackupStatus } from '../../../lib/security/backup'
import { toast } from '@/components/ui/toast'

// Define the enum locally to avoid server-side imports
enum TestEnvironmentType {
  Sandbox = 'sandbox',
  Docker = 'docker',
  Kubernetes = 'kubernetes',
  VM = 'vm',
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

interface RecoveryTest {
  id: string
  backupId: string
  testDate: string
  status: RecoveryTestStatus
  timeTaken: number
  environment: string
  verificationResults?: Array<{
    testCase: string
    passed: boolean
    details: Record<string, unknown>
  }>
  issues?: Array<{
    type: string
    description: string
    severity: 'low' | 'medium' | 'high' | 'critical'
  }>
}

interface BackupRecoveryTabProps {
  backups: Backup[]
  recoveryHistory: RecoveryTest[]
}

// Helper functions
const formatDate = (dateString: string) => new Date(dateString).toLocaleString()

const formatDuration = (ms: number) => {
  if (ms < 1000) {
    return `${ms}ms`
  }
  return `${(ms / 1000).toFixed(2)}s`
}

const renderStatusBadge = (status: RecoveryTestStatus) => {
  switch (status) {
    case RecoveryTestStatus.PASSED:
      return (
        <Badge variant="outline" className="bg-green-100 text-green-800">
          Passed
        </Badge>
      )
    case RecoveryTestStatus.FAILED:
      return <Badge variant="destructive">Failed</Badge>
    case RecoveryTestStatus.IN_PROGRESS:
      return (
        <Badge variant="outline" className="bg-blue-100 text-blue-800">
          In Progress
        </Badge>
      )
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

const BackupRecoveryTab: FC<BackupRecoveryTabProps> = ({
  backups,
  recoveryHistory: initialRecoveryHistory,
}) => {
  const [selectedBackupId, setSelectedBackupId] = useState<string>('')
  const [isTesting, setIsTesting] = useState(false)
  const [latestTestResult, setLatestTestResult] = useState<RecoveryTest | null>(
    null,
  )
  const [recoveryHistory, setRecoveryHistory] = useState<RecoveryTest[]>(
    initialRecoveryHistory,
  )
  const [selectedTest, setSelectedTest] = useState<string | null>(null)

  const [testEnvironment, setTestEnvironment] = useState<TestEnvironmentType>(
    TestEnvironmentType.Sandbox,
  )

  const selectedBackup = backups.find((b) => b.id === selectedBackupId)

  const handleRunTest = async () => {
    if (!selectedBackup) {
      toast.error('Please select a backup to test.')
      return
    }

    setIsTesting(true)
    setLatestTestResult(null)

    try {
      const response = await fetch('/api/admin/backup/recovery-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          backupId: selectedBackup.id,
          environment: testEnvironment,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to run recovery test.')
      }

      setLatestTestResult(data)
      setRecoveryHistory([data, ...recoveryHistory])
      toast.success('Recovery test completed successfully!')
    } catch (error: unknown) {
      console.error('Recovery test failed:', error)

      // Type guard to safely access String(error)
      const errorMessage =
        error instanceof Error
          ? String(error)
          : typeof error === 'object' && error !== null && 'message' in error
            ? String((error as { message: unknown }).message)
            : 'An unexpected error occurred.'

      toast.error(errorMessage)
    } finally {
      setIsTesting(false)
    }
  }

  const handleSelectTest = (testId: string) => {
    if (selectedTest === testId) {
      setSelectedTest(null)
    } else {
      setSelectedTest(testId)
    }
  }

  const availableBackups = backups.filter(
    (b) => b.status === 'completed' || b.status === 'verified',
  )

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Manual Recovery Test</CardTitle>
          <CardDescription>
            Select a backup and an environment to run a manual recovery test.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label
                htmlFor="backup-select"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Select Backup
              </label>
              <Select
                value={selectedBackupId}
                onValueChange={setSelectedBackupId}
                placeholder="Choose a backup..."
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableBackups.map((backup) => (
                    <SelectItem key={backup.id} value={backup.id}>
                      {new Date(backup.timestamp).toLocaleString()} -{' '}
                      {backup.type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label
                htmlFor="test-environment"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Test Environment
              </label>
              <Select
                value={testEnvironment}
                onValueChange={(value: string) =>
                  setTestEnvironment(value as TestEnvironmentType)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TestEnvironmentType.Sandbox}>
                    Sandbox (Memory)
                  </SelectItem>
                  <SelectItem value={TestEnvironmentType.Docker}>
                    Docker
                  </SelectItem>
                  <SelectItem value={TestEnvironmentType.Kubernetes}>
                    Kubernetes
                  </SelectItem>
                  <SelectItem value={TestEnvironmentType.VM}>VM</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            onClick={handleRunTest}
            disabled={isTesting || !selectedBackupId}
          >
            {isTesting ? 'Testing...' : 'Run Test'}
          </Button>
        </CardContent>
      </Card>

      {latestTestResult && (
        <Card>
          <CardHeader>
            <CardTitle>Latest Test Result</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-sm font-medium">Status:</span>
                  <span className="ml-2">
                    {renderStatusBadge(latestTestResult.status)}
                  </span>
                </div>
                <div>
                  <span className="text-sm font-medium">Duration:</span>
                  <span className="ml-2">
                    {formatDuration(latestTestResult.timeTaken)}
                  </span>
                </div>
              </div>
              <div>
                <span className="text-sm font-medium">Environment:</span>
                <span className="ml-2">{latestTestResult.environment}</span>
              </div>
            </div>{' '}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Recent Recovery Tests</CardTitle>
          <CardDescription>
            Results from backup recovery testing in isolated environments
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <div className="grid grid-cols-12 p-3 bg-slate-50 dark:bg-slate-800 text-sm font-medium">
              <div className="col-span-4">Backup</div>
              <div className="col-span-3">Test Date</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2">Time Taken</div>
              <div className="col-span-1">Details</div>
            </div>

            {recoveryHistory.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                No recovery tests have been run yet
              </div>
            ) : (
              <div className="divide-y">
                {recoveryHistory.map((test) => {
                  const backup = backups.find((b) => b.id === test.backupId)

                  return (
                    <div key={test.id}>
                      <div
                        className={`grid grid-cols-12 p-3 text-sm items-center`}
                      >
                        <div className="col-span-4 truncate">
                          {backup ? (
                            <>
                              <span className="font-medium">{backup.type}</span>{' '}
                              -{' '}
                              {new Date(backup.timestamp).toLocaleDateString()}
                            </>
                          ) : (
                            <span className="text-gray-500">
                              Unknown backup
                            </span>
                          )}
                        </div>

                      <div className="col-span-3">
                        {formatDate(test.testDate)}
                      </div>

                      <div className="col-span-2">
                        {renderStatusBadge(test.status)}
                      </div>

                      <div className="col-span-2">
                        {formatDuration(test.timeTaken)}
                      </div>

                      <div className="col-span-1 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSelectTest(test.id)}
                        >
                          {selectedTest === test.id ? 'Hide' : 'View'}
                        </Button>
                      </div>
                    </div>

                    {selectedTest === test.id && (
                      <div className="col-span-12 p-3 bg-slate-50 dark:bg-slate-800 mt-1 rounded-md">
                        <h4 className="font-medium mb-2">Test Results</h4>

                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <h5 className="text-xs text-gray-500 dark:text-gray-400">
                                Environment
                              </h5>
                              <p className="text-sm">{test.environment}</p>
                            </div>
                            <div>
                              <h5 className="text-xs text-gray-500 dark:text-gray-400">
                                Test ID
                              </h5>
                              <p className="text-sm font-mono text-xs">
                                {test.id}
                              </p>
                            </div>
                          </div>

                          {test.verificationResults &&
                            test.verificationResults.length > 0 && (
                              <div className="mt-3">
                                <h5 className="text-sm font-medium mb-2">
                                  Verification Results
                                </h5>
                                <div className="rounded-md border divide-y">
                                  {test.verificationResults.map((vr, idx) => (
                                    <div
                                      key={`vr-${vr.testCase}-${vr.id || idx}`}
                                      className="p-2 flex justify-between items-center"
                                    >
                                      <div>
                                        <span className="font-medium">
                                          {vr.testCase}
                                        </span>
                                        <Badge
                                          variant="outline"
                                          className={`
                                            ${vr.status === 'critical' ? 'bg-red-100 text-red-800' : ''}
                                            ${vr.status === 'high' ? 'bg-orange-100 text-orange-800' : ''}
                                            ${vr.status === 'medium' ? 'bg-yellow-100 text-yellow-800' : ''}
                                            ${vr.status === 'low' ? 'bg-blue-100 text-blue-800' : ''}
                                          `}
                                        >
                                          {vr.status}
                                        </Badge>
                                      </div>
                                      <p className="text-sm mt-1">
                                        {vr.description}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default BackupRecoveryTab
