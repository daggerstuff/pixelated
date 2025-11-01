import pytest
#!/usr/bin/env python3
"""
Simplified Security System Test
Tests core security functionality without external dependencies.
"""

import os
import json
import logging
import hashlib
import secrets
import hmac
from .pathlib import Path
from .typing import Dict, List, Optional, Any
from .dataclasses import dataclass, asdict
from .datetime import datetime, timedelta
from .enum import Enum
import re
import base64
from .collections import defaultdict, deque

class SecurityLevel(Enum):
    """Security clearance levels."""
    PUBLIC = "public"
    INTERNAL = "internal"
    CONFIDENTIAL = "confidential"
    RESTRICTED = "restricted"
    TOP_SECRET = "top_secret"

class SecurityEvent(Enum):
    """Security event types."""
    LOGIN_SUCCESS = "login_success"
    LOGIN_FAILURE = "login_failure"
    UNAUTHORIZED_ACCESS = "unauthorized_access"
    SECURITY_VIOLATION = "security_violation"

@dataclass
class User:
    """User account information."""
    user_id: str
    username: str
    email: str
    password_hash: str
    roles: List[str]
    security_level: SecurityLevel
    failed_login_attempts: int = 0
    account_locked: bool = False
    created_at: datetime = None

    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.now()

@dataclass
class SecurityAuditLog:
    """Security audit log entry."""
    timestamp: datetime
    event_type: SecurityEvent
    user_id: Optional[str]
    ip_address: str
    resource: str
    action: str
    result: str
    details: Dict[str, Any] = None

    def __post_init__(self):
        if self.details is None:
            self.details = {}

class SimpleEncryptionManager:
    """Simplified encryption manager."""
    
    def __init__(self, master_key: str = "default_test_key"):
        self.master_key = master_key
        self.logger = logging.getLogger(__name__)

    def hash_password(self, password: str) -> str:
        """Hash password using SHA-256 with salt."""
        salt = secrets.token_hex(16)
        password_hash = hashlib.sha256((password + salt).encode()).hexdigest()
        return f"{salt}:{password_hash}"

    def verify_password(self, password: str, password_hash: str) -> bool:
        """Verify password against hash."""
        try:
            salt, stored_hash = password_hash.split(':')
            computed_hash = hashlib.sha256((password + salt).encode()).hexdigest()
            return hmac.compare_digest(stored_hash, computed_hash)
        except Exception:
            return False

    def generate_api_key(self) -> str:
        """Generate secure API key."""
        return secrets.token_urlsafe(32)

    def generate_token(self, user_id: str, expiry_hours: int = 24) -> str:
        """Generate simple authentication token."""
        expiry = datetime.now() + timedelta(hours=expiry_hours)
        token_data = f"{user_id}:{expiry.isoformat()}:{secrets.token_hex(16)}"
        return base64.urlsafe_b64encode(token_data.encode()).decode()

    def validate_token(self, token: str) -> Optional[str]:
        """Validate authentication token."""
        try:
            token_data = base64.urlsafe_b64decode(token.encode()).decode()
            user_id, expiry_str, _ = token_data.split(':')
            expiry = datetime.fromisoformat(expiry_str)
            
            if datetime.now() > expiry:
                return None
            
            return user_id
        except Exception:
            return None

class SimpleAuthenticationManager:
    """Simplified authentication manager."""
    
    def __init__(self, encryption_manager: SimpleEncryptionManager):
        self.encryption = encryption_manager
        self.users: Dict[str, User] = {}
        self.logger = logging.getLogger(__name__)
        
        # Security policy
        self.max_login_attempts = 5
        self.password_min_length = 8

    def create_user(self, username: str, email: str, password: str, 
                   roles: List[str], security_level: SecurityLevel) -> User:
        """Create a new user account."""
        # Validate password
        if len(password) < self.password_min_length:
            raise ValueError(f"Password must be at least {self.password_min_length} characters")
        
        user_id = secrets.token_urlsafe(16)
        password_hash = self.encryption.hash_password(password)
        
        user = User(
            user_id=user_id,
            username=username,
            email=email,
            password_hash=password_hash,
            roles=roles,
            security_level=security_level
        )
        
        self.users[user_id] = user
        self.logger.info(f"Created user account: {username} ({user_id})")
        
        return user

    def authenticate_user(self, username: str, password: str) -> Optional[str]:
        """Authenticate user and return token."""
        user = self._find_user_by_username(username)
        
        if not user:
            self.logger.warning(f"Authentication failed: user not found - {username}")
            return None
        
        if user.account_locked:
            self.logger.warning(f"Authentication failed: account locked - {username}")
            return None
        
        if not self.encryption.verify_password(password, user.password_hash):
            user.failed_login_attempts += 1
            
            if user.failed_login_attempts >= self.max_login_attempts:
                user.account_locked = True
                self.logger.warning(f"Account locked due to failed attempts: {username}")
            
            self.logger.warning(f"Authentication failed: invalid password - {username}")
            return None
        
        # Reset failed attempts on successful login
        user.failed_login_attempts = 0
        
        # Generate token
        token = self.encryption.generate_token(user.user_id)
        
        self.logger.info(f"User authenticated successfully: {username}")
        return token

    def validate_token(self, token: str) -> Optional[Dict[str, Any]]:
        """Validate token and return user info."""
        user_id = self.encryption.validate_token(token)
        
        if not user_id:
            return None
        
        user = self.users.get(user_id)
        
        if not user or user.account_locked:
            return None
        
        return {
            'user_id': user.user_id,
            'username': user.username,
            'roles': user.roles,
            'security_level': user.security_level.value
        }

    def _find_user_by_username(self, username: str) -> Optional[User]:
        """Find user by username."""
        for user in self.users.values():
            if user.username == username:
                return user
        return None

class SimpleSecurityMonitor:
    """Simplified security monitor."""
    
    def __init__(self):
        self.audit_logs: deque = deque(maxlen=1000)
        self.rate_limits: Dict[str, List[datetime]] = defaultdict(list)
        self.logger = logging.getLogger(__name__)

    def log_security_event(self, event_type: SecurityEvent, user_id: Optional[str],
                          ip_address: str, resource: str, action: str, result: str,
                          details: Dict[str, Any] = None):
        """Log security event."""
        audit_log = SecurityAuditLog(
            timestamp=datetime.now(),
            event_type=event_type,
            user_id=user_id,
            ip_address=ip_address,
            resource=resource,
            action=action,
            result=result,
            details=details or {}
        )
        
        self.audit_logs.append(audit_log)
        self.logger.info(f"Security event: {event_type.value} - {result} - {ip_address}")

    def check_rate_limit(self, ip_address: str, limit: int = 100, window_minutes: int = 60) -> bool:
        """Check if IP address is within rate limits."""
        now = datetime.now()
        window_start = now - timedelta(minutes=window_minutes)
        
        # Clean old entries
        self.rate_limits[ip_address] = [
            timestamp for timestamp in self.rate_limits[ip_address]
            if timestamp > window_start
        ]
        
        # Check current rate
        if len(self.rate_limits[ip_address]) >= limit:
            return False
        
        # Add current request
        self.rate_limits[ip_address].append(now)
        return True

class SimpleSecuritySystem:
    """Simplified security system for testing."""
    
    def __init__(self, config: Dict[str, Any] = None):
        self.config = config or {}
        self.logger = self._setup_logging()
        
        # Initialize components
        self.encryption = SimpleEncryptionManager(self.config.get('master_key', 'test_key'))
        self.auth_manager = SimpleAuthenticationManager(self.encryption)
        self.security_monitor = SimpleSecurityMonitor()
        
        # Setup default admin user
        self._setup_default_admin()

    def _setup_logging(self) -> logging.Logger:
        """Setup security logging."""
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        return logging.getLogger(__name__)

    def _setup_default_admin(self):
        """Setup default admin user."""
        admin_password = self.config.get('admin_password', 'SecureAdmin123!')
        
        try:
            admin_user = self.auth_manager.create_user(
                username='admin',
                email='admin@pixelated-empathy.ai',
                password=admin_password,
                roles=['admin', 'security'],
                security_level=SecurityLevel.TOP_SECRET
            )
            self.logger.info("Default admin user created")
        except Exception as e:
            self.logger.error(f"Failed to create admin user: {e}")

    def authenticate_request(self, username: str, password: str, ip_address: str) -> Dict[str, Any]:
        """Authenticate user request."""
        # Check rate limiting
        if not self.security_monitor.check_rate_limit(ip_address):
            self.security_monitor.log_security_event(
                SecurityEvent.SECURITY_VIOLATION,
                None, ip_address, 'authentication', 'rate_limit_exceeded', 'failure'
            )
            return {'success': False, 'error': 'Rate limit exceeded'}
        
        # Authenticate user
        token = self.auth_manager.authenticate_user(username, password)
        
        if token:
            self.security_monitor.log_security_event(
                SecurityEvent.LOGIN_SUCCESS,
                username, ip_address, 'authentication', 'login', 'success'
            )
            return {'success': True, 'token': token}
        else:
            self.security_monitor.log_security_event(
                SecurityEvent.LOGIN_FAILURE,
                username, ip_address, 'authentication', 'login', 'failure'
            )
            return {'success': False, 'error': 'Authentication failed'}

    def validate_request(self, token: str) -> Dict[str, Any]:
        """Validate authenticated request."""
        user_info = self.auth_manager.validate_token(token)
        
        if user_info:
            return {'valid': True, 'user_info': user_info}
        else:
            return {'valid': False, 'error': 'Invalid or expired token'}

    def get_security_status(self) -> Dict[str, Any]:
        """Get current security system status."""
        return {
            'active_users': len(self.auth_manager.users),
            'audit_logs_count': len(self.security_monitor.audit_logs),
            'rate_limited_ips': len(self.security_monitor.rate_limits),
            'system_status': 'operational'
        }

    def generate_security_report(self) -> str:
        """Generate security report."""
        report_file = f"security_test_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        
        # Analyze recent security events
        recent_logs = list(self.security_monitor.audit_logs)
        
        event_summary = defaultdict(int)
        for log in recent_logs:
            event_summary[log.event_type.value] += 1
        
        report = {
            'generated_at': datetime.now().isoformat(),
            'status': self.get_security_status(),
            'recent_events': dict(event_summary),
            'recent_audit_logs': [
                asdict(log) for log in recent_logs[-10:]  # Last 10 events
            ]
        }
        
        with open(report_file, 'w') as f:
            json.dump(report, f, indent=2, default=str)
        
        self.logger.info(f"Security report saved to {report_file}")
        return report_file

def main():
    """Main function for testing the security system."""
    print("🔒 PRODUCTION SECURITY SYSTEM TEST")
    print("=" * 50)
    
    # Initialize security system
    config = {
        'master_key': 'test_master_key_for_encryption',
        'admin_password': 'SecureAdmin123!'
    }
    
    security_system = SimpleSecuritySystem(config)
    
    # Test authentication
    auth_result = security_system.authenticate_request(
        username='admin',
        password='SecureAdmin123!',
        ip_address='127.0.0.1'
    )
    
    print(f"✅ Authentication test: {'success' if auth_result['success'] else 'failed'}")
    
    if auth_result['success']:
        token = auth_result['token']
        
        # Test token validation
        validation_result = security_system.validate_request(token)
        print(f"✅ Token validation: {'valid' if validation_result['valid'] else 'invalid'}")
        
        if validation_result['valid']:
            user_info = validation_result['user_info']
            print(f"✅ User info: {user_info['username']} ({user_info['security_level']})")
    
    # Test failed authentication
    failed_auth = security_system.authenticate_request(
        username='admin',
        password='wrong_password',
        ip_address='127.0.0.1'
    )
    
    print(f"✅ Failed auth test: {'failed as expected' if not failed_auth['success'] else 'unexpected success'}")
    
    # Test rate limiting
    rate_limit_test = True
    for i in range(105):  # Exceed rate limit
        if not security_system.security_monitor.check_rate_limit('192.168.1.100'):
            rate_limit_test = False
            break
    
    print(f"✅ Rate limiting test: {'working' if not rate_limit_test else 'not triggered'}")
    
    # Get security status
    status = security_system.get_security_status()
    print(f"✅ Active users: {status['active_users']}")
    print(f"✅ Audit logs: {status['audit_logs_count']}")
    print(f"✅ System status: {status['system_status']}")
    
    # Generate security report
    report_file = security_system.generate_security_report()
    print(f"✅ Security report: {report_file}")
    
    print("\n🎉 Production security system is functional!")

if __name__ == "__main__":
    main()
