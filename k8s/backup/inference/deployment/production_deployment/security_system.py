#!/usr/bin/env python3
"""
Production Security System for Pixelated Empathy AI
Comprehensive security with authentication, authorization, encryption, and monitoring.
"""

import os
import json
import logging
import hashlib
import secrets
import jwt
import bcrypt
from pathlib import Path
from typing import Dict, List, Optional, Any, Union, Tuple
from dataclasses import dataclass, asdict, field
from datetime import datetime, timedelta
from enum import Enum
import re
import ipaddress
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import base64
import time
import threading
from collections import defaultdict, deque

class SecurityLevel(Enum):
    """Security clearance levels."""
    PUBLIC = "public"
    INTERNAL = "internal"
    CONFIDENTIAL = "confidential"
    RESTRICTED = "restricted"
    TOP_SECRET = "top_secret"

class AuthenticationMethod(Enum):
    """Authentication methods."""
    PASSWORD = "password"
    MFA = "mfa"
    API_KEY = "api_key"
    JWT = "jwt"
    OAUTH = "oauth"
    CERTIFICATE = "certificate"

class SecurityEvent(Enum):
    """Security event types."""
    LOGIN_SUCCESS = "login_success"
    LOGIN_FAILURE = "login_failure"
    UNAUTHORIZED_ACCESS = "unauthorized_access"
    PRIVILEGE_ESCALATION = "privilege_escalation"
    DATA_ACCESS = "data_access"
    SECURITY_VIOLATION = "security_violation"
    SUSPICIOUS_ACTIVITY = "suspicious_activity"

@dataclass
class User:
    """User account information."""
    user_id: str
    username: str
    email: str
    password_hash: str
    roles: List[str]
    security_level: SecurityLevel
    mfa_enabled: bool = False
    mfa_secret: Optional[str] = None
    api_keys: List[str] = field(default_factory=list)
    last_login: Optional[datetime] = None
    failed_login_attempts: int = 0
    account_locked: bool = False
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)

@dataclass
class SecurityAuditLog:
    """Security audit log entry."""
    timestamp: datetime
    event_type: SecurityEvent
    user_id: Optional[str]
    ip_address: str
    user_agent: str
    resource: str
    action: str
    result: str
    risk_score: int
    details: Dict[str, Any] = field(default_factory=dict)

@dataclass
class SecurityPolicy:
    """Security policy configuration."""
    password_min_length: int = 12
    password_require_uppercase: bool = True
    password_require_lowercase: bool = True
    password_require_numbers: bool = True
    password_require_symbols: bool = True
    password_expiry_days: int = 90
    max_login_attempts: int = 5
    account_lockout_duration: int = 3600  # seconds
    session_timeout: int = 1800  # seconds
    mfa_required_roles: List[str] = field(default_factory=lambda: ["admin", "security"])
    ip_whitelist: List[str] = field(default_factory=list)
    rate_limit_requests: int = 100
    rate_limit_window: int = 3600  # seconds

class EncryptionManager:
    """Manages encryption and decryption operations."""
    
    def __init__(self, master_key: Optional[str] = None):
        self.logger = logging.getLogger(__name__)
        self.master_key = master_key or os.getenv('MASTER_ENCRYPTION_KEY')
        self.cipher_suite = self._setup_encryption()
        self.logger = logging.getLogger(__name__)

    def _setup_encryption(self) -> Optional[Fernet]:
        """Setup encryption cipher."""
        if not self.master_key:
            self.logger.warning("No master encryption key provided")
            return None
        
        try:
            # Derive key from master key
            password = self.master_key.encode()
            salt = b'pixelated_security_salt'  # In production, use random salt per encryption
            kdf = PBKDF2HMAC(
                algorithm=hashes.SHA256(),
                length=32,
                salt=salt,
                iterations=100000,
            )
            key = base64.urlsafe_b64encode(kdf.derive(password))
            return Fernet(key)
        except Exception as e:
            self.logger.error(f"Failed to setup encryption: {e}")
            return None

    def encrypt_data(self, data: str) -> Optional[str]:
        """Encrypt sensitive data."""
        if not self.cipher_suite:
            return data  # Return unencrypted if no cipher
        
        try:
            encrypted_data = self.cipher_suite.encrypt(data.encode())
            return base64.urlsafe_b64encode(encrypted_data).decode()
        except Exception as e:
            self.logger.error(f"Encryption failed: {e}")
            return None

    def decrypt_data(self, encrypted_data: str) -> Optional[str]:
        """Decrypt sensitive data."""
        if not self.cipher_suite:
            return encrypted_data  # Return as-is if no cipher
        
        try:
            decoded_data = base64.urlsafe_b64decode(encrypted_data.encode())
            decrypted_data = self.cipher_suite.decrypt(decoded_data)
            return decrypted_data.decode()
        except Exception as e:
            self.logger.error(f"Decryption failed: {e}")
            return None

    def generate_api_key(self) -> str:
        """Generate secure API key."""
        return secrets.token_urlsafe(32)

    def hash_password(self, password: str) -> str:
        """Hash password using bcrypt."""
        salt = bcrypt.gensalt()
        return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

    def verify_password(self, password: str, password_hash: str) -> bool:
        """Verify password against hash."""
        try:
            return bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8'))
        except Exception:
            return False

class AuthenticationManager:
    """Manages user authentication and authorization."""
    
    def __init__(self, encryption_manager: EncryptionManager, security_policy: SecurityPolicy):
        self.encryption = encryption_manager
        self.policy = security_policy
        self.users: Dict[str, User] = {}
        self.active_sessions: Dict[str, Dict[str, Any]] = {}
        self.logger = logging.getLogger(__name__)
        
        # JWT settings
        self.jwt_secret = os.getenv('JWT_SECRET', secrets.token_urlsafe(32))
        self.jwt_algorithm = 'HS256'
        self.jwt_expiry = timedelta(seconds=security_policy.session_timeout)

    def create_user(self, username: str, email: str, password: str, 
                   roles: List[str], security_level: SecurityLevel) -> User:
        """Create a new user account."""
        # Validate password
        if not self._validate_password(password):
            raise ValueError("Password does not meet security requirements")
        
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

    def authenticate_user(self, username: str, password: str, 
                         ip_address: str, user_agent: str) -> Optional[str]:
        """Authenticate user and return JWT token."""
        user = self._find_user_by_username(username)
        
        if not user:
            self.logger.warning(f"Authentication failed: user not found - {username}")
            return None
        
        if user.account_locked:
            self.logger.warning(f"Authentication failed: account locked - {username}")
            return None
        
        if not self.encryption.verify_password(password, user.password_hash):
            user.failed_login_attempts += 1
            
            if user.failed_login_attempts >= self.policy.max_login_attempts:
                user.account_locked = True
                self.logger.warning(f"Account locked due to failed attempts: {username}")
            
            self.logger.warning(f"Authentication failed: invalid password - {username}")
            return None
        
        # Reset failed attempts on successful login
        user.failed_login_attempts = 0
        user.last_login = datetime.now()
        
        # Generate JWT token
        token = self._generate_jwt_token(user)
        
        # Create session
        session_id = secrets.token_urlsafe(32)
        self.active_sessions[session_id] = {
            'user_id': user.user_id,
            'username': user.username,
            'roles': user.roles,
            'security_level': user.security_level.value,
            'ip_address': ip_address,
            'user_agent': user_agent,
            'created_at': datetime.now(),
            'last_activity': datetime.now()
        }
        
        self.logger.info(f"User authenticated successfully: {username}")
        return token

    def validate_token(self, token: str) -> Optional[Dict[str, Any]]:
        """Validate JWT token and return user info."""
        try:
            payload = jwt.decode(token, self.jwt_secret, algorithms=[self.jwt_algorithm])
            
            # Check expiration
            if datetime.fromtimestamp(payload['exp']) < datetime.now():
                return None
            
            user_id = payload['user_id']
            user = self.users.get(user_id)
            
            if not user or user.account_locked:
                return None
            
            return {
                'user_id': user.user_id,
                'username': user.username,
                'roles': user.roles,
                'security_level': user.security_level.value
            }
            
        except jwt.InvalidTokenError:
            return None

    def authorize_access(self, user_info: Dict[str, Any], resource: str, 
                        action: str, required_level: SecurityLevel) -> bool:
        """Authorize user access to resource."""
        user_level = SecurityLevel(user_info['security_level'])
        
        # Check security level hierarchy
        level_hierarchy = {
            SecurityLevel.PUBLIC: 0,
            SecurityLevel.INTERNAL: 1,
            SecurityLevel.CONFIDENTIAL: 2,
            SecurityLevel.RESTRICTED: 3,
            SecurityLevel.TOP_SECRET: 4
        }
        
        if level_hierarchy[user_level] < level_hierarchy[required_level]:
            return False
        
        # Additional role-based checks can be added here
        return True

    def _validate_password(self, password: str) -> bool:
        """Validate password against security policy."""
        if len(password) < self.policy.password_min_length:
            return False
        
        if self.policy.password_require_uppercase and not re.search(r'[A-Z]', password):
            return False
        
        if self.policy.password_require_lowercase and not re.search(r'[a-z]', password):
            return False
        
        if self.policy.password_require_numbers and not re.search(r'\d', password):
            return False
        
        if self.policy.password_require_symbols and not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
            return False
        
        return True

    def _find_user_by_username(self, username: str) -> Optional[User]:
        """Find user by username."""
        for user in self.users.values():
            if user.username == username:
                return user
        return None

    def _generate_jwt_token(self, user: User) -> str:
        """Generate JWT token for user."""
        payload = {
            'user_id': user.user_id,
            'username': user.username,
            'roles': user.roles,
            'security_level': user.security_level.value,
            'iat': datetime.now(),
            'exp': datetime.now() + self.jwt_expiry
        }
        
        return jwt.encode(payload, self.jwt_secret, algorithm=self.jwt_algorithm)

class SecurityMonitor:
    """Monitors security events and detects threats."""
    
    def __init__(self, security_policy: SecurityPolicy):
        self.policy = security_policy
        self.audit_logs: deque = deque(maxlen=10000)
        self.threat_scores: Dict[str, int] = defaultdict(int)
        self.rate_limits: Dict[str, List[datetime]] = defaultdict(list)
        self.logger = logging.getLogger(__name__)
        
        # Threat detection patterns
        self.threat_patterns = {
            'brute_force': {
                'events': [SecurityEvent.LOGIN_FAILURE],
                'threshold': 10,
                'window': 300  # 5 minutes
            },
            'privilege_escalation': {
                'events': [SecurityEvent.PRIVILEGE_ESCALATION],
                'threshold': 3,
                'window': 3600  # 1 hour
            },
            'suspicious_access': {
                'events': [SecurityEvent.UNAUTHORIZED_ACCESS, SecurityEvent.SECURITY_VIOLATION],
                'threshold': 5,
                'window': 1800  # 30 minutes
            }
        }

    def log_security_event(self, event_type: SecurityEvent, user_id: Optional[str],
                          ip_address: str, user_agent: str, resource: str,
                          action: str, result: str, details: Dict[str, Any] = None):
        """Log security event and analyze for threats."""
        audit_log = SecurityAuditLog(
            timestamp=datetime.now(),
            event_type=event_type,
            user_id=user_id,
            ip_address=ip_address,
            user_agent=user_agent,
            resource=resource,
            action=action,
            result=result,
            risk_score=self._calculate_risk_score(event_type, ip_address, user_id),
            details=details or {}
        )
        
        self.audit_logs.append(audit_log)
        
        # Analyze for threats
        self._analyze_threats(audit_log)
        
        # Log to file
        self.logger.info(f"Security event: {event_type.value} - {result} - {ip_address}")

    def check_rate_limit(self, ip_address: str) -> bool:
        """Check if IP address is within rate limits."""
        now = datetime.now()
        window_start = now - timedelta(seconds=self.policy.rate_limit_window)
        
        # Clean old entries
        self.rate_limits[ip_address] = [
            timestamp for timestamp in self.rate_limits[ip_address]
            if timestamp > window_start
        ]
        
        # Check current rate
        if len(self.rate_limits[ip_address]) >= self.policy.rate_limit_requests:
            return False
        
        # Add current request
        self.rate_limits[ip_address].append(now)
        return True

    def is_ip_whitelisted(self, ip_address: str) -> bool:
        """Check if IP address is whitelisted."""
        if not self.policy.ip_whitelist:
            return True  # No whitelist means all IPs allowed
        
        try:
            ip = ipaddress.ip_address(ip_address)
            for allowed_ip in self.policy.ip_whitelist:
                if ip in ipaddress.ip_network(allowed_ip, strict=False):
                    return True
            return False
        except ValueError:
            return False

    def get_threat_score(self, identifier: str) -> int:
        """Get current threat score for IP or user."""
        return self.threat_scores.get(identifier, 0)

    def _calculate_risk_score(self, event_type: SecurityEvent, 
                            ip_address: str, user_id: Optional[str]) -> int:
        """Calculate risk score for security event."""
        base_scores = {
            SecurityEvent.LOGIN_SUCCESS: 1,
            SecurityEvent.LOGIN_FAILURE: 3,
            SecurityEvent.UNAUTHORIZED_ACCESS: 7,
            SecurityEvent.PRIVILEGE_ESCALATION: 9,
            SecurityEvent.DATA_ACCESS: 2,
            SecurityEvent.SECURITY_VIOLATION: 8,
            SecurityEvent.SUSPICIOUS_ACTIVITY: 5
        }
        
        score = base_scores.get(event_type, 1)
        
        # Increase score for repeated events from same IP
        recent_events = [
            log for log in self.audit_logs
            if log.ip_address == ip_address and 
            log.timestamp > datetime.now() - timedelta(hours=1)
        ]
        
        if len(recent_events) > 5:
            score *= 2
        
        return min(score, 10)  # Cap at 10

    def _analyze_threats(self, audit_log: SecurityAuditLog):
        """Analyze security event for threat patterns."""
        for threat_name, pattern in self.threat_patterns.items():
            if audit_log.event_type in pattern['events']:
                self._check_threat_pattern(threat_name, pattern, audit_log)

    def _check_threat_pattern(self, threat_name: str, pattern: Dict[str, Any], 
                            audit_log: SecurityAuditLog):
        """Check if threat pattern is triggered."""
        window_start = datetime.now() - timedelta(seconds=pattern['window'])
        
        # Count matching events in time window
        matching_events = [
            log for log in self.audit_logs
            if (log.event_type in pattern['events'] and
                log.ip_address == audit_log.ip_address and
                log.timestamp > window_start)
        ]
        
        if len(matching_events) >= pattern['threshold']:
            self._trigger_threat_alert(threat_name, audit_log, len(matching_events))

    def _trigger_threat_alert(self, threat_name: str, audit_log: SecurityAuditLog, 
                            event_count: int):
        """Trigger threat alert."""
        self.threat_scores[audit_log.ip_address] += 10
        
        alert_details = {
            'threat_type': threat_name,
            'ip_address': audit_log.ip_address,
            'event_count': event_count,
            'user_id': audit_log.user_id,
            'timestamp': audit_log.timestamp.isoformat()
        }
        
        self.logger.critical(f"SECURITY THREAT DETECTED: {threat_name} - {audit_log.ip_address}")
        
        # In production, this would trigger alerts to security team
        self._send_security_alert(alert_details)

    def _send_security_alert(self, alert_details: Dict[str, Any]):
        """Send security alert to monitoring systems."""
        # This would integrate with alerting systems like PagerDuty, Slack, etc.
        self.logger.critical(f"Security alert: {json.dumps(alert_details)}")

class ProductionSecuritySystem:
    """Main production security system."""
    
    def __init__(self, config: Dict[str, Any] = None):
        self.config = config or {}
        self.logger = self._setup_logging()
        
        # Initialize security policy
        self.security_policy = SecurityPolicy(
            password_min_length=self.config.get('password_min_length', 12),
            max_login_attempts=self.config.get('max_login_attempts', 5),
            session_timeout=self.config.get('session_timeout', 1800),
            rate_limit_requests=self.config.get('rate_limit_requests', 100)
        )
        
        # Initialize components
        self.encryption = EncryptionManager(self.config.get('master_key'))
        self.auth_manager = AuthenticationManager(self.encryption, self.security_policy)
        self.security_monitor = SecurityMonitor(self.security_policy)
        
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
        admin_password = self.config.get('admin_password', 'TempAdmin123!')
        
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

    def authenticate_request(self, username: str, password: str, 
                           ip_address: str, user_agent: str) -> Dict[str, Any]:
        """Authenticate user request."""
        # Check rate limiting
        if not self.security_monitor.check_rate_limit(ip_address):
            self.security_monitor.log_security_event(
                SecurityEvent.SECURITY_VIOLATION,
                None, ip_address, user_agent,
                'authentication', 'rate_limit_exceeded', 'failure'
            )
            return {'success': False, 'error': 'Rate limit exceeded'}
        
        # Check IP whitelist
        if not self.security_monitor.is_ip_whitelisted(ip_address):
            self.security_monitor.log_security_event(
                SecurityEvent.UNAUTHORIZED_ACCESS,
                None, ip_address, user_agent,
                'authentication', 'ip_not_whitelisted', 'failure'
            )
            return {'success': False, 'error': 'IP address not authorized'}
        
        # Authenticate user
        token = self.auth_manager.authenticate_user(username, password, ip_address, user_agent)
        
        if token:
            self.security_monitor.log_security_event(
                SecurityEvent.LOGIN_SUCCESS,
                username, ip_address, user_agent,
                'authentication', 'login', 'success'
            )
            return {'success': True, 'token': token}
        else:
            self.security_monitor.log_security_event(
                SecurityEvent.LOGIN_FAILURE,
                username, ip_address, user_agent,
                'authentication', 'login', 'failure'
            )
            return {'success': False, 'error': 'Authentication failed'}

    def authorize_request(self, token: str, resource: str, action: str,
                         required_level: SecurityLevel = SecurityLevel.INTERNAL) -> Dict[str, Any]:
        """Authorize user request."""
        user_info = self.auth_manager.validate_token(token)
        
        if not user_info:
            return {'authorized': False, 'error': 'Invalid or expired token'}
        
        authorized = self.auth_manager.authorize_access(
            user_info, resource, action, required_level
        )
        
        if authorized:
            self.security_monitor.log_security_event(
                SecurityEvent.DATA_ACCESS,
                user_info['user_id'], 'unknown', 'unknown',
                resource, action, 'success'
            )
            return {'authorized': True, 'user_info': user_info}
        else:
            self.security_monitor.log_security_event(
                SecurityEvent.UNAUTHORIZED_ACCESS,
                user_info['user_id'], 'unknown', 'unknown',
                resource, action, 'failure'
            )
            return {'authorized': False, 'error': 'Insufficient privileges'}

    def get_security_status(self) -> Dict[str, Any]:
        """Get current security system status."""
        return {
            'active_users': len(self.auth_manager.users),
            'active_sessions': len(self.auth_manager.active_sessions),
            'audit_logs_count': len(self.security_monitor.audit_logs),
            'high_threat_ips': len([
                ip for ip, score in self.security_monitor.threat_scores.items()
                if score > 20
            ]),
            'security_policy': asdict(self.security_policy)
        }

    def generate_security_report(self) -> str:
        """Generate comprehensive security report."""
        report_file = f"security_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        
        # Analyze recent security events
        recent_logs = [
            log for log in self.security_monitor.audit_logs
            if log.timestamp > datetime.now() - timedelta(days=7)
        ]
        
        event_summary = defaultdict(int)
        for log in recent_logs:
            event_summary[log.event_type.value] += 1
        
        report = {
            'generated_at': datetime.now().isoformat(),
            'status': self.get_security_status(),
            'recent_events': dict(event_summary),
            'threat_scores': dict(self.security_monitor.threat_scores),
            'recent_audit_logs': [
                asdict(log) for log in recent_logs[-100:]  # Last 100 events
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
        'admin_password': 'SecureAdmin123!',
        'password_min_length': 8,  # Reduced for testing
        'max_login_attempts': 3
    }
    
    security_system = ProductionSecuritySystem(config)
    
    # Test authentication
    auth_result = security_system.authenticate_request(
        username='admin',
        password='SecureAdmin123!',
        ip_address='127.0.0.1',
        user_agent='Test-Agent/1.0'
    )
    
    print(f"✅ Authentication test: {'success' if auth_result['success'] else 'failed'}")
    
    if auth_result['success']:
        token = auth_result['token']
        
        # Test authorization
        auth_result = security_system.authorize_request(
            token=token,
            resource='user_data',
            action='read',
            required_level=SecurityLevel.CONFIDENTIAL
        )
        
        print(f"✅ Authorization test: {'authorized' if auth_result['authorized'] else 'denied'}")
    
    # Test failed authentication
    failed_auth = security_system.authenticate_request(
        username='admin',
        password='wrong_password',
        ip_address='127.0.0.1',
        user_agent='Test-Agent/1.0'
    )
    
    print(f"✅ Failed auth test: {'failed as expected' if not failed_auth['success'] else 'unexpected success'}")
    
    # Get security status
    status = security_system.get_security_status()
    print(f"✅ Active users: {status['active_users']}")
    print(f"✅ Audit logs: {status['audit_logs_count']}")
    
    # Generate security report
    report_file = security_system.generate_security_report()
    print(f"✅ Security report: {report_file}")
    
    print("\n🎉 Production security system is functional!")

if __name__ == "__main__":
    main()
