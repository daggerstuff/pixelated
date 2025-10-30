#!/usr/bin/env python3
"""
Pixelated Empathy AI - API Security Middleware
Task 1.3: Add API Security Middleware

Enterprise-grade security middleware with input validation, XSS protection, CSRF tokens, and comprehensive security headers.
"""

import re
import json
import html
import secrets
import hashlib
import time
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Any, Set, Tuple
from enum import Enum
import logging
from urllib.parse import urlparse, parse_qs
from fastapi import Request, Response, HTTPException, status
from fastapi.responses import JSONResponse
from fastapi.security.utils import get_authorization_scheme_param
import bleach
from pydantic import BaseModel, validator
import ipaddress
import user_agents
from pathlib import Path
import sqlite3

logger = logging.getLogger(__name__)

class SecurityLevel(str, Enum):
    """Security levels"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class ThreatType(str, Enum):
    """Security threat types"""
    XSS = "xss"
    SQL_INJECTION = "sql_injection"
    CSRF = "csrf"
    BRUTE_FORCE = "brute_force"
    MALICIOUS_INPUT = "malicious_input"
    SUSPICIOUS_PATTERN = "suspicious_pattern"
    RATE_LIMIT_ABUSE = "rate_limit_abuse"
    UNAUTHORIZED_ACCESS = "unauthorized_access"

class SecurityEvent(BaseModel):
    """Security event model"""
    timestamp: datetime
    threat_type: ThreatType
    severity: SecurityLevel
    ip_address: str
    user_agent: Optional[str]
    user_id: Optional[str]
    endpoint: str
    method: str
    payload: Optional[str]
    blocked: bool
    details: Dict[str, Any]

class CSRFToken(BaseModel):
    """CSRF token model"""
    token: str
    user_id: Optional[str]
    ip_address: str
    expires_at: datetime
    used: bool = False

class SecurityConfig:
    """Security configuration"""
    
    # XSS protection patterns
    XSS_PATTERNS = [
        r'<script[^>]*>.*?</script>',
        r'javascript:',
        r'on\w+\s*=',
        r'<iframe[^>]*>.*?</iframe>',
        r'<object[^>]*>.*?</object>',
        r'<embed[^>]*>.*?</embed>',
        r'<link[^>]*>',
        r'<meta[^>]*>',
        r'<style[^>]*>.*?</style>',
        r'expression\s*\(',
        r'url\s*\(',
        r'@import',
        r'vbscript:',
        r'data:text/html',
    ]
    
    # SQL injection patterns
    SQL_INJECTION_PATTERNS = [
        r'(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)',
        r'(\b(OR|AND)\s+\d+\s*=\s*\d+)',
        r'(\b(OR|AND)\s+[\'"][^\'"]*[\'"])',
        r'(--|#|/\*|\*/)',
        r'(\bUNION\s+(ALL\s+)?SELECT)',
        r'(\bINSERT\s+INTO)',
        r'(\bDROP\s+TABLE)',
        r'(\bCREATE\s+TABLE)',
        r'(\bALTER\s+TABLE)',
        r'(\bEXEC\s*\()',
        r'(\bsp_\w+)',
        r'(\bxp_\w+)',
    ]
    
    # Malicious patterns
    MALICIOUS_PATTERNS = [
        r'\.\./',  # Directory traversal
        r'\\x[0-9a-fA-F]{2}',  # Hex encoding
        r'%[0-9a-fA-F]{2}',  # URL encoding
        r'\\u[0-9a-fA-F]{4}',  # Unicode encoding
        r'eval\s*\(',  # Code evaluation
        r'exec\s*\(',  # Code execution
        r'system\s*\(',  # System commands
        r'shell_exec\s*\(',  # Shell execution
        r'passthru\s*\(',  # Command execution
        r'file_get_contents\s*\(',  # File access
        r'fopen\s*\(',  # File operations
        r'curl_exec\s*\(',  # Network requests
        r'base64_decode\s*\(',  # Encoding/decoding
    ]
    
    # Allowed HTML tags for content sanitization
    ALLOWED_HTML_TAGS = [
        'p', 'br', 'strong', 'em', 'u', 'i', 'b',
        'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'blockquote', 'code', 'pre'
    ]
    
    # Allowed HTML attributes
    ALLOWED_HTML_ATTRIBUTES = {
        '*': ['class', 'id'],
        'a': ['href', 'title'],
        'img': ['src', 'alt', 'title', 'width', 'height'],
    }
    
    # Security headers
    SECURITY_HEADERS = {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
        'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' https:; connect-src 'self' https:; frame-ancestors 'none';",
    }
    
    # Rate limiting for security events
    MAX_SECURITY_EVENTS_PER_IP = 10
    SECURITY_EVENT_WINDOW = 300  # 5 minutes
    
    # CSRF token settings
    CSRF_TOKEN_LENGTH = 32
    CSRF_TOKEN_EXPIRY = 3600  # 1 hour

class SecurityStorage:
    """Security event storage"""
    
    def __init__(self, db_path: Optional[str] = None):
        """Initialize security storage"""
        self.db_path = db_path or str(Path(__file__).parent / "security.db")
        self._init_database()
    
    def _init_database(self):
        """Initialize SQLite database"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Security events table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS security_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TIMESTAMP NOT NULL,
                    threat_type TEXT NOT NULL,
                    severity TEXT NOT NULL,
                    ip_address TEXT NOT NULL,
                    user_agent TEXT,
                    user_id TEXT,
                    endpoint TEXT NOT NULL,
                    method TEXT NOT NULL,
                    payload TEXT,
                    blocked BOOLEAN NOT NULL,
                    details TEXT NOT NULL
                )
            """)
            
            # CSRF tokens table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS csrf_tokens (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    token TEXT UNIQUE NOT NULL,
                    user_id TEXT,
                    ip_address TEXT NOT NULL,
                    expires_at TIMESTAMP NOT NULL,
                    used BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # IP blacklist table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS ip_blacklist (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    ip_address TEXT UNIQUE NOT NULL,
                    reason TEXT NOT NULL,
                    blocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    expires_at TIMESTAMP,
                    is_active BOOLEAN DEFAULT TRUE
                )
            """)
            
            # Create indexes
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_security_events_ip ON security_events(ip_address)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_security_events_timestamp ON security_events(timestamp)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_csrf_tokens_token ON csrf_tokens(token)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_ip_blacklist_ip ON ip_blacklist(ip_address)")
            
            conn.commit()
            conn.close()
            logger.info("Security database initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize security database: {e}")
            raise
    
    def log_security_event(self, event: SecurityEvent):
        """Log security event"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute("""
                INSERT INTO security_events 
                (timestamp, threat_type, severity, ip_address, user_agent, user_id, 
                 endpoint, method, payload, blocked, details)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                event.timestamp,
                event.threat_type.value,
                event.severity.value,
                event.ip_address,
                event.user_agent,
                event.user_id,
                event.endpoint,
                event.method,
                event.payload,
                event.blocked,
                json.dumps(event.details)
            ))
            
            conn.commit()
            conn.close()
            
        except Exception as e:
            logger.error(f"Failed to log security event: {e}")
    
    def get_security_events_count(self, ip_address: str, window_seconds: int) -> int:
        """Get security events count for IP within time window"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            since_time = datetime.now(timezone.utc) - timedelta(seconds=window_seconds)
            
            cursor.execute("""
                SELECT COUNT(*) FROM security_events 
                WHERE ip_address = ? AND timestamp > ? AND blocked = TRUE
            """, (ip_address, since_time))
            
            count = cursor.fetchone()[0]
            conn.close()
            
            return count
            
        except Exception as e:
            logger.error(f"Failed to get security events count: {e}")
            return 0
    
    def is_ip_blacklisted(self, ip_address: str) -> bool:
        """Check if IP is blacklisted"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT COUNT(*) FROM ip_blacklist 
                WHERE ip_address = ? AND is_active = TRUE 
                AND (expires_at IS NULL OR expires_at > datetime('now'))
            """, (ip_address,))
            
            count = cursor.fetchone()[0]
            conn.close()
            
            return count > 0
            
        except Exception as e:
            logger.error(f"Failed to check IP blacklist: {e}")
            return False
    
    def blacklist_ip(self, ip_address: str, reason: str, duration_hours: Optional[int] = None):
        """Add IP to blacklist"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            expires_at = None
            if duration_hours:
                expires_at = datetime.now(timezone.utc) + timedelta(hours=duration_hours)
            
            cursor.execute("""
                INSERT OR REPLACE INTO ip_blacklist (ip_address, reason, expires_at)
                VALUES (?, ?, ?)
            """, (ip_address, reason, expires_at))
            
            conn.commit()
            conn.close()
            
            logger.warning(f"IP blacklisted: {ip_address} - {reason}")
            
        except Exception as e:
            logger.error(f"Failed to blacklist IP: {e}")
    
    def store_csrf_token(self, token: CSRFToken):
        """Store CSRF token"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute("""
                INSERT INTO csrf_tokens (token, user_id, ip_address, expires_at)
                VALUES (?, ?, ?, ?)
            """, (token.token, token.user_id, token.ip_address, token.expires_at))
            
            conn.commit()
            conn.close()
            
        except Exception as e:
            logger.error(f"Failed to store CSRF token: {e}")
    
    def validate_csrf_token(self, token: str, user_id: Optional[str], ip_address: str) -> bool:
        """Validate CSRF token"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT id FROM csrf_tokens 
                WHERE token = ? AND ip_address = ? AND expires_at > datetime('now') 
                AND used = FALSE AND (user_id IS NULL OR user_id = ?)
            """, (token, ip_address, user_id))
            
            result = cursor.fetchone()
            
            if result:
                # Mark token as used
                cursor.execute("""
                    UPDATE csrf_tokens SET used = TRUE WHERE id = ?
                """, (result[0],))
                conn.commit()
                conn.close()
                return True
            
            conn.close()
            return False
            
        except Exception as e:
            logger.error(f"Failed to validate CSRF token: {e}")
            return False

class SecurityMiddleware:
    """Enterprise-grade security middleware"""
    
    def __init__(self, storage: Optional[SecurityStorage] = None):
        """Initialize security middleware"""
        self.storage = storage or SecurityStorage()
        self.config = SecurityConfig()
        
        # Compile regex patterns for performance
        self.xss_patterns = [re.compile(pattern, re.IGNORECASE) for pattern in self.config.XSS_PATTERNS]
        self.sql_patterns = [re.compile(pattern, re.IGNORECASE) for pattern in self.config.SQL_INJECTION_PATTERNS]
        self.malicious_patterns = [re.compile(pattern, re.IGNORECASE) for pattern in self.config.MALICIOUS_PATTERNS]
        
        logger.info("Security middleware initialized successfully")
    
    def _get_client_ip(self, request: Request) -> str:
        """Get client IP address"""
        # Check for forwarded headers
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()
        
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip
        
        return request.client.host if request.client else "unknown"
    
    def _get_user_agent(self, request: Request) -> str:
        """Get user agent"""
        return request.headers.get("User-Agent", "unknown")
    
    def _detect_xss(self, text: str) -> List[str]:
        """Detect XSS patterns in text"""
        detected = []
        for pattern in self.xss_patterns:
            if pattern.search(text):
                detected.append(pattern.pattern)
        return detected
    
    def _detect_sql_injection(self, text: str) -> List[str]:
        """Detect SQL injection patterns in text"""
        detected = []
        for pattern in self.sql_patterns:
            if pattern.search(text):
                detected.append(pattern.pattern)
        return detected
    
    def _detect_malicious_patterns(self, text: str) -> List[str]:
        """Detect malicious patterns in text"""
        detected = []
        for pattern in self.malicious_patterns:
            if pattern.search(text):
                detected.append(pattern.pattern)
        return detected
    
    def _sanitize_html(self, text: str) -> str:
        """Sanitize HTML content"""
        return bleach.clean(
            text,
            tags=self.config.ALLOWED_HTML_TAGS,
            attributes=self.config.ALLOWED_HTML_ATTRIBUTES,
            strip=True
        )
    
    def _validate_input(self, data: Any, path: str = "") -> Tuple[bool, List[str]]:
        """Validate input data for security threats"""
        threats = []
        
        if isinstance(data, str):
            # Check for XSS
            xss_threats = self._detect_xss(data)
            if xss_threats:
                threats.extend([f"XSS:{path}:{threat}" for threat in xss_threats])
            
            # Check for SQL injection
            sql_threats = self._detect_sql_injection(data)
            if sql_threats:
                threats.extend([f"SQL:{path}:{threat}" for threat in sql_threats])
            
            # Check for malicious patterns
            malicious_threats = self._detect_malicious_patterns(data)
            if malicious_threats:
                threats.extend([f"MALICIOUS:{path}:{threat}" for threat in malicious_threats])
        
        elif isinstance(data, dict):
            for key, value in data.items():
                is_safe, sub_threats = self._validate_input(value, f"{path}.{key}")
                threats.extend(sub_threats)
        
        elif isinstance(data, list):
            for i, item in enumerate(data):
                is_safe, sub_threats = self._validate_input(item, f"{path}[{i}]")
                threats.extend(sub_threats)
        
        return len(threats) == 0, threats
    
    def _analyze_user_agent(self, user_agent: str) -> Dict[str, Any]:
        """Analyze user agent for suspicious patterns"""
        analysis = {
            "is_bot": False,
            "is_suspicious": False,
            "details": {}
        }
        
        try:
            ua = user_agents.parse(user_agent)
            analysis["details"] = {
                "browser": ua.browser.family,
                "browser_version": ua.browser.version_string,
                "os": ua.os.family,
                "os_version": ua.os.version_string,
                "device": ua.device.family,
                "is_mobile": ua.is_mobile,
                "is_tablet": ua.is_tablet,
                "is_pc": ua.is_pc,
                "is_bot": ua.is_bot
            }
            
            analysis["is_bot"] = ua.is_bot
            
            # Check for suspicious patterns
            suspicious_patterns = [
                r'curl',
                r'wget',
                r'python',
                r'java',
                r'perl',
                r'ruby',
                r'php',
                r'scanner',
                r'bot',
                r'crawler',
                r'spider',
                r'scraper'
            ]
            
            for pattern in suspicious_patterns:
                if re.search(pattern, user_agent, re.IGNORECASE):
                    analysis["is_suspicious"] = True
                    break
            
        except Exception as e:
            logger.error(f"Failed to analyze user agent: {e}")
            analysis["is_suspicious"] = True
        
        return analysis
    
    def _generate_csrf_token(self, user_id: Optional[str], ip_address: str) -> str:
        """Generate CSRF token"""
        token = secrets.token_urlsafe(self.config.CSRF_TOKEN_LENGTH)
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=self.config.CSRF_TOKEN_EXPIRY)
        
        csrf_token = CSRFToken(
            token=token,
            user_id=user_id,
            ip_address=ip_address,
            expires_at=expires_at
        )
        
        self.storage.store_csrf_token(csrf_token)
        return token
    
    def _validate_csrf_token(self, request: Request, user_id: Optional[str]) -> bool:
        """Validate CSRF token"""
        # Skip CSRF validation for GET, HEAD, OPTIONS
        if request.method in ["GET", "HEAD", "OPTIONS"]:
            return True
        
        ip_address = self._get_client_ip(request)
        
        # Check for CSRF token in headers
        csrf_token = request.headers.get("X-CSRF-Token")
        
        if not csrf_token:
            # Check in form data or JSON body
            if hasattr(request.state, "body_data"):
                body_data = request.state.body_data
                if isinstance(body_data, dict):
                    csrf_token = body_data.get("csrf_token")
        
        if not csrf_token:
            return False
        
        return self.storage.validate_csrf_token(csrf_token, user_id, ip_address)
    
    def _log_security_event(self, request: Request, threat_type: ThreatType, 
                           severity: SecurityLevel, blocked: bool, details: Dict[str, Any]):
        """Log security event"""
        ip_address = self._get_client_ip(request)
        user_agent = self._get_user_agent(request)
        user_id = getattr(request.state, "user_id", None)
        
        event = SecurityEvent(
            timestamp=datetime.now(timezone.utc),
            threat_type=threat_type,
            severity=severity,
            ip_address=ip_address,
            user_agent=user_agent,
            user_id=user_id,
            endpoint=str(request.url.path),
            method=request.method,
            payload=getattr(request.state, "raw_body", None),
            blocked=blocked,
            details=details
        )
        
        self.storage.log_security_event(event)
        
        # Auto-blacklist IPs with too many security events
        if blocked and severity in [SecurityLevel.HIGH, SecurityLevel.CRITICAL]:
            event_count = self.storage.get_security_events_count(
                ip_address, 
                self.config.SECURITY_EVENT_WINDOW
            )
            
            if event_count >= self.config.MAX_SECURITY_EVENTS_PER_IP:
                self.storage.blacklist_ip(
                    ip_address, 
                    f"Too many security events ({event_count})",
                    duration_hours=24
                )
    
    async def __call__(self, request: Request, call_next) -> Response:
        """Security middleware main function"""
        ip_address = self._get_client_ip(request)
        user_agent = self._get_user_agent(request)
        
        # Check IP blacklist
        if self.storage.is_ip_blacklisted(ip_address):
            self._log_security_event(
                request,
                ThreatType.UNAUTHORIZED_ACCESS,
                SecurityLevel.HIGH,
                True,
                {"reason": "IP blacklisted"}
            )
            
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={"error": "Access denied", "message": "Your IP address has been blocked"}
            )
        
        # Analyze user agent
        ua_analysis = self._analyze_user_agent(user_agent)
        if ua_analysis["is_suspicious"] and not ua_analysis["is_bot"]:
            self._log_security_event(
                request,
                ThreatType.SUSPICIOUS_PATTERN,
                SecurityLevel.MEDIUM,
                False,
                {"user_agent_analysis": ua_analysis}
            )
        
        # Read and validate request body
        if request.method in ["POST", "PUT", "PATCH"]:
            try:
                body = await request.body()
                request.state.raw_body = body.decode('utf-8') if body else None
                
                if body:
                    # Try to parse JSON
                    try:
                        body_data = json.loads(body)
                        request.state.body_data = body_data
                        
                        # Validate input
                        is_safe, threats = self._validate_input(body_data)
                        
                        if not is_safe:
                            self._log_security_event(
                                request,
                                ThreatType.MALICIOUS_INPUT,
                                SecurityLevel.HIGH,
                                True,
                                {"threats": threats}
                            )
                            
                            return JSONResponse(
                                status_code=status.HTTP_400_BAD_REQUEST,
                                content={
                                    "error": "Invalid input",
                                    "message": "Request contains potentially malicious content"
                                }
                            )
                    
                    except json.JSONDecodeError:
                        # Handle form data or other content types
                        pass
            
            except Exception as e:
                logger.error(f"Failed to read request body: {e}")
        
        # Validate CSRF token for state-changing operations
        user_id = getattr(request.state, "user_id", None)
        if not self._validate_csrf_token(request, user_id):
            self._log_security_event(
                request,
                ThreatType.CSRF,
                SecurityLevel.HIGH,
                True,
                {"reason": "Invalid or missing CSRF token"}
            )
            
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={
                    "error": "CSRF token validation failed",
                    "message": "Invalid or missing CSRF token"
                }
            )
        
        # Process request
        response = await call_next(request)
        
        # Add security headers
        for header, value in self.config.SECURITY_HEADERS.items():
            response.headers[header] = value
        
        # Add CSRF token to response for authenticated users
        if user_id and request.method == "GET":
            csrf_token = self._generate_csrf_token(user_id, ip_address)
            response.headers["X-CSRF-Token"] = csrf_token
        
        return response
    
    def get_csrf_token(self, user_id: Optional[str], ip_address: str) -> str:
        """Generate CSRF token for user"""
        return self._generate_csrf_token(user_id, ip_address)
    
    def get_security_stats(self, hours: int = 24) -> Dict[str, Any]:
        """Get security statistics"""
        try:
            conn = sqlite3.connect(self.storage.db_path)
            cursor = conn.cursor()
            
            since_time = datetime.now(timezone.utc) - timedelta(hours=hours)
            
            # Total events
            cursor.execute("""
                SELECT COUNT(*) FROM security_events WHERE timestamp > ?
            """, (since_time,))
            total_events = cursor.fetchone()[0]
            
            # Events by threat type
            cursor.execute("""
                SELECT threat_type, COUNT(*) FROM security_events 
                WHERE timestamp > ? GROUP BY threat_type
            """, (since_time,))
            events_by_type = dict(cursor.fetchall())
            
            # Events by severity
            cursor.execute("""
                SELECT severity, COUNT(*) FROM security_events 
                WHERE timestamp > ? GROUP BY severity
            """, (since_time,))
            events_by_severity = dict(cursor.fetchall())
            
            # Blocked events
            cursor.execute("""
                SELECT COUNT(*) FROM security_events 
                WHERE timestamp > ? AND blocked = TRUE
            """, (since_time,))
            blocked_events = cursor.fetchone()[0]
            
            # Top attacking IPs
            cursor.execute("""
                SELECT ip_address, COUNT(*) as count FROM security_events 
                WHERE timestamp > ? AND blocked = TRUE 
                GROUP BY ip_address ORDER BY count DESC LIMIT 10
            """, (since_time,))
            top_attacking_ips = cursor.fetchall()
            
            # Blacklisted IPs
            cursor.execute("""
                SELECT COUNT(*) FROM ip_blacklist WHERE is_active = TRUE
            """, ())
            blacklisted_ips = cursor.fetchone()[0]
            
            conn.close()
            
            return {
                "total_events": total_events,
                "blocked_events": blocked_events,
                "events_by_type": events_by_type,
                "events_by_severity": events_by_severity,
                "top_attacking_ips": top_attacking_ips,
                "blacklisted_ips": blacklisted_ips,
                "time_window_hours": hours
            }
            
        except Exception as e:
            logger.error(f"Failed to get security stats: {e}")
            return {}

# Global security middleware instance
security_middleware = SecurityMiddleware()

if __name__ == "__main__":
    # Test the security middleware
    middleware = SecurityMiddleware()
    print("Security middleware initialized successfully")
    
    # Test input validation
    test_inputs = [
        "Hello world",  # Safe
        "<script>alert('xss')</script>",  # XSS
        "'; DROP TABLE users; --",  # SQL injection
        "../../../etc/passwd",  # Directory traversal
    ]
    
    for test_input in test_inputs:
        is_safe, threats = middleware._validate_input(test_input)
        print(f"Input: {test_input[:50]}... - Safe: {is_safe}, Threats: {threats}")
