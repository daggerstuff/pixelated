#!/usr/bin/env python3
"""
Backup Monitoring and Alerting System
Monitors backup health and sends alerts for failures or issues.
"""

import os
import json
import logging
import smtplib
import requests
from pathlib import Path
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import yaml

@dataclass
class BackupHealthCheck:
    """Backup health check result."""
    check_name: str
    status: str  # healthy, warning, critical
    message: str
    timestamp: datetime
    details: Dict[str, Any]

class BackupMonitor:
    """Monitors backup system health and sends alerts."""
    
    def __init__(self, config_file: str = "backup_config.yaml"):
        self.config = self._load_config(config_file)
        self.logger = self._setup_logging()
        
    def _load_config(self, config_file: str) -> Dict[str, Any]:
        """Load backup configuration."""
        try:
            with open(config_file, 'r') as f:
                return yaml.safe_load(f)
        except FileNotFoundError:
            return {}
    
    def _setup_logging(self) -> logging.Logger:
        """Setup logging for backup monitor."""
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        return logging.getLogger(__name__)
    
    def check_backup_health(self) -> List[BackupHealthCheck]:
        """Perform comprehensive backup health checks."""
        checks = []
        
        # Check backup age
        checks.append(self._check_backup_age())
        
        # Check backup sizes
        checks.append(self._check_backup_sizes())
        
        # Check storage space
        checks.append(self._check_storage_space())
        
        # Check cloud storage connectivity
        checks.append(self._check_cloud_connectivity())
        
        # Check database connectivity
        checks.append(self._check_database_connectivity())
        
        return checks
    
    def _check_backup_age(self) -> BackupHealthCheck:
        """Check if backups are recent enough."""
        try:
            backup_path = Path(self.config.get('database', {}).get('backup_path', '/backups/database'))
            threshold_hours = self.config.get('monitoring', {}).get('health_checks', {}).get('backup_age_threshold', 25)
            
            if not backup_path.exists():
                return BackupHealthCheck(
                    check_name="backup_age",
                    status="critical",
                    message="Backup directory does not exist",
                    timestamp=datetime.now(),
                    details={'backup_path': str(backup_path)}
                )
            
            # Find most recent backup
            backup_files = list(backup_path.glob("*.sql*"))
            if not backup_files:
                return BackupHealthCheck(
                    check_name="backup_age",
                    status="critical",
                    message="No backup files found",
                    timestamp=datetime.now(),
                    details={'backup_path': str(backup_path)}
                )
            
            latest_backup = max(backup_files, key=lambda f: f.stat().st_mtime)
            backup_age = datetime.now() - datetime.fromtimestamp(latest_backup.stat().st_mtime)
            
            if backup_age.total_seconds() > threshold_hours * 3600:
                status = "critical"
                message = f"Latest backup is {backup_age.total_seconds() / 3600:.1f} hours old"
            elif backup_age.total_seconds() > (threshold_hours * 0.8) * 3600:
                status = "warning"
                message = f"Latest backup is {backup_age.total_seconds() / 3600:.1f} hours old"
            else:
                status = "healthy"
                message = f"Latest backup is {backup_age.total_seconds() / 3600:.1f} hours old"
            
            return BackupHealthCheck(
                check_name="backup_age",
                status=status,
                message=message,
                timestamp=datetime.now(),
                details={
                    'latest_backup': str(latest_backup),
                    'backup_age_hours': backup_age.total_seconds() / 3600,
                    'threshold_hours': threshold_hours
                }
            )
            
        except Exception as e:
            return BackupHealthCheck(
                check_name="backup_age",
                status="critical",
                message=f"Error checking backup age: {str(e)}",
                timestamp=datetime.now(),
                details={'error': str(e)}
            )
    
    def _check_backup_sizes(self) -> BackupHealthCheck:
        """Check if backup file sizes are reasonable."""
        try:
            backup_path = Path(self.config.get('database', {}).get('backup_path', '/backups/database'))
            min_size_mb = self.config.get('monitoring', {}).get('health_checks', {}).get('backup_size_threshold', 100)
            
            if not backup_path.exists():
                return BackupHealthCheck(
                    check_name="backup_sizes",
                    status="critical",
                    message="Backup directory does not exist",
                    timestamp=datetime.now(),
                    details={'backup_path': str(backup_path)}
                )
            
            backup_files = list(backup_path.glob("*.sql*"))
            if not backup_files:
                return BackupHealthCheck(
                    check_name="backup_sizes",
                    status="critical",
                    message="No backup files found",
                    timestamp=datetime.now(),
                    details={'backup_path': str(backup_path)}
                )
            
            # Check recent backups
            recent_backups = [
                f for f in backup_files
                if datetime.fromtimestamp(f.stat().st_mtime) > datetime.now() - timedelta(days=7)
            ]
            
            small_backups = []
            for backup_file in recent_backups:
                size_mb = backup_file.stat().st_size / (1024 * 1024)
                if size_mb < min_size_mb:
                    small_backups.append({
                        'file': str(backup_file),
                        'size_mb': size_mb
                    })
            
            if small_backups:
                status = "warning"
                message = f"Found {len(small_backups)} backups smaller than {min_size_mb}MB"
            else:
                status = "healthy"
                message = f"All recent backups are larger than {min_size_mb}MB"
            
            return BackupHealthCheck(
                check_name="backup_sizes",
                status=status,
                message=message,
                timestamp=datetime.now(),
                details={
                    'recent_backups': len(recent_backups),
                    'small_backups': small_backups,
                    'min_size_mb': min_size_mb
                }
            )
            
        except Exception as e:
            return BackupHealthCheck(
                check_name="backup_sizes",
                status="critical",
                message=f"Error checking backup sizes: {str(e)}",
                timestamp=datetime.now(),
                details={'error': str(e)}
            )
    
    def _check_storage_space(self) -> BackupHealthCheck:
        """Check available storage space for backups."""
        try:
            backup_path = Path(self.config.get('database', {}).get('backup_path', '/backups/database'))
            
            if not backup_path.exists():
                backup_path.mkdir(parents=True, exist_ok=True)
            
            # Get disk usage
            statvfs = os.statvfs(backup_path)
            total_space = statvfs.f_frsize * statvfs.f_blocks
            free_space = statvfs.f_frsize * statvfs.f_available
            used_space = total_space - free_space
            
            used_percent = (used_space / total_space) * 100
            free_gb = free_space / (1024**3)
            
            if used_percent > 90:
                status = "critical"
                message = f"Storage is {used_percent:.1f}% full ({free_gb:.1f}GB free)"
            elif used_percent > 80:
                status = "warning"
                message = f"Storage is {used_percent:.1f}% full ({free_gb:.1f}GB free)"
            else:
                status = "healthy"
                message = f"Storage is {used_percent:.1f}% full ({free_gb:.1f}GB free)"
            
            return BackupHealthCheck(
                check_name="storage_space",
                status=status,
                message=message,
                timestamp=datetime.now(),
                details={
                    'total_gb': total_space / (1024**3),
                    'used_gb': used_space / (1024**3),
                    'free_gb': free_gb,
                    'used_percent': used_percent
                }
            )
            
        except Exception as e:
            return BackupHealthCheck(
                check_name="storage_space",
                status="critical",
                message=f"Error checking storage space: {str(e)}",
                timestamp=datetime.now(),
                details={'error': str(e)}
            )
    
    def _check_cloud_connectivity(self) -> BackupHealthCheck:
        """Check connectivity to cloud storage."""
        try:
            s3_config = self.config.get('cloud_storage', {}).get('s3', {})
            
            if not s3_config.get('enabled', False):
                return BackupHealthCheck(
                    check_name="cloud_connectivity",
                    status="healthy",
                    message="Cloud storage not enabled",
                    timestamp=datetime.now(),
                    details={'enabled': False}
                )
            
            # Test S3 connectivity (simplified)
            bucket = s3_config.get('bucket')
            if bucket:
                try:
                    import boto3
                    s3_client = boto3.client('s3')
                    s3_client.head_bucket(Bucket=bucket)
                    
                    status = "healthy"
                    message = f"Successfully connected to S3 bucket: {bucket}"
                except Exception as e:
                    status = "warning"
                    message = f"Failed to connect to S3 bucket: {str(e)}"
            else:
                status = "warning"
                message = "S3 bucket not configured"
            
            return BackupHealthCheck(
                check_name="cloud_connectivity",
                status=status,
                message=message,
                timestamp=datetime.now(),
                details={'bucket': bucket}
            )
            
        except Exception as e:
            return BackupHealthCheck(
                check_name="cloud_connectivity",
                status="warning",
                message=f"Error checking cloud connectivity: {str(e)}",
                timestamp=datetime.now(),
                details={'error': str(e)}
            )
    
    def _check_database_connectivity(self) -> BackupHealthCheck:
        """Check database connectivity for backups."""
        try:
            db_config = self.config.get('database', {})
            
            # Test database connection (simplified)
            try:
                import psycopg2
                conn = psycopg2.connect(
                    host=db_config.get('host', 'localhost'),
                    port=db_config.get('port', 5432),
                    database=db_config.get('database', 'pixelated_db'),
                    user=db_config.get('username', 'postgres'),
                    password=db_config.get('password', '')
                )
                conn.close()
                
                status = "healthy"
                message = "Database connection successful"
            except Exception as e:
                status = "critical"
                message = f"Database connection failed: {str(e)}"
            
            return BackupHealthCheck(
                check_name="database_connectivity",
                status=status,
                message=message,
                timestamp=datetime.now(),
                details={
                    'host': db_config.get('host', 'localhost'),
                    'database': db_config.get('database', 'pixelated_db')
                }
            )
            
        except Exception as e:
            return BackupHealthCheck(
                check_name="database_connectivity",
                status="critical",
                message=f"Error checking database connectivity: {str(e)}",
                timestamp=datetime.now(),
                details={'error': str(e)}
            )
    
    def send_alerts(self, health_checks: List[BackupHealthCheck]):
        """Send alerts based on health check results."""
        critical_checks = [check for check in health_checks if check.status == "critical"]
        warning_checks = [check for check in health_checks if check.status == "warning"]
        
        if critical_checks or warning_checks:
            alert_config = self.config.get('monitoring', {}).get('alerts', {})
            
            # Send email alerts
            if alert_config.get('email', {}).get('enabled', False):
                self._send_email_alert(critical_checks, warning_checks)
            
            # Send Slack alerts
            if alert_config.get('slack', {}).get('enabled', False):
                self._send_slack_alert(critical_checks, warning_checks)
            
            # Send webhook alerts
            if alert_config.get('webhook', {}).get('enabled', False):
                self._send_webhook_alert(critical_checks, warning_checks)
    
    def _send_email_alert(self, critical_checks: List[BackupHealthCheck], 
                         warning_checks: List[BackupHealthCheck]):
        """Send email alert."""
        try:
            email_config = self.config.get('monitoring', {}).get('alerts', {}).get('email', {})
            
            # Create email content
            subject = f"Backup System Alert - {len(critical_checks)} Critical, {len(warning_checks)} Warning"
            
            body = "Backup System Health Check Results\n"
            body += "=" * 40 + "\n\n"
            
            if critical_checks:
                body += "CRITICAL ISSUES:\n"
                for check in critical_checks:
                    body += f"- {check.check_name}: {check.message}\n"
                body += "\n"
            
            if warning_checks:
                body += "WARNING ISSUES:\n"
                for check in warning_checks:
                    body += f"- {check.check_name}: {check.message}\n"
                body += "\n"
            
            body += f"Check performed at: {datetime.now().isoformat()}\n"
            
            # Send email
            msg = MIMEText(body)
            msg['Subject'] = subject
            msg['From'] = email_config.get('from_address')
            msg['To'] = ', '.join(email_config.get('to_addresses', []))
            
            with smtplib.SMTP(email_config.get('smtp_host'), email_config.get('smtp_port', 587)) as server:
                server.starttls()
                server.login(email_config.get('username'), email_config.get('password'))
                server.send_message(msg)
            
            self.logger.info("Email alert sent successfully")
            
        except Exception as e:
            self.logger.error(f"Failed to send email alert: {e}")
    
    def _send_slack_alert(self, critical_checks: List[BackupHealthCheck], 
                         warning_checks: List[BackupHealthCheck]):
        """Send Slack alert."""
        try:
            slack_config = self.config.get('monitoring', {}).get('alerts', {}).get('slack', {})
            
            # Create Slack message
            text = f"🚨 Backup System Alert: {len(critical_checks)} Critical, {len(warning_checks)} Warning issues"
            
            blocks = [
                {
                    "type": "section",
                    "text": {"type": "mrkdwn", "text": text}
                }
            ]
            
            if critical_checks:
                critical_text = "\n".join([f"• {check.check_name}: {check.message}" for check in critical_checks])
                blocks.append({
                    "type": "section",
                    "text": {"type": "mrkdwn", "text": f"*Critical Issues:*\n{critical_text}"}
                })
            
            if warning_checks:
                warning_text = "\n".join([f"• {check.check_name}: {check.message}" for check in warning_checks])
                blocks.append({
                    "type": "section",
                    "text": {"type": "mrkdwn", "text": f"*Warning Issues:*\n{warning_text}"}
                })
            
            payload = {
                "channel": slack_config.get('channel', '#alerts'),
                "text": text,
                "blocks": blocks
            }
            
            response = requests.post(slack_config.get('webhook_url'), json=payload)
            response.raise_for_status()
            
            self.logger.info("Slack alert sent successfully")
            
        except Exception as e:
            self.logger.error(f"Failed to send Slack alert: {e}")
    
    def _send_webhook_alert(self, critical_checks: List[BackupHealthCheck], 
                           warning_checks: List[BackupHealthCheck]):
        """Send webhook alert."""
        try:
            webhook_config = self.config.get('monitoring', {}).get('alerts', {}).get('webhook', {})
            
            payload = {
                'timestamp': datetime.now().isoformat(),
                'alert_type': 'backup_health_check',
                'critical_count': len(critical_checks),
                'warning_count': len(warning_checks),
                'critical_checks': [asdict(check) for check in critical_checks],
                'warning_checks': [asdict(check) for check in warning_checks]
            }
            
            headers = webhook_config.get('headers', {})
            
            response = requests.post(
                webhook_config.get('url'),
                json=payload,
                headers=headers,
                timeout=30
            )
            response.raise_for_status()
            
            self.logger.info("Webhook alert sent successfully")
            
        except Exception as e:
            self.logger.error(f"Failed to send webhook alert: {e}")
    
    def run_health_check(self):
        """Run complete health check and send alerts if needed."""
        self.logger.info("Starting backup health check")
        
        health_checks = self.check_backup_health()
        
        # Log results
        for check in health_checks:
            if check.status == "critical":
                self.logger.error(f"CRITICAL - {check.check_name}: {check.message}")
            elif check.status == "warning":
                self.logger.warning(f"WARNING - {check.check_name}: {check.message}")
            else:
                self.logger.info(f"OK - {check.check_name}: {check.message}")
        
        # Send alerts
        self.send_alerts(health_checks)
        
        # Generate report
        report = {
            'timestamp': datetime.now().isoformat(),
            'health_checks': [asdict(check) for check in health_checks],
            'summary': {
                'total_checks': len(health_checks),
                'healthy': len([c for c in health_checks if c.status == "healthy"]),
                'warning': len([c for c in health_checks if c.status == "warning"]),
                'critical': len([c for c in health_checks if c.status == "critical"])
            }
        }
        
        report_file = f"backup_health_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(report_file, 'w') as f:
            json.dump(report, f, indent=2, default=str)
        
        self.logger.info(f"Health check completed. Report saved to {report_file}")
        return report

def main():
    """Main function for testing backup monitoring."""
    print("🔍 BACKUP MONITORING SYSTEM TEST")
    print("=" * 50)
    
    monitor = BackupMonitor()
    
    # Run health check
    report = monitor.run_health_check()
    
    print(f"✅ Health checks completed: {report['summary']['total_checks']} total")
    print(f"✅ Healthy: {report['summary']['healthy']}")
    print(f"⚠️ Warning: {report['summary']['warning']}")
    print(f"❌ Critical: {report['summary']['critical']}")
    
    print("\n🎉 Backup monitoring system is functional!")

if __name__ == "__main__":
    main()
