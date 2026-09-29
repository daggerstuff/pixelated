import { useState, type FC } from 'react'

import { Badge } from '@/components/ui/badge/index'
import { Button } from '@/components/ui/button/index'
import {
  Card,
  CardHeader,
  CardContent,
  CardTitle,
  CardDescription,
} from '@/components/ui/card/index'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from '@/components/ui/toast'
import type { VerificationResult } from '@/types/backup'

import type { BackupType, BackupStatus } from '../../../lib/security/backup'
import { RecoveryTestStatus } from '../../../lib/security/backup/backup-types'

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
  verificationResults?: VerificationResult[]
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
        <Badge
          variant="outline"
          className="border border-input bg-secondary text-foreground"
        >
          Passed
        </Badge>
      )
    case RecoveryTestStatus.FAILED:
      return <Badge variant="destructive">Failed</Badge>
    case RecoveryTestStatus.IN_PROGRESS:
      return (
        <Badge
          variant="outline"
          className="border border-input bg-secondary text-foreground"
        >
          In Progress
        </Badge>
      )
    case RecoveryTestStatus.NOT_STARTED: {
      throw new Error(
        'Not implemented yet: RecoveryTestStatus.NOT_STARTED case',
      )
    }
    case RecoveryTestStatus.SKIPPED: {
      throw new Error('Not implemented yet: RecoveryTestStatus.SKIPPED case')
    }
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

      const data = (await response.json()) as { error?: string } & RecoveryTest

      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to run recovery test.')
      }

      setLatestTestResult(data)
      setRecoveryHistory([data, ...recoveryHistory])
      toast.success('Recovery test completed successfully!')
    } catch (error: unknown) {
      // Type guard to safely access String(error)
      const errorMessage =
        error instanceof Error
          ? String(error)
          : typeof error === 'object' && error !== null && 'message' in error
            ? String(error.message)
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
    (b) =>
      b.status === ('completed' as BackupStatus) ||
      b.status === ('verified' as BackupStatus),
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
                className="block text-sm font-medium text-foreground"
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
                className="block text-sm font-medium text-foreground"
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
          <div className="rounded-none border">
            <div className="grid grid-cols-12 bg-secondary p-3 text-sm font-medium">
              <div className="col-span-4">Backup</div>
              <div className="col-span-3">Test Date</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2">Time Taken</div>
              <div className="col-span-1">Details</div>
            </div>

            {recoveryHistory.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                No recovery tests have been run yet
              </div>
            ) : (
              <div className="divide-y">
                {recoveryHistory.map((test) => {
                  const backup = backups.find((b) => b.id === test.backupId)

                  return (
                    <div key={test.id}>
                      <div
                        className={`grid grid-cols-12 items-center p-3 text-sm`}
                      >
                        <div className="col-span-4 truncate">
                          {backup ? (
                            <>
                              <span className="font-medium">{backup.type}</span>{' '}
                              -{' '}
                              {new Date(backup.timestamp).toLocaleDateString()}
                            </>
                          ) : (
                            <span className="text-muted-foreground">
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
                        <div className="col-span-12 mt-1 rounded-none bg-secondary p-3">
                          <h4 className="mb-2 font-medium">Test Results</h4>

                          <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <h5 className="text-xs text-muted-foreground">
                                  Environment
                                </h5>
                                <p className="text-sm">{test.environment}</p>
                              </div>
                              <div>
                                <h5 className="text-xs text-muted-foreground">
                                  Test ID
                                </h5>
                                <p className="font-mono text-sm text-xs">
                                  {test.id}
                                </p>
                              </div>
                            </div>

                            {test.verificationResults &&
                              test.verificationResults.length > 0 && (
                                <div className="mt-3">
                                  <h5 className="mb-2 text-sm font-medium">
                                    Verification Results
                                  </h5>
                                  <div className="divide-y rounded-none border">
                                    {test.verificationResults.map((vr, idx) => (
                                      <div
                                        key={`vr-${vr.testCase}-${vr.id ?? idx}`}
                                        className="flex items-center justify-between p-2"
                                      >
                                        <div>
                                          <span className="font-medium">
                                            {vr.testCase}
                                          </span>
                                          <Badge
                                            variant="outline"
                                            className={` ${vr.status === 'critical' ? 'border border-ring bg-card font-semibold text-foreground' : ''} ${vr.status === 'high' ? 'border border-ring bg-secondary font-medium text-foreground' : ''} ${vr.status === 'medium' ? 'border border-ring bg-secondary text-foreground' : ''} ${vr.status === 'low' ? 'border border-input bg-secondary text-foreground' : ''} `}
                                          >
                                            {vr.status}
                                          </Badge>
                                        </div>
                                        <p className="mt-1 text-sm">
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
