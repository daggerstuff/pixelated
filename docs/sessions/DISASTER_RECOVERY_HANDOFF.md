# Disaster Recovery & Server Transition Handoff

## 1. Server Transition Checklist
- [ ] Confirm new server has been provisioned with matching OS and hardware specs.
- [ ] Ensure all required dependencies (Docker, Node.js, Python, PostgreSQL, Redis, **rclone**) are installed on the new server.
- [ ] Setup matching environment variables (`.env`) on the new server.
- [ ] Configure rclone with the `drive` remote targeting the `pixel-data` bucket/folder.
- [ ] Sync final backups from Google Drive to the new server using `rclone`.
- [ ] Restore database, Redis, application data, and monitoring data on the new server.
- [ ] Verify application health and data integrity.
- [ ] Update DNS records to point to the new server IP.
- [ ] Monitor logs for 24 hours post-migration.

## 2. Backup Strategy
- **Full Data Backup:** Daily at 2:00 AM. Includes PostgreSQL, Redis, application data (uploads, config), and monitoring data.
- **Incremental Source Backup:** Every 6 hours via `rclone-nightly-backup.sh`. Captures the current state of the codebase (excluding `node_modules`, `.git`, etc.) and syncs it to the `drive` remote in `backups/pixelated/`.
- **Offsite Storage:** All backups are securely synced to Google Drive (`pixel-data` bucket/folder) via `rclone`.
- **Retention Policy:** 30 days locally and on Google Drive for full backups; 2 most recent snapshots for source backups. Older backups are automatically pruned by the cleanup routine.

## 3. Automated Verification
- Nightly backups are automatically verified locally using integrity checks (`gzip -t`, `tar -tzf`).
- Monthly (or on-demand) deep verification via `scripts/backup/verify-backups.sh` downloads the latest backups from Google Drive to guarantee the offsite copies are intact and uncorrupted.

## 4. Disaster Recovery Plan (Restoration)
If the server suffers a catastrophic failure, follow these steps to restore:

1. **Prepare Environment:**
   Install required services and fetch the latest backup from Google Drive:
   ```bash
   rclone copy drive:pixel-data/backups/ . --progress
   ```

2. **Restore Application & DB Data:**
   Run the restore command providing the timestamp of the backup:
   ```bash
   ./scripts/backup/backup-system.sh restore <YYYYMMDD_HHMMSS>
   ```
   *This command unzips the DB backup and pipes it to psql, and untars the application data.*

3. **Verify Integrity:**
   Ensure the database tables are populated and uploaded files exist in the `/uploads` directory.

4. **Rollback (If Deployment Failed):**
   If a deployment caused the issue, use the backup manager's rollback feature:
   ```bash
   ./scripts/backup/backup_manager.sh rollback all
   ```
   Then execute the generated rollback script located in `/tmp/`.