import React, { useState } from 'react'
import { FC, Button } from '@/components/ui/button'
import {
  Card,
  CardHeader,
  CardContent,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { FC, Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FC, Label } from '@/components/ui/label'
import type { BackupType } from '../../../lib/security/backup/types'
import { FC, StorageLocation } from '../../../lib/security/backup/backup-types'
import { FC, Switch } from '@/components/ui/switch'

interface BackupTypeConfig {
  schedule: string
  retention: number
}

interface StorageLocationConfig {
  provider: string
  bucket?: string
  region?: string
  [key: string]: string | number | boolean | undefined
}

interface BackupConfig {
  backupTypes: { [key in BackupType]?: BackupTypeConfig }

  storageLocations: { [key in StorageLocation]?: StorageLocationConfig }

  encryption: {
    algorithm: string
    keyRotationDays: number
  }
}

interface BackupConfigurationTabProps {
  config: BackupConfig
  onUpdateConfig: (config: BackupConfig) => void
}

const BackupConfigurationTab: FC<BackupConfigurationTabProps> = ({
  config,
  onUpdateConfig,
}) => {
  const [formState, setFormState] = useState<BackupConfig>({ ...config })
  const [isEditing, setIsEditing] = useState(false)
  const [backupEnabled, setBackupEnabled] = useState(true)
  const [encryptBackups, setEncryptBackups] = useState(true)
  const [frequency, setFrequency] = useState('daily')
  const [retention, setRetention] = useState('30')
  const [saving, setSaving] = useState(false)

  const handleChange = (
    section: 'backupTypes' | 'storageLocations' | 'encryption',
    key: string,
    field: string,
    value: string | number,
  ) => {
    if (section === 'backupTypes') {
      setFormState({
        ...formState,
        backupTypes: {
          ...formState.backupTypes,
          [key]: {
            ...formState.backupTypes[key as BackupType],
            [field]: field === 'retention' ? Number(value) : value,
          },
        },
      })
    } else if (section === 'storageLocations') {
      setFormState({
        ...formState,
        storageLocations: {
          ...formState.storageLocations,
          [key]: {
            ...formState.storageLocations[key as StorageLocation],
            [field]: value,
          },
        },
      })
    } else if (section === 'encryption') {
      setFormState({
        ...formState,
        encryption: {
          ...formState.encryption,
          [field]: field === 'keyRotationDays' ? Number(value) : value,
        },
      })
    }
  }

  const handleSave = () => {
    // Validate form data
    if (!validateConfig()) {
      alert('Please fix the validation errors before saving')
      return
    }

    onUpdateConfig(formState)
    setIsEditing(false)
  }

  const validateConfig = (): boolean => {
    // Validate backup types
    for (const type in formState.backupTypes) {
      const backupConfig = formState.backupTypes[type as BackupType]
      if (!backupConfig) {
        continue
      }

      // Validate cron expression (simplified validation)
      if (!backupConfig.schedule || !backupConfig.schedule.includes('*')) {
        return false
      }

      // Validate retention period
      if (backupConfig.retention <= 0) {
        return false
      }
    }

    // Validate storage locations
    for (const location in formState.storageLocations) {
      const storageConfig =
        formState.storageLocations[location as StorageLocation]
      if (!storageConfig) {
        continue
      }

      // Validate provider
      if (!storageConfig.provider) {
        return false
      }

      // Validate bucket for cloud providers
      if (
        ['aws-s3', 'google-cloud-storage'].includes(storageConfig.provider) &&
        !storageConfig.bucket
      ) {
        return false
      }
    }

    // Validate encryption settings
    if (!formState.encryption.algorithm) {
      return false
    }

    if (formState.encryption.keyRotationDays <= 0) {
      return false
    }

    return true
  }

  const handleCancel = () => {
    setFormState({ ...config })
    setIsEditing(false)
  }

  const handleSaveConfig = async () => {
    setSaving(true)
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500))
    setSaving(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Backup Configuration</h2>
        {!isEditing ? (
          <Button onClick={() => setIsEditing(true)}>Edit Configuration</Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Save Configuration</Button>
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Backup Settings</CardTitle>
          <CardDescription>
            Configure automated backups and encryption
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">Enable Automated Backups</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Automatically backup your data according to the schedule
                </p>
              </div>
              <Switch
                checked={backupEnabled}
                onCheckedChange={setBackupEnabled}
                aria-label="Enable automated backups"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">Encrypt Backups</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Enable end-to-end encryption for all backup data
                </p>
              </div>
              <Switch
                checked={encryptBackups}
                onCheckedChange={setEncryptBackups}
                aria-label="Encrypt backups"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label
                  htmlFor="backup-frequency"
                  className="block text-sm font-medium mb-2"
                >
                  Backup Frequency
                </label>
                <Select value={frequency} onValueChange={setFrequency}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hourly">Hourly</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label
                  htmlFor="retention-period"
                  className="block text-sm font-medium mb-2"
                >
                  Retention Period (Days)
                </label>
                <Select value={retention} onValueChange={setRetention}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">7 days</SelectItem>
                    <SelectItem value="14">14 days</SelectItem>
                    <SelectItem value="30">30 days</SelectItem>
                    <SelectItem value="90">90 days</SelectItem>
                    <SelectItem value="365">365 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Storage Locations</CardTitle>
          <CardDescription>Configure where backups are stored</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Primary Storage Location */}
            <div>
              <h4 className="font-medium mb-2">Primary Storage</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="primary-provider">Storage Provider</Label>
                  <Select
                    disabled={!isEditing}
                    value={
                      formState.storageLocations[StorageLocation.PRIMARY]
                        ?.provider || ''
                    }
                    onValueChange={(value) =>
                      handleChange(
                        'storageLocations',
                        StorageLocation.PRIMARY,
                        'provider',
                        value,
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="aws-s3">AWS S3</SelectItem>
                      <SelectItem value="google-cloud-storage">
                        Google Cloud Storage
                      </SelectItem>
                      <SelectItem value="local-filesystem">
                        Local Filesystem
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="primary-bucket">Bucket/Container Name</Label>
                  <Input
                    id="primary-bucket"
                    value={
                      formState.storageLocations[StorageLocation.PRIMARY]
                        ?.bucket || ''
                    }
                    onChange={(e) =>
                      handleChange(
                        'storageLocations',
                        StorageLocation.PRIMARY,
                        'bucket',
                        e.target.value,
                      )
                    }
                    disabled={!isEditing}
                  />
                </div>
                <div>
                  <Label htmlFor="primary-region">Region</Label>
                  <Input
                    id="primary-region"
                    value={
                      formState.storageLocations[StorageLocation.PRIMARY]
                        ?.region || ''
                    }
                    onChange={(e) =>
                      handleChange(
                        'storageLocations',
                        StorageLocation.PRIMARY,
                        'region',
                        e.target.value,
                      )
                    }
                    disabled={!isEditing}
                  />
                </div>
              </div>
            </div>

            {/* Secondary Storage Location */}
            <div>
              <h4 className="font-medium mb-2">Secondary Storage (Optional)</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="secondary-provider">Storage Provider</Label>
                  <Select
                    disabled={!isEditing}
                    value={
                      formState.storageLocations[StorageLocation.SECONDARY]
                        ?.provider || ''
                    }
                    onValueChange={(value) =>
                      handleChange(
                        'storageLocations',
                        StorageLocation.SECONDARY,
                        'provider',
                        value,
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="aws-s3">AWS S3</SelectItem>
                      <SelectItem value="google-cloud-storage">
                        Google Cloud Storage
                      </SelectItem>
                      <SelectItem value="local-filesystem">
                        Local Filesystem
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="secondary-bucket">
                    Bucket/Container Name
                  </Label>
                  <Input
                    id="secondary-bucket"
                    value={
                      formState.storageLocations[StorageLocation.SECONDARY]
                        ?.bucket || ''
                    }
                    onChange={(e) =>
                      handleChange(
                        'storageLocations',
                        StorageLocation.SECONDARY,
                        'bucket',
                        e.target.value,
                      )
                    }
                    disabled={!isEditing}
                  />
                </div>
                <div>
                  <Label htmlFor="secondary-region">Region</Label>
                  <Input
                    id="secondary-region"
                    value={
                      formState.storageLocations[StorageLocation.SECONDARY]
                        ?.region || ''
                    }
                    onChange={(e) =>
                      handleChange(
                        'storageLocations',
                        StorageLocation.SECONDARY,
                        'region',
                        e.target.value,
                      )
                    }
                    disabled={!isEditing}
                  />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Encryption Settings</CardTitle>
          <CardDescription>
            Configure how backup data is encrypted
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="encryption-algorithm">Encryption Algorithm</Label>
              <Select
                disabled={!isEditing}
                value={formState.encryption.algorithm}
                onValueChange={(value) =>
                  handleChange('encryption', '', 'algorithm', value)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AES-256-GCM">
                    AES-256-GCM (Recommended)
                  </SelectItem>
                  <SelectItem value="AES-256-CBC">AES-256-CBC</SelectItem>
                  <SelectItem value="ChaCha20-Poly1305">
                    ChaCha20-Poly1305
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="key-rotation">Key Rotation Period (days)</Label>
              <Input
                id="key-rotation"
                type="number"
                value={formState.encryption.keyRotationDays}
                onChange={(e) =>
                  handleChange(
                    'encryption',
                    '',
                    'keyRotationDays',
                    e.target.value,
                  )
                }
                disabled={!isEditing}
                min="1"
              />

              <p className="text-xs text-gray-500 mt-1">Recommended: 90 days</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSaveConfig} disabled={saving}>
          {saving ? 'Saving...' : 'Save Configuration'}
        </Button>
      </div>
    </div>
  )
}

export default BackupConfigurationTab
