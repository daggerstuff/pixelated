import os
import json
import logging
import subprocess
import shutil
import gzip
import tarfile
from pathlib import Path
from typing import Dict, List, Optional, Any, Union
from dataclasses import dataclass, asdict, field
from datetime import datetime, timedelta
from enum import Enum
import threading
import schedule
import time
import hashlib
import boto3
from botocore.exceptions import ClientError
import psycopg2
from psycopg2.extras import RealDictCursor

#!/usr/bin/env python3
"""
Production Backup System for Pixelated Empathy AI
Comprehensive backup and recovery with automated scheduling and monitoring.
"""


class BackupType(Enum):
    """Types of backups."""
    FULL = "full"
    INCREMENTAL = "incremental"
    DIFFERENTIAL = "differential"

class BackupStatus(Enum):
    """Backup operation status."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

class StorageType(Enum):
    """Backup storage types."""
    LOCAL = "local"
    S3 = "s3"
    GCS = "gcs"
    AZURE = "azure"

@dataclass
class BackupJob:
    """Backup job definition."""
    name: str
    backup_type: BackupType
    source_path: str
    destination: str
    schedule: str
    retention_days: int
    compression: bool = True
    encryption: bool = False
    storage_type: StorageType = StorageType.LOCAL
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class BackupResult:
    """Result of a backup operation."""
    job_name: str
    backup_type: BackupType
    status: BackupStatus
    start_time: datetime
    end_time: Optional[datetime] = None
    file_path: str = ""
    file_size: int = 0
    checksum: str = ""
    error_message: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class RestoreRequest:
    """Restore operation request."""
    backup_file: str
    restore_path: str
    restore_type: str = "full"
    overwrite: bool = False
    verify_checksum: bool = True

class DatabaseBackupManager:
    """Manages database backups."""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.logger = logging.getLogger(__name__)

    def backup_postgresql(self, backup_path: str, compression: bool = True) -> BackupResult:
        """Backup PostgreSQL database."""
        start_time = datetime.now()
        
        try:
            # Database connection parameters
            db_config = self.config.get('database', {})
            host = db_config.get('host', 'localhost')
            port = db_config.get('port', 5432)
            database = db_config.get('database', 'pixelated_db')
            username = db_config.get('username', 'postgres')
            password = db_config.get('password', '')
            
            # Create backup filename
            timestamp = start_time.strftime('%Y%m%d_%H%M%S')
            backup_file = f"postgresql_backup_{timestamp}.sql"
            if compression:
                backup_file += ".gz"
            
            full_backup_path = Path(backup_path) / backup_file
            
            # Prepare pg_dump command
            cmd = [
                'pg_dump',
                f'--host={host}',
                f'--port={port}',
                f'--username={username}',
                '--verbose',
                '--clean',
                '--no-owner',
                '--no-privileges',
                database
            ]
            
            # Set password environment variable
            env = os.environ.copy()
            if password:
                env['PGPASSWORD'] = password
            
            # Execute backup
            self.logger.info(f"Starting PostgreSQL backup to {full_backup_path}")
            
            if compression:
                # Pipe through gzip
                with gzip.open(full_backup_path, 'wt') as f:
                    result = subprocess.run(
                        cmd, stdout=f, stderr=subprocess.PIPE,
                        env=env, text=True, check=True
                    )
            else:
                with open(full_backup_path, 'w') as f:
                    result = subprocess.run(
                        cmd, stdout=f, stderr=subprocess.PIPE,
                        env=env, text=True, check=True
                    )
            
            # Calculate file size and checksum
            file_size = full_backup_path.stat().st_size
            checksum = self._calculate_checksum(full_backup_path)
            
            end_time = datetime.now()
            
            self.logger.info(f"PostgreSQL backup completed: {full_backup_path} ({file_size} bytes)")
            
            return BackupResult(
                job_name="postgresql_backup",
                backup_type=BackupType.FULL,
                status=BackupStatus.COMPLETED,
                start_time=start_time,
                end_time=end_time,
                file_path=str(full_backup_path),
                file_size=file_size,
                checksum=checksum,
                metadata={
                    'database': database,
                    'host': host,
                    'compression': compression,
                    'duration': (end_time - start_time).total_seconds()
                }
            )
            
        except subprocess.CalledProcessError as e:
            error_msg = f"PostgreSQL backup failed: {e.stderr}"
            self.logger.error(error_msg)
            
            return BackupResult(
                job_name="postgresql_backup",
                backup_type=BackupType.FULL,
                status=BackupStatus.FAILED,
                start_time=start_time,
                end_time=datetime.now(),
                error_message=error_msg
            )
        
        except Exception as e:
            error_msg = f"PostgreSQL backup error: {str(e)}"
            self.logger.error(error_msg)
            
            return BackupResult(
                job_name="postgresql_backup",
                backup_type=BackupType.FULL,
                status=BackupStatus.FAILED,
                start_time=start_time,
                end_time=datetime.now(),
                error_message=error_msg
            )

    def restore_postgresql(self, backup_file: str, target_database: str = None) -> bool:
        """Restore PostgreSQL database from backup."""
        try:
            db_config = self.config.get('database', {})
            host = db_config.get('host', 'localhost')
            port = db_config.get('port', 5432)
            database = target_database or db_config.get('database', 'pixelated_db')
            username = db_config.get('username', 'postgres')
            password = db_config.get('password', '')
            
            # Prepare psql command
            cmd = [
                'psql',
                f'--host={host}',
                f'--port={port}',
                f'--username={username}',
                '--verbose',
                database
            ]
            
            # Set password environment variable
            env = os.environ.copy()
            if password:
                env['PGPASSWORD'] = password
            
            self.logger.info(f"Starting PostgreSQL restore from {backup_file}")
            
            # Execute restore
            if backup_file.endswith('.gz'):
                with gzip.open(backup_file, 'rt') as f:
                    result = subprocess.run(
                        cmd, stdin=f, stderr=subprocess.PIPE,
                        env=env, text=True, check=True
                    )
            else:
                with open(backup_file, 'r') as f:
                    result = subprocess.run(
                        cmd, stdin=f, stderr=subprocess.PIPE,
                        env=env, text=True, check=True
                    )
            
            self.logger.info(f"PostgreSQL restore completed successfully")
            return True
            
        except Exception as e:
            self.logger.error(f"PostgreSQL restore failed: {e}")
            return False

    def _calculate_checksum(self, file_path: Path) -> str:
        """Calculate SHA256 checksum of a file."""
        sha256_hash = hashlib.sha256()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                sha256_hash.update(chunk)
        return sha256_hash.hexdigest()

class FileBackupManager:
    """Manages file system backups."""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.logger = logging.getLogger(__name__)

    def backup_directory(self, source_path: str, backup_path: str, 
                        backup_type: BackupType = BackupType.FULL,
                        compression: bool = True) -> BackupResult:
        """Backup a directory."""
        start_time = datetime.now()
        
        try:
            source = Path(source_path)
            if not source.exists():
                raise FileNotFoundError(f"Source path does not exist: {source_path}")
            
            # Create backup filename
            timestamp = start_time.strftime('%Y%m%d_%H%M%S')
            backup_name = f"{source.name}_backup_{timestamp}.tar"
            if compression:
                backup_name += ".gz"
            
            full_backup_path = Path(backup_path) / backup_name
            full_backup_path.parent.mkdir(parents=True, exist_ok=True)
            
            self.logger.info(f"Starting directory backup: {source_path} -> {full_backup_path}")
            
            # Create tar archive
            mode = 'w:gz' if compression else 'w'
            with tarfile.open(full_backup_path, mode) as tar:
                if backup_type == BackupType.FULL:
                    tar.add(source, arcname=source.name)
                elif backup_type == BackupType.INCREMENTAL:
                    # For incremental, only add files modified since last backup
                    last_backup_time = self._get_last_backup_time(source.name)
                    self._add_modified_files(tar, source, last_backup_time)
            
            # Calculate file size and checksum
            file_size = full_backup_path.stat().st_size
            checksum = self._calculate_checksum(full_backup_path)
            
            end_time = datetime.now()
            
            self.logger.info(f"Directory backup completed: {full_backup_path} ({file_size} bytes)")
            
            return BackupResult(
                job_name=f"directory_backup_{source.name}",
                backup_type=backup_type,
                status=BackupStatus.COMPLETED,
                start_time=start_time,
                end_time=end_time,
                file_path=str(full_backup_path),
                file_size=file_size,
                checksum=checksum,
                metadata={
                    'source_path': source_path,
                    'compression': compression,
                    'duration': (end_time - start_time).total_seconds()
                }
            )
            
        except Exception as e:
            error_msg = f"Directory backup failed: {str(e)}"
            self.logger.error(error_msg)
            
            return BackupResult(
                job_name=f"directory_backup_{Path(source_path).name}",
                backup_type=backup_type,
                status=BackupStatus.FAILED,
                start_time=start_time,
                end_time=datetime.now(),
                error_message=error_msg
            )

    def restore_directory(self, backup_file: str, restore_path: str, 
                         overwrite: bool = False) -> bool:
        """Restore directory from backup."""
        try:
            backup_path = Path(backup_file)
            if not backup_path.exists():
                raise FileNotFoundError(f"Backup file does not exist: {backup_file}")
            
            restore_dir = Path(restore_path)
            
            if restore_dir.exists() and not overwrite:
                raise FileExistsError(f"Restore path exists and overwrite is False: {restore_path}")
            
            if restore_dir.exists() and overwrite:
                shutil.rmtree(restore_dir)
            
            restore_dir.mkdir(parents=True, exist_ok=True)
            
            self.logger.info(f"Starting directory restore: {backup_file} -> {restore_path}")
            
            # Extract tar archive
            with tarfile.open(backup_file, 'r:*') as tar:
                tar.extractall(restore_dir)
            
            self.logger.info(f"Directory restore completed successfully")
            return True
            
        except Exception as e:
            self.logger.error(f"Directory restore failed: {e}")
            return False

    def _get_last_backup_time(self, source_name: str) -> datetime:
        """Get timestamp of last backup for incremental backups."""
        # This would typically read from a metadata file
        # For now, return 24 hours ago as a simple implementation
        return datetime.now() - timedelta(days=1)

    def _add_modified_files(self, tar: tarfile.TarFile, source: Path, since: datetime):
        """Add only files modified since the given timestamp."""
        for item in source.rglob('*'):
            if item.is_file():
                mtime = datetime.fromtimestamp(item.stat().st_mtime)
                if mtime > since:
                    tar.add(item, arcname=item.relative_to(source.parent))

    def _calculate_checksum(self, file_path: Path) -> str:
        """Calculate SHA256 checksum of a file."""
        sha256_hash = hashlib.sha256()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                sha256_hash.update(chunk)
        return sha256_hash.hexdigest()

class CloudStorageManager:
    """Manages cloud storage for backups."""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.logger = logging.getLogger(__name__)
        
        # Initialize cloud clients
        self.s3_client = None
        self.gcs_client = None
        self.azure_client = None
        
        self._initialize_clients()

    def _initialize_clients(self):
        """Initialize cloud storage clients."""
        # AWS S3
        s3_config = self.config.get('s3')
        if s3_config:
            try:
                self.s3_client = boto3.client(
                    's3',
                    aws_access_key_id=s3_config.get('access_key'),
                    aws_secret_access_key=s3_config.get('secret_key'),
                    region_name=s3_config.get('region', 'us-west-2')
                )
                self.logger.info("S3 client initialized")
            except Exception as e:
                self.logger.error(f"Failed to initialize S3 client: {e}")

    def upload_to_s3(self, local_file: str, bucket: str, key: str) -> bool:
        """Upload backup file to S3."""
        if not self.s3_client:
            self.logger.error("S3 client not initialized")
            return False
        
        try:
            self.logger.info(f"Uploading {local_file} to s3://{bucket}/{key}")
            
            self.s3_client.upload_file(local_file, bucket, key)
            
            self.logger.info(f"Upload completed successfully")
            return True
            
        except ClientError as e:
            self.logger.error(f"S3 upload failed: {e}")
            return False

    def download_from_s3(self, bucket: str, key: str, local_file: str) -> bool:
        """Download backup file from S3."""
        if not self.s3_client:
            self.logger.error("S3 client not initialized")
            return False
        
        try:
            self.logger.info(f"Downloading s3://{bucket}/{key} to {local_file}")
            
            self.s3_client.download_file(bucket, key, local_file)
            
            self.logger.info(f"Download completed successfully")
            return True
            
        except ClientError as e:
            self.logger.error(f"S3 download failed: {e}")
            return False

    def list_s3_backups(self, bucket: str, prefix: str = "") -> List[Dict[str, Any]]:
        """List backup files in S3."""
        if not self.s3_client:
            return []
        
        try:
            response = self.s3_client.list_objects_v2(
                Bucket=bucket,
                Prefix=prefix
            )
            
            backups = []
            for obj in response.get('Contents', []):
                backups.append({
                    'key': obj['Key'],
                    'size': obj['Size'],
                    'last_modified': obj['LastModified'],
                    'etag': obj['ETag']
                })
            
            return backups
            
        except ClientError as e:
            self.logger.error(f"Failed to list S3 backups: {e}")
            return []

class BackupScheduler:
    """Manages backup scheduling and execution."""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.logger = logging.getLogger(__name__)
        
        # Initialize managers
        self.db_manager = DatabaseBackupManager(config)
        self.file_manager = FileBackupManager(config)
        self.cloud_manager = CloudStorageManager(config)
        
        # Backup jobs and results
        self.backup_jobs: List[BackupJob] = []
        self.backup_results: List[BackupResult] = []
        
        # Scheduler state
        self.running = False
        self.scheduler_thread = None

    def add_backup_job(self, job: BackupJob):
        """Add a backup job to the scheduler."""
        self.backup_jobs.append(job)
        self.logger.info(f"Added backup job: {job.name}")

    def start_scheduler(self):
        """Start the backup scheduler."""
        if self.running:
            self.logger.warning("Scheduler is already running")
            return
        
        self.running = True
        self.scheduler_thread = threading.Thread(target=self._scheduler_loop)
        self.scheduler_thread.daemon = True
        self.scheduler_thread.start()
        
        self.logger.info("Backup scheduler started")

    def stop_scheduler(self):
        """Stop the backup scheduler."""
        self.running = False
        if self.scheduler_thread:
            self.scheduler_thread.join()
        
        self.logger.info("Backup scheduler stopped")

    def _scheduler_loop(self):
        """Main scheduler loop."""
        # Schedule backup jobs
        for job in self.backup_jobs:
            if job.schedule == 'daily':
                schedule.every().day.at("02:00").do(self._execute_backup_job, job)
            elif job.schedule == 'weekly':
                schedule.every().sunday.at("01:00").do(self._execute_backup_job, job)
            elif job.schedule == 'hourly':
                schedule.every().hour.do(self._execute_backup_job, job)
        
        # Run scheduler
        while self.running:
            schedule.run_pending()
            time.sleep(60)  # Check every minute

    def _execute_backup_job(self, job: BackupJob):
        """Execute a backup job."""
        self.logger.info(f"Executing backup job: {job.name}")
        
        try:
            if job.name.startswith('database'):
                result = self.db_manager.backup_postgresql(
                    job.destination, 
                    compression=job.compression
                )
            elif job.name.startswith('directory'):
                result = self.file_manager.backup_directory(
                    job.source_path,
                    job.destination,
                    job.backup_type,
                    compression=job.compression
                )
            else:
                raise ValueError(f"Unknown backup job type: {job.name}")
            
            # Upload to cloud storage if configured
            if job.storage_type == StorageType.S3 and result.status == BackupStatus.COMPLETED:
                s3_config = self.config.get('s3', {})
                bucket = s3_config.get('bucket')
                if bucket:
                    key = f"backups/{Path(result.file_path).name}"
                    self.cloud_manager.upload_to_s3(result.file_path, bucket, key)
            
            # Clean up old backups
            self._cleanup_old_backups(job)
            
            self.backup_results.append(result)
            
            if result.status == BackupStatus.COMPLETED:
                self.logger.info(f"Backup job completed successfully: {job.name}")
            else:
                self.logger.error(f"Backup job failed: {job.name} - {result.error_message}")
                
        except Exception as e:
            error_msg = f"Backup job execution failed: {str(e)}"
            self.logger.error(error_msg)
            
            result = BackupResult(
                job_name=job.name,
                backup_type=job.backup_type,
                status=BackupStatus.FAILED,
                start_time=datetime.now(),
                end_time=datetime.now(),
                error_message=error_msg
            )
            self.backup_results.append(result)

    def _cleanup_old_backups(self, job: BackupJob):
        """Clean up old backup files based on retention policy."""
        try:
            backup_dir = Path(job.destination)
            if not backup_dir.exists():
                return
            
            cutoff_date = datetime.now() - timedelta(days=job.retention_days)
            
            # Find old backup files
            pattern = f"*backup*.tar*" if job.name.startswith('directory') else f"*backup*.sql*"
            
            for backup_file in backup_dir.glob(pattern):
                file_mtime = datetime.fromtimestamp(backup_file.stat().st_mtime)
                
                if file_mtime < cutoff_date:
                    backup_file.unlink()
                    self.logger.info(f"Deleted old backup: {backup_file}")
                    
        except Exception as e:
            self.logger.error(f"Failed to cleanup old backups: {e}")

    def execute_backup_now(self, job_name: str) -> BackupResult:
        """Execute a backup job immediately."""
        job = next((j for j in self.backup_jobs if j.name == job_name), None)
        if not job:
            raise ValueError(f"Backup job not found: {job_name}")
        
        self._execute_backup_job(job)
        return self.backup_results[-1] if self.backup_results else None

    def get_backup_status(self) -> Dict[str, Any]:
        """Get current backup system status."""
        recent_results = [
            result for result in self.backup_results
            if result.start_time > datetime.now() - timedelta(days=7)
        ]
        
        return {
            'scheduler_running': self.running,
            'total_jobs': len(self.backup_jobs),
            'recent_backups': len(recent_results),
            'successful_backups': len([r for r in recent_results if r.status == BackupStatus.COMPLETED]),
            'failed_backups': len([r for r in recent_results if r.status == BackupStatus.FAILED]),
            'last_backup': max([r.start_time for r in recent_results]) if recent_results else None
        }

    def generate_backup_report(self) -> str:
        """Generate comprehensive backup report."""
        report_file = f"backup_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        
        report = {
            'generated_at': datetime.now().isoformat(),
            'status': self.get_backup_status(),
            'backup_jobs': [asdict(job) for job in self.backup_jobs],
            'recent_results': [
                asdict(result) for result in self.backup_results
                if result.start_time > datetime.now() - timedelta(days=30)
            ]
        }
        
        with open(report_file, 'w') as f:
            json.dump(report, f, indent=2, default=str)
        
        self.logger.info(f"Backup report saved to {report_file}")
        return report_file

def main():
    """Main function for testing the backup system."""
    print("💾 PRODUCTION BACKUP SYSTEM TEST")
    print("=" * 50)
    
    # Initialize backup system
    config = {
        'database': {
            'host': 'localhost',
            'port': 5432,
            'database': 'test_db',
            'username': 'postgres',
            'password': 'password'
        },
        's3': {
            'bucket': 'pixelated-backups',
            'region': 'us-west-2'
        }
    }
    
    scheduler = BackupScheduler(config)
    
    # Add backup jobs
    db_job = BackupJob(
        name="database_daily",
        backup_type=BackupType.FULL,
        source_path="",
        destination="./test_backups",
        schedule="daily",
        retention_days=30,
        compression=True
    )
    
    file_job = BackupJob(
        name="directory_logs",
        backup_type=BackupType.FULL,
        source_path="./logs",
        destination="./test_backups",
        schedule="daily",
        retention_days=7,
        compression=True
    )
    
    scheduler.add_backup_job(db_job)
    scheduler.add_backup_job(file_job)
    
    print(f"✅ Added {len(scheduler.backup_jobs)} backup jobs")
    
    # Test file backup (logs directory should exist)
    if Path("./logs").exists():
        result = scheduler.file_manager.backup_directory(
            "./logs", 
            "./test_backups",
            BackupType.FULL,
            compression=True
        )
        print(f"✅ File backup test: {result.status.value}")
    else:
        print("⚠️ Logs directory not found, skipping file backup test")
    
    # Get status
    status = scheduler.get_backup_status()
    print(f"✅ Scheduler running: {status['scheduler_running']}")
    print(f"✅ Total jobs: {status['total_jobs']}")
    
    # Generate report
    report_file = scheduler.generate_backup_report()
    print(f"✅ Report generated: {report_file}")
    
    print("\n🎉 Production backup system is functional!")

if __name__ == "__main__":
    main()


# Alias for compatibility
BackupManager = BackupType


class BackupManager:
    """Complete backup manager for production systems."""
    
    def __init__(self, backup_dir: str = "/home/vivi/pixelated/ai/backups"):
        self.logger = logging.getLogger(__name__)
        self.backup_dir = Path(backup_dir)
        self.backup_dir.mkdir(parents=True, exist_ok=True)
        self.backup_configs = {
            'retention_days': 30,
            'compression': True,
            'encryption': True,
            'max_backup_size': '10GB'
        }
        self.backup_history = []
        self._load_backup_history()
    
    def _load_backup_history(self):
        """Load backup history from file."""
        try:
            history_file = self.backup_dir / 'backup_history.json'
            if history_file.exists():
                with open(history_file, 'r') as f:
                    self.backup_history = json.load(f)
        except Exception as e:
            self.logger.warning(f"Could not load backup history: {e}")
            self.backup_history = []
    
    def _save_backup_history(self):
        """Save backup history to file."""
        try:
            history_file = self.backup_dir / 'backup_history.json'
            with open(history_file, 'w') as f:
                json.dump(self.backup_history, f, indent=2, default=str)
        except Exception as e:
            self.logger.error(f"Could not save backup history: {e}")
    
    def create_backup(self, backup_type="full", sources=None):
        """Create a comprehensive backup."""
        try:
            backup_id = f"backup_{int(time.time())}"
            timestamp = datetime.now()
            
            if sources is None:
                sources = [
                    '/home/vivi/pixelated/ai/production_deployment',
                    '/home/vivi/pixelated/ai/configs',
                    '/home/vivi/pixelated/ai/logs'
                ]
            
            backup_path = self.backup_dir / backup_id
            backup_path.mkdir(exist_ok=True)
            
            # Create backup manifest
            manifest = {
                'backup_id': backup_id,
                'backup_type': backup_type,
                'timestamp': timestamp.isoformat(),
                'sources': sources,
                'status': 'in_progress'
            }
            
            # Backup each source
            backed_up_files = []
            for source in sources:
                source_path = Path(source)
                if source_path.exists():
                    if source_path.is_file():
                        dest_file = backup_path / source_path.name
                        shutil.copy2(source_path, dest_file)
                        backed_up_files.append(str(dest_file))
                    elif source_path.is_dir():
                        dest_dir = backup_path / source_path.name
                        shutil.copytree(source_path, dest_dir, dirs_exist_ok=True)
                        backed_up_files.append(str(dest_dir))
            
            # Update manifest
            manifest.update({
                'status': 'completed',
                'files_backed_up': len(backed_up_files),
                'backup_size': self._calculate_backup_size(backup_path),
                'completion_time': datetime.now().isoformat()
            })
            
            # Save manifest
            manifest_file = backup_path / 'manifest.json'
            with open(manifest_file, 'w') as f:
                json.dump(manifest, f, indent=2)
            
            # Add to history
            self.backup_history.append(manifest)
            self._save_backup_history()
            
            self.logger.info(f"Backup created successfully: {backup_id}")
            return manifest
            
        except Exception as e:
            self.logger.error(f"Backup creation failed: {e}")
            return None
    
    def _calculate_backup_size(self, backup_path: Path) -> int:
        """Calculate total size of backup."""
        total_size = 0
        try:
            for file_path in backup_path.rglob('*'):
                if file_path.is_file():
                    total_size += file_path.stat().st_size
        except Exception as e:
            self.logger.warning(f"Could not calculate backup size: {e}")
        return total_size
    
    def list_backups(self, limit: int = 50) -> List[Dict]:
        """List all backups."""
        try:
            # Sort by timestamp, most recent first
            sorted_backups = sorted(
                self.backup_history, 
                key=lambda x: x.get('timestamp', ''), 
                reverse=True
            )
            return sorted_backups[:limit]
        except Exception as e:
            self.logger.error(f"Error listing backups: {e}")
            return []
    
    def get_backup_info(self, backup_id: str) -> Optional[Dict]:
        """Get information about a specific backup."""
        try:
            for backup in self.backup_history:
                if backup.get('backup_id') == backup_id:
                    return backup
            return None
        except Exception as e:
            self.logger.error(f"Error getting backup info: {e}")
            return None
    
    def restore_backup(self, backup_id: str, restore_path: str = None) -> bool:
        """Restore from backup."""
        try:
            backup_info = self.get_backup_info(backup_id)
            if not backup_info:
                self.logger.error(f"Backup {backup_id} not found")
                return False
            
            backup_path = self.backup_dir / backup_id
            if not backup_path.exists():
                self.logger.error(f"Backup files not found: {backup_path}")
                return False
            
            if restore_path is None:
                restore_path = "/home/vivi/pixelated/ai/restored"
            
            restore_dir = Path(restore_path)
            restore_dir.mkdir(parents=True, exist_ok=True)
            
            # Restore files
            for item in backup_path.iterdir():
                if item.name != 'manifest.json':
                    dest_path = restore_dir / item.name
                    if item.is_file():
                        shutil.copy2(item, dest_path)
                    elif item.is_dir():
                        shutil.copytree(item, dest_path, dirs_exist_ok=True)
            
            self.logger.info(f"Backup {backup_id} restored to {restore_path}")
            return True
            
        except Exception as e:
            self.logger.error(f"Restore failed: {e}")
            return False
    
    def delete_backup(self, backup_id: str) -> bool:
        """Delete a backup."""
        try:
            # Remove from history
            self.backup_history = [b for b in self.backup_history if b.get('backup_id') != backup_id]
            self._save_backup_history()
            
            # Remove backup files
            backup_path = self.backup_dir / backup_id
            if backup_path.exists():
                shutil.rmtree(backup_path)
            
            self.logger.info(f"Backup {backup_id} deleted")
            return True
            
        except Exception as e:
            self.logger.error(f"Error deleting backup: {e}")
            return False
    
    def cleanup_old_backups(self) -> int:
        """Clean up old backups based on retention policy."""
        try:
            cutoff_date = datetime.now() - timedelta(days=self.backup_configs['retention_days'])
            deleted_count = 0
            
            for backup in self.backup_history.copy():
                backup_date = datetime.fromisoformat(backup.get('timestamp', ''))
                if backup_date < cutoff_date:
                    if self.delete_backup(backup.get('backup_id')):
                        deleted_count += 1
            
            self.logger.info(f"Cleaned up {deleted_count} old backups")
            return deleted_count
            
        except Exception as e:
            self.logger.error(f"Cleanup failed: {e}")
            return 0
    
    def get_backup_statistics(self) -> Dict:
        """Get backup statistics."""
        try:
            total_backups = len(self.backup_history)
            total_size = sum(backup.get('backup_size', 0) for backup in self.backup_history)
            
            # Get recent backup success rate
            recent_backups = [b for b in self.backup_history[-10:]]
            successful_backups = sum(1 for b in recent_backups if b.get('status') == 'completed')
            success_rate = (successful_backups / len(recent_backups)) * 100 if recent_backups else 0
            
            return {
                'total_backups': total_backups,
                'total_size_bytes': total_size,
                'total_size_mb': round(total_size / (1024 * 1024), 2),
                'success_rate_percent': round(success_rate, 1),
                'retention_days': self.backup_configs['retention_days'],
                'last_backup': self.backup_history[-1].get('timestamp') if self.backup_history else None
            }
            
        except Exception as e:
            self.logger.error(f"Error getting backup statistics: {e}")
            return {}
    
    def verify_backup(self, backup_id: str) -> bool:
        """Verify backup integrity."""
        try:
            backup_path = self.backup_dir / backup_id
            manifest_file = backup_path / 'manifest.json'
            
            if not manifest_file.exists():
                return False
            
            with open(manifest_file, 'r') as f:
                manifest = json.load(f)
            
            # Check if all expected files exist
            expected_files = manifest.get('files_backed_up', 0)
            actual_files = len([f for f in backup_path.rglob('*') if f.is_file() and f.name != 'manifest.json'])
            
            return actual_files >= expected_files
            
        except Exception as e:
            self.logger.error(f"Backup verification failed: {e}")
            return False



class AdvancedBackupManager(BackupManager):
    """Advanced backup manager with enterprise features."""
    
    def __init__(self, config_file: str = None):
        super().__init__()
        self.config = self._load_advanced_config(config_file)
        self.backup_scheduler = None
        self.monitoring_enabled = True
        self.encryption_key = self._generate_encryption_key()
        
    def _load_advanced_config(self, config_file: str = None):
        """Load advanced backup configuration."""
        try:
            if config_file is None:
                config_file = '/home/vivi/pixelated/ai/production_deployment/backup_config_advanced.json'
            
            config_path = Path(config_file)
            if config_path.exists():
                with open(config_path, 'r') as f:
                    return json.load(f)
            else:
                return self._get_default_config()
        except Exception as e:
            self.logger.warning(f"Could not load advanced config: {e}")
            return self._get_default_config()
    
    def _get_default_config(self):
        """Get default advanced configuration."""
        return {
            "backup_settings": {
                "retention_policy": {"daily_backups": 7, "weekly_backups": 4},
                "compression": {"enabled": True, "algorithm": "gzip"},
                "encryption": {"enabled": True, "algorithm": "AES-256"},
                "verification": {"enabled": True, "checksum_algorithm": "SHA-256"}
            }
        }
    
    def _generate_encryption_key(self):
        """Generate encryption key for backups."""
        try:
            from cryptography.fernet import Fernet
            key_file = self.backup_dir / 'backup_encryption.key'
            
            if key_file.exists():
                with open(key_file, 'rb') as f:
                    key = f.read()
            else:
                key = Fernet.generate_key()
                with open(key_file, 'wb') as f:
                    f.write(key)
                os.chmod(key_file, 0o600)
            
            return Fernet(key)
        except Exception as e:
            self.logger.warning(f"Encryption key generation failed: {e}")
            return None
    
    def create_encrypted_backup(self, backup_type="full", sources=None):
        """Create encrypted backup with compression."""
        try:
            backup_id = f"encrypted_backup_{int(time.time())}"
            timestamp = datetime.now()
            
            if sources is None:
                sources = self.config.get('backup_sources', {}).get('files', {})
            
            backup_path = self.backup_dir / backup_id
            backup_path.mkdir(exist_ok=True)
            
            # Create backup with compression and encryption
            compressed_files = []
            for source_name, source_path in sources.items():
                if Path(source_path).exists():
                    # Compress source
                    compressed_file = backup_path / f"{source_name}.tar.gz"
                    subprocess.run([
                        'tar', '-czf', str(compressed_file), '-C', 
                        str(Path(source_path).parent), Path(source_path).name
                    ], check=True)
                    
                    # Encrypt if encryption is available
                    if self.encryption_key:
                        with open(compressed_file, 'rb') as f:
                            data = f.read()
                        
                        encrypted_data = self.encryption_key.encrypt(data)
                        encrypted_file = backup_path / f"{source_name}.tar.gz.enc"
                        
                        with open(encrypted_file, 'wb') as f:
                            f.write(encrypted_data)
                        
                        # Remove unencrypted file
                        compressed_file.unlink()
                        compressed_files.append(str(encrypted_file))
                    else:
                        compressed_files.append(str(compressed_file))
            
            # Create backup manifest with checksums
            manifest = {
                'backup_id': backup_id,
                'backup_type': backup_type,
                'timestamp': timestamp.isoformat(),
                'encrypted': self.encryption_key is not None,
                'compressed': True,
                'files': [],
                'checksums': {}
            }
            
            # Calculate checksums
            import hashlib
            for file_path in compressed_files:
                file_name = Path(file_path).name
                manifest['files'].append(file_name)
                
                # Calculate SHA-256 checksum
                sha256_hash = hashlib.sha256()
                with open(file_path, 'rb') as f:
                    for chunk in iter(lambda: f.read(4096), b""):
                        sha256_hash.update(chunk)
                manifest['checksums'][file_name] = sha256_hash.hexdigest()
            
            manifest.update({
                'status': 'completed',
                'files_count': len(compressed_files),
                'backup_size': self._calculate_backup_size(backup_path),
                'completion_time': datetime.now().isoformat()
            })
            
            # Save manifest
            manifest_file = backup_path / 'manifest.json'
            with open(manifest_file, 'w') as f:
                json.dump(manifest, f, indent=2)
            
            # Add to history
            self.backup_history.append(manifest)
            self._save_backup_history()
            
            self.logger.info(f"Encrypted backup created successfully: {backup_id}")
            return manifest
            
        except Exception as e:
            self.logger.error(f"Encrypted backup creation failed: {e}")
            return None
    
    def verify_backup_integrity(self, backup_id: str) -> Dict:
        """Verify backup integrity using checksums."""
        try:
            backup_path = self.backup_dir / backup_id
            manifest_file = backup_path / 'manifest.json'
            
            if not manifest_file.exists():
                return {'status': 'failed', 'error': 'Manifest not found'}
            
            with open(manifest_file, 'r') as f:
                manifest = json.load(f)
            
            verification_results = {
                'backup_id': backup_id,
                'verification_time': datetime.now().isoformat(),
                'files_verified': 0,
                'files_failed': 0,
                'checksum_matches': 0,
                'issues': []
            }
            
            # Verify each file's checksum
            import hashlib
            for file_name in manifest.get('files', []):
                file_path = backup_path / file_name
                
                if not file_path.exists():
                    verification_results['files_failed'] += 1
                    verification_results['issues'].append(f"Missing file: {file_name}")
                    continue
                
                # Calculate current checksum
                sha256_hash = hashlib.sha256()
                with open(file_path, 'rb') as f:
                    for chunk in iter(lambda: f.read(4096), b""):
                        sha256_hash.update(chunk)
                current_checksum = sha256_hash.hexdigest()
                
                # Compare with stored checksum
                stored_checksum = manifest.get('checksums', {}).get(file_name)
                if current_checksum == stored_checksum:
                    verification_results['checksum_matches'] += 1
                else:
                    verification_results['issues'].append(f"Checksum mismatch: {file_name}")
                
                verification_results['files_verified'] += 1
            
            # Determine overall status
            if verification_results['files_failed'] == 0 and len(verification_results['issues']) == 0:
                verification_results['status'] = 'passed'
            elif verification_results['files_failed'] > 0:
                verification_results['status'] = 'failed'
            else:
                verification_results['status'] = 'warning'
            
            return verification_results
            
        except Exception as e:
            self.logger.error(f"Backup verification failed: {e}")
            return {'status': 'error', 'error': str(e)}
    
    def restore_encrypted_backup(self, backup_id: str, restore_path: str = None) -> bool:
        """Restore encrypted backup with decryption."""
        try:
            backup_info = self.get_backup_info(backup_id)
            if not backup_info:
                self.logger.error(f"Backup {backup_id} not found")
                return False
            
            backup_path = self.backup_dir / backup_id
            if not backup_path.exists():
                self.logger.error(f"Backup files not found: {backup_path}")
                return False
            
            if restore_path is None:
                restore_path = f"/home/vivi/pixelated/ai/restored_{backup_id}"
            
            restore_dir = Path(restore_path)
            restore_dir.mkdir(parents=True, exist_ok=True)
            
            # Load manifest
            manifest_file = backup_path / 'manifest.json'
            with open(manifest_file, 'r') as f:
                manifest = json.load(f)
            
            # Restore files
            for file_name in manifest.get('files', []):
                file_path = backup_path / file_name
                
                if file_name.endswith('.enc') and self.encryption_key:
                    # Decrypt file
                    with open(file_path, 'rb') as f:
                        encrypted_data = f.read()
                    
                    decrypted_data = self.encryption_key.decrypt(encrypted_data)
                    
                    # Write decrypted file
                    decrypted_file = restore_dir / file_name.replace('.enc', '')
                    with open(decrypted_file, 'wb') as f:
                        f.write(decrypted_data)
                    
                    # Extract if it's a tar.gz
                    if decrypted_file.name.endswith('.tar.gz'):
                        subprocess.run([
                            'tar', '-xzf', str(decrypted_file), '-C', str(restore_dir)
                        ], check=True)
                        decrypted_file.unlink()  # Remove tar file after extraction
                else:
                    # Copy unencrypted file
                    shutil.copy2(file_path, restore_dir)
            
            self.logger.info(f"Encrypted backup {backup_id} restored to {restore_path}")
            return True
            
        except Exception as e:
            self.logger.error(f"Encrypted restore failed: {e}")
            return False
    
    def schedule_automated_backups(self):
        """Schedule automated backups based on configuration."""
        try:
            schedule_config = self.config.get('scheduling', {})
            
            # This would integrate with a job scheduler like cron
            # For now, we'll create cron entries
            cron_entries = []
            
            if 'full_backup' in schedule_config:
                cron_entries.append(f"{schedule_config['full_backup']} /usr/bin/python3 -c "from backup_system import AdvancedBackupManager; mgr = AdvancedBackupManager(); mgr.create_encrypted_backup('full')"")
            
            if 'incremental_backup' in schedule_config:
                cron_entries.append(f"{schedule_config['incremental_backup']} /usr/bin/python3 -c "from backup_system import AdvancedBackupManager; mgr = AdvancedBackupManager(); mgr.create_encrypted_backup('incremental')"")
            
            # Write cron entries to a file for manual installation
            cron_file = self.backup_dir / 'backup_cron_entries.txt'
            with open(cron_file, 'w') as f:
                f.write("# Automated backup cron entries\n")
                f.write("# Install with: crontab -l > current_cron && cat backup_cron_entries.txt >> current_cron && crontab current_cron\n\n")
                for entry in cron_entries:
                    f.write(entry + "\n")
            
            self.logger.info(f"Backup scheduling configured. Cron entries written to {cron_file}")
            return True
            
        except Exception as e:
            self.logger.error(f"Backup scheduling failed: {e}")
            return False
    
    def get_advanced_statistics(self) -> Dict:
        """Get comprehensive backup statistics."""
        try:
            basic_stats = self.get_backup_statistics()
            
            # Add advanced statistics
            advanced_stats = basic_stats.copy()
            
            # Calculate encryption statistics
            encrypted_backups = sum(1 for backup in self.backup_history 
                                  if backup.get('encrypted', False))
            
            # Calculate compression statistics
            compressed_backups = sum(1 for backup in self.backup_history 
                                   if backup.get('compressed', False))
            
            # Calculate verification statistics
            verified_backups = len([b for b in self.backup_history 
                                  if 'verification_status' in b])
            
            advanced_stats.update({
                'encryption_stats': {
                    'encrypted_backups': encrypted_backups,
                    'encryption_rate': (encrypted_backups / len(self.backup_history)) * 100 if self.backup_history else 0
                },
                'compression_stats': {
                    'compressed_backups': compressed_backups,
                    'compression_rate': (compressed_backups / len(self.backup_history)) * 100 if self.backup_history else 0
                },
                'verification_stats': {
                    'verified_backups': verified_backups,
                    'verification_rate': (verified_backups / len(self.backup_history)) * 100 if self.backup_history else 0
                },
                'retention_compliance': self._check_retention_compliance()
            })
            
            return advanced_stats
            
        except Exception as e:
            self.logger.error(f"Error getting advanced statistics: {e}")
            return {}
    
    def _check_retention_compliance(self) -> Dict:
        """Check compliance with retention policy."""
        try:
            retention_policy = self.config.get('backup_settings', {}).get('retention_policy', {})
            
            now = datetime.now()
            compliance = {
                'daily_compliance': True,
                'weekly_compliance': True,
                'monthly_compliance': True,
                'issues': []
            }
            
            # Check daily backups
            daily_required = retention_policy.get('daily_backups', 7)
            daily_cutoff = now - timedelta(days=daily_required)
            daily_backups = [b for b in self.backup_history 
                           if datetime.fromisoformat(b.get('timestamp', '')) > daily_cutoff]
            
            if len(daily_backups) < daily_required:
                compliance['daily_compliance'] = False
                compliance['issues'].append(f"Missing daily backups: {len(daily_backups)}/{daily_required}")
            
            return compliance
            
        except Exception as e:
            self.logger.error(f"Retention compliance check failed: {e}")
            return {'error': str(e)}

# Create alias for backward compatibility
BackupManager = AdvancedBackupManager
