import { BackupService } from '../src/lib/services/backup'

async function testBackupSystem() {
  try {
    // Initialize backup service
    const backupService = BackupService.getInstance()
    await backupService.initialize()

    // Create a full backup
    const fullBackupId = await backupService.createBackup('full')

    // Create an incremental backup

    // List all backups

    // Verify backups

    // Get backup metrics

    // Test restoration
    await backupService.restoreBackup(fullBackupId)

    // Clean up old backups
    await backupService.cleanupOldBackups()
  } catch (error) {
    console.error(error)
    process.exit(1)
  }
}

testBackupSystem()
