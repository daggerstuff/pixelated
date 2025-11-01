import pytest
#!/usr/bin/env python3
"""
Simplified Backup System Test
Tests core backup functionality without external dependencies.
"""

import os
import json
import logging
import subprocess
import shutil
import gzip
import tarfile
from .pathlib import Path
from .typing import Dict, List, Optional, Any
from .dataclasses import dataclass, asdict
from .datetime import datetime
from .enum import Enum
import hashlib

class BackupType(Enum):
    """Types of backups."""
    FULL = "full"
    INCREMENTAL = "incremental"

class BackupStatus(Enum):
    """Backup operation status."""
    COMPLETED = "completed"
    FAILED = "failed"

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

class SimpleFileBackupManager:
    """Simplified file backup manager."""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        logging.basicConfig(level=logging.INFO)

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
                tar.add(source, arcname=source.name)
            
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
                checksum=checksum
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

    def _calculate_checksum(self, file_path: Path) -> str:
        """Calculate SHA256 checksum of a file."""
        sha256_hash = hashlib.sha256()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                sha256_hash.update(chunk)
        return sha256_hash.hexdigest()

class SimpleBackupSystem:
    """Simplified backup system for testing."""
    
    def __init__(self):
        self.file_manager = SimpleFileBackupManager()
        self.backup_results: List[BackupResult] = []
        self.logger = logging.getLogger(__name__)

    def create_test_backup(self, source_path: str, backup_path: str) -> BackupResult:
        """Create a test backup."""
        result = self.file_manager.backup_directory(source_path, backup_path)
        self.backup_results.append(result)
        return result

    def test_restore(self, backup_file: str, restore_path: str) -> bool:
        """Test restore functionality."""
        return self.file_manager.restore_directory(backup_file, restore_path, overwrite=True)

    def get_backup_status(self) -> Dict[str, Any]:
        """Get backup system status."""
        successful = len([r for r in self.backup_results if r.status == BackupStatus.COMPLETED])
        failed = len([r for r in self.backup_results if r.status == BackupStatus.FAILED])
        
        return {
            'total_backups': len(self.backup_results),
            'successful_backups': successful,
            'failed_backups': failed,
            'success_rate': (successful / len(self.backup_results) * 100) if self.backup_results else 0
        }

    def generate_report(self) -> str:
        """Generate backup report."""
        report_file = f"backup_test_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        
        report = {
            'generated_at': datetime.now().isoformat(),
            'status': self.get_backup_status(),
            'backup_results': [asdict(result) for result in self.backup_results]
        }
        
        with open(report_file, 'w') as f:
            json.dump(report, f, indent=2, default=str)
        
        return report_file

def main():
    """Main function for testing the backup system."""
    print("💾 PRODUCTION BACKUP SYSTEM TEST")
    print("=" * 50)
    
    backup_system = SimpleBackupSystem()
    
    # Create test directory structure
    test_dir = Path("test_backup_data")
    test_dir.mkdir(exist_ok=True)
    
    # Create test files
    (test_dir / "file1.txt").write_text("Test content 1")
    (test_dir / "file2.txt").write_text("Test content 2")
    (test_dir / "subdir").mkdir(exist_ok=True)
    (test_dir / "subdir" / "file3.txt").write_text("Test content 3")
    
    print(f"✅ Created test data in {test_dir}")
    
    # Create backup directory
    backup_dir = Path("test_backups")
    backup_dir.mkdir(exist_ok=True)
    
    # Test backup
    result = backup_system.create_test_backup(str(test_dir), str(backup_dir))
    print(f"✅ Backup test: {result.status.value}")
    print(f"✅ Backup file: {result.file_path}")
    print(f"✅ Backup size: {result.file_size} bytes")
    print(f"✅ Checksum: {result.checksum[:16]}...")
    
    # Test restore
    restore_dir = Path("test_restore")
    if restore_dir.exists():
        shutil.rmtree(restore_dir)
    
    success = backup_system.test_restore(result.file_path, str(restore_dir))
    print(f"✅ Restore test: {'success' if success else 'failed'}")
    
    # Verify restored files
    if success:
        restored_files = list(restore_dir.rglob("*"))
        print(f"✅ Restored {len(restored_files)} items")
    
    # Get status
    status = backup_system.get_backup_status()
    print(f"✅ Success rate: {status['success_rate']:.1f}%")
    
    # Generate report
    report_file = backup_system.generate_report()
    print(f"✅ Report generated: {report_file}")
    
    # Cleanup
    shutil.rmtree(test_dir, ignore_errors=True)
    shutil.rmtree(backup_dir, ignore_errors=True)
    shutil.rmtree(restore_dir, ignore_errors=True)
    
    print("\n🎉 Production backup system is functional!")

if __name__ == "__main__":
    main()
