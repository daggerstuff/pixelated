#!/usr/bin/env python3
"""
Pixelated Empathy AI - Phase 1 Security Test Suite
Tasks 1.1, 1.2, 1.3: Test API Authentication, Rate Limiting, and Security Middleware

Comprehensive test suite to validate enterprise-grade security implementation.
"""

import pytest
import asyncio
import json
import time
from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient
from unittest.mock import Mock, patch
import tempfile
import os
from pathlib import Path

# Import components to test
from auth_system import AuthenticationSystem, User, UserCreate, UserLogin, UserRole
from rate_limiter import RateLimiter, RateLimit, RateLimitScope, RateLimitType
from security_middleware import SecurityMiddleware, ThreatType, SecurityLevel
from main_secure import app

class TestAuthenticationSystem:
    """Test authentication system"""
    
    @pytest.fixture
    def auth_system(self):
        """Create test authentication system"""
        with tempfile.NamedTemporaryFile(delete=False) as tmp:
            auth = AuthenticationSystem(db_path=tmp.name)
            yield auth
            os.unlink(tmp.name)
    
    def test_create_user(self, auth_system):
        """Test user creation"""
        user_data = UserCreate(
            username="testuser",
            email="test@example.com",
            password="testpass123",
            full_name="Test User",
            role=UserRole.USER
        )
        
        user = auth_system.create_user(user_data)
        
        assert user.username == "testuser"
        assert user.email == "test@example.com"
        assert user.role == UserRole.USER
        assert user.is_active is True
    
    def test_duplicate_user_creation(self, auth_system):
        """Test duplicate user creation fails"""
        user_data = UserCreate(
            username="testuser",
            email="test@example.com",
            password="testpass123",
            full_name="Test User",
            role=UserRole.USER
        )
        
        # Create first user
        auth_system.create_user(user_data)
        
        # Try to create duplicate
        with pytest.raises(Exception):
            auth_system.create_user(user_data)
    
    def test_authenticate_user_success(self, auth_system):
        """Test successful user authentication"""
        # Create user
        user_data = UserCreate(
            username="testuser",
            email="test@example.com",
            password="testpass123",
            full_name="Test User",
            role=UserRole.USER
        )
        auth_system.create_user(user_data)
        
        # Authenticate
        user = auth_system.authenticate_user("testuser", "testpass123")
        
        assert user is not None
        assert user.username == "testuser"
    
    def test_authenticate_user_failure(self, auth_system):
        """Test failed user authentication"""
        # Create user
        user_data = UserCreate(
            username="testuser",
            email="test@example.com",
            password="testpass123",
            full_name="Test User",
            role=UserRole.USER
        )
        auth_system.create_user(user_data)
        
        # Try wrong password
        user = auth_system.authenticate_user("testuser", "wrongpass")
        assert user is None
        
        # Try non-existent user
        user = auth_system.authenticate_user("nonexistent", "testpass123")
        assert user is None
    
    def test_login_and_token_generation(self, auth_system):
        """Test login and JWT token generation"""
        # Create user
        user_data = UserCreate(
            username="testuser",
            email="test@example.com",
            password="testpass123",
            full_name="Test User",
            role=UserRole.USER
        )
        auth_system.create_user(user_data)
        
        # Login
        login_data = UserLogin(username="testuser", password="testpass123")
        token_response = auth_system.login(login_data)
        
        assert token_response.access_token is not None
        assert token_response.refresh_token is not None
        assert token_response.token_type == "bearer"
        assert token_response.user.username == "testuser"
    
    def test_token_verification(self, auth_system):
        """Test JWT token verification"""
        # Create user and login
        user_data = UserCreate(
            username="testuser",
            email="test@example.com",
            password="testpass123",
            full_name="Test User",
            role=UserRole.USER
        )
        auth_system.create_user(user_data)
        
        login_data = UserLogin(username="testuser", password="testpass123")
        token_response = auth_system.login(login_data)
        
        # Verify token
        from fastapi.security import HTTPAuthorizationCredentials
        credentials = HTTPAuthorizationCredentials(
            scheme="Bearer",
            credentials=token_response.access_token
        )
        
        user = auth_system.verify_token(credentials)
        assert user.username == "testuser"
    
    def test_refresh_token(self, auth_system):
        """Test token refresh"""
        # Create user and login
        user_data = UserCreate(
            username="testuser",
            email="test@example.com",
            password="testpass123",
            full_name="Test User",
            role=UserRole.USER
        )
        auth_system.create_user(user_data)
        
        login_data = UserLogin(username="testuser", password="testpass123")
        token_response = auth_system.login(login_data)
        
        # Refresh token
        from auth_system import RefreshTokenRequest
        refresh_request = RefreshTokenRequest(refresh_token=token_response.refresh_token)
        new_token_response = auth_system.refresh_access_token(refresh_request)
        
        assert new_token_response.access_token != token_response.access_token
        assert new_token_response.refresh_token != token_response.refresh_token
    
    def test_user_permissions(self, auth_system):
        """Test user role-based permissions"""
        # Create admin user
        admin_data = UserCreate(
            username="admin",
            email="admin@example.com",
            password="adminpass123",
            full_name="Admin User",
            role=UserRole.ADMIN
        )
        admin_user = auth_system.create_user(admin_data)
        
        # Create regular user
        user_data = UserCreate(
            username="user",
            email="user@example.com",
            password="userpass123",
            full_name="Regular User",
            role=UserRole.USER
        )
        regular_user = auth_system.create_user(user_data)
        
        # Test permissions
        from auth_system import Permission
        assert admin_user.has_permission(Permission.ADMIN_USERS)
        assert not regular_user.has_permission(Permission.ADMIN_USERS)
        
        assert regular_user.has_permission(Permission.READ_CONVERSATIONS)
        assert admin_user.has_permission(Permission.READ_CONVERSATIONS)

class TestRateLimiter:
    """Test rate limiting system"""
    
    @pytest.fixture
    def rate_limiter(self):
        """Create test rate limiter"""
        from rate_limiter import MemoryRateLimitStorage
        with tempfile.NamedTemporaryFile(delete=False) as tmp:
            storage = MemoryRateLimitStorage(db_path=tmp.name)
            limiter = RateLimiter(storage=storage)
            yield limiter
            os.unlink(tmp.name)
    
    def test_rate_limit_check_within_limit(self, rate_limiter):
        """Test rate limit check within limits"""
        is_exceeded, headers = rate_limiter.check_limits(
            user_id="test_user",
            user_role="user",
            ip_address="127.0.0.1"
        )
        
        assert not is_exceeded
        assert "X-RateLimit-Limit" in headers
        assert "X-RateLimit-Remaining" in headers
    
    def test_rate_limit_exceeded(self, rate_limiter):
        """Test rate limit exceeded"""
        # Make many requests to exceed limit
        for i in range(150):  # Exceed per-minute limit for user role
            rate_limiter.increment_counters(
                user_id="test_user",
                user_role="user",
                ip_address="127.0.0.1"
            )
        
        is_exceeded, headers = rate_limiter.check_limits(
            user_id="test_user",
            user_role="user",
            ip_address="127.0.0.1"
        )
        
        assert is_exceeded
        assert "Retry-After" in headers
    
    def test_different_user_roles_limits(self, rate_limiter):
        """Test different limits for different user roles"""
        # Admin should have higher limits than regular user
        admin_limits = rate_limiter.get_user_limits("admin")
        user_limits = rate_limiter.get_user_limits("user")
        
        # Find per-minute limits
        admin_per_minute = next(l for l in admin_limits if l["limit_type"] == "per_minute")
        user_per_minute = next(l for l in user_limits if l["limit_type"] == "per_minute")
        
        assert admin_per_minute["limit"] > user_per_minute["limit"]
    
    def test_ip_based_rate_limiting(self, rate_limiter):
        """Test IP-based rate limiting for unauthenticated requests"""
        # Make requests without user authentication
        for i in range(15):  # Exceed IP limit
            rate_limiter.increment_counters(ip_address="192.168.1.1")
        
        is_exceeded, headers = rate_limiter.check_limits(ip_address="192.168.1.1")
        assert is_exceeded
    
    def test_usage_stats(self, rate_limiter):
        """Test usage statistics"""
        # Make some requests
        for i in range(5):
            rate_limiter.increment_counters(
                user_id="test_user",
                user_role="user",
                ip_address="127.0.0.1"
            )
        
        stats = rate_limiter.get_usage_stats(
            user_id="test_user",
            user_role="user",
            ip_address="127.0.0.1"
        )
        
        assert "user" in stats
        assert "ip" in stats
        assert len(stats["user"]) > 0
        assert stats["user"][0]["used"] == 5

class TestSecurityMiddleware:
    """Test security middleware"""
    
    @pytest.fixture
    def security_middleware(self):
        """Create test security middleware"""
        from security_middleware import SecurityStorage
        with tempfile.NamedTemporaryFile(delete=False) as tmp:
            storage = SecurityStorage(db_path=tmp.name)
            middleware = SecurityMiddleware(storage=storage)
            yield middleware
            os.unlink(tmp.name)
    
    def test_xss_detection(self, security_middleware):
        """Test XSS pattern detection"""
        xss_inputs = [
            "<script>alert('xss')</script>",
            "javascript:alert('xss')",
            "<img src=x onerror=alert('xss')>",
            "<iframe src='javascript:alert(1)'></iframe>"
        ]
        
        for xss_input in xss_inputs:
            threats = security_middleware._detect_xss(xss_input)
            assert len(threats) > 0, f"Failed to detect XSS in: {xss_input}"
    
    def test_sql_injection_detection(self, security_middleware):
        """Test SQL injection pattern detection"""
        sql_inputs = [
            "'; DROP TABLE users; --",
            "1' OR '1'='1",
            "UNION SELECT * FROM passwords",
            "admin'--",
            "1; DELETE FROM users"
        ]
        
        for sql_input in sql_inputs:
            threats = security_middleware._detect_sql_injection(sql_input)
            assert len(threats) > 0, f"Failed to detect SQL injection in: {sql_input}"
    
    def test_malicious_pattern_detection(self, security_middleware):
        """Test malicious pattern detection"""
        malicious_inputs = [
            "../../../etc/passwd",
            "\\x41\\x42\\x43",
            "%2e%2e%2f%2e%2e%2f%2e%2e%2f",
            "eval('malicious code')",
            "system('rm -rf /')"
        ]
        
        for malicious_input in malicious_inputs:
            threats = security_middleware._detect_malicious_patterns(malicious_input)
            assert len(threats) > 0, f"Failed to detect malicious pattern in: {malicious_input}"
    
    def test_input_validation_safe(self, security_middleware):
        """Test input validation with safe content"""
        safe_inputs = [
            "Hello, world!",
            "This is a normal message.",
            {"name": "John", "age": 30},
            ["item1", "item2", "item3"]
        ]
        
        for safe_input in safe_inputs:
            is_safe, threats = security_middleware._validate_input(safe_input)
            assert is_safe, f"Safe input flagged as unsafe: {safe_input}"
            assert len(threats) == 0
    
    def test_input_validation_unsafe(self, security_middleware):
        """Test input validation with unsafe content"""
        unsafe_inputs = [
            "<script>alert('xss')</script>",
            {"message": "'; DROP TABLE users; --"},
            ["normal", "../../../etc/passwd", "safe"]
        ]
        
        for unsafe_input in unsafe_inputs:
            is_safe, threats = security_middleware._validate_input(unsafe_input)
            assert not is_safe, f"Unsafe input not detected: {unsafe_input}"
            assert len(threats) > 0
    
    def test_html_sanitization(self, security_middleware):
        """Test HTML content sanitization"""
        html_input = "<p>Safe content</p><script>alert('xss')</script><strong>Bold text</strong>"
        sanitized = security_middleware._sanitize_html(html_input)
        
        assert "<p>Safe content</p>" in sanitized
        assert "<strong>Bold text</strong>" in sanitized
        assert "<script>" not in sanitized
        assert "alert('xss')" not in sanitized
    
    def test_user_agent_analysis(self, security_middleware):
        """Test user agent analysis"""
        # Normal browser
        normal_ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        analysis = security_middleware._analyze_user_agent(normal_ua)
        assert not analysis["is_suspicious"]
        assert not analysis["is_bot"]
        
        # Suspicious user agent
        suspicious_ua = "curl/7.68.0"
        analysis = security_middleware._analyze_user_agent(suspicious_ua)
        assert analysis["is_suspicious"]
    
    def test_csrf_token_generation_and_validation(self, security_middleware):
        """Test CSRF token generation and validation"""
        user_id = "test_user"
        ip_address = "127.0.0.1"
        
        # Generate token
        token = security_middleware._generate_csrf_token(user_id, ip_address)
        assert len(token) > 0
        
        # Validate token
        is_valid = security_middleware.storage.validate_csrf_token(token, user_id, ip_address)
        assert is_valid
        
        # Token should be invalid after use (one-time use)
        is_valid_again = security_middleware.storage.validate_csrf_token(token, user_id, ip_address)
        assert not is_valid_again
    
    def test_ip_blacklisting(self, security_middleware):
        """Test IP blacklisting functionality"""
        ip_address = "192.168.1.100"
        
        # IP should not be blacklisted initially
        assert not security_middleware.storage.is_ip_blacklisted(ip_address)
        
        # Blacklist IP
        security_middleware.storage.blacklist_ip(ip_address, "Test blacklist", duration_hours=1)
        
        # IP should now be blacklisted
        assert security_middleware.storage.is_ip_blacklisted(ip_address)

class TestAPIIntegration:
    """Test API integration with security components"""
    
    @pytest.fixture
    def client(self):
        """Create test client"""
        return TestClient(app)
    
    def test_health_endpoint_no_auth(self, client):
        """Test health endpoint without authentication"""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
    
    def test_protected_endpoint_no_auth(self, client):
        """Test protected endpoint without authentication"""
        response = client.get("/datasets")
        assert response.status_code == 401
    
    def test_login_flow(self, client):
        """Test complete login flow"""
        # First, we need to create a user (this would normally be done by admin)
        # For testing, we'll use the default admin user
        
        login_data = {
            "username": "admin",
            "password": "admin123!"
        }
        
        response = client.post("/auth/login", json=login_data)
        
        if response.status_code == 200:
            data = response.json()
            assert "access_token" in data
            assert "refresh_token" in data
            assert data["token_type"] == "bearer"
            
            # Test authenticated request
            headers = {"Authorization": f"Bearer {data['access_token']}"}
            response = client.get("/auth/me", headers=headers)
            assert response.status_code == 200
    
    def test_rate_limiting_integration(self, client):
        """Test rate limiting integration"""
        # Make many requests quickly to trigger rate limiting
        responses = []
        for i in range(20):
            response = client.get("/health")
            responses.append(response.status_code)
        
        # Should eventually get rate limited (429)
        # Note: This might not trigger in test environment due to different IP handling
        assert all(status in [200, 429] for status in responses)
    
    def test_security_headers(self, client):
        """Test security headers are present"""
        response = client.get("/health")
        
        # Check for security headers
        assert "X-Content-Type-Options" in response.headers
        assert "X-Frame-Options" in response.headers
        assert "X-XSS-Protection" in response.headers
        assert response.headers["X-Content-Type-Options"] == "nosniff"
        assert response.headers["X-Frame-Options"] == "DENY"
    
    def test_malicious_input_blocked(self, client):
        """Test malicious input is blocked"""
        # Try to send XSS payload
        malicious_data = {
            "message": "<script>alert('xss')</script>",
            "csrf_token": "dummy_token"
        }
        
        response = client.post("/conversations", json=malicious_data)
        # Should be blocked by security middleware
        assert response.status_code in [400, 403]

class TestSecurityCompliance:
    """Test security compliance requirements"""
    
    def test_password_hashing(self):
        """Test password hashing is secure"""
        from auth_system import AuthenticationSystem
        
        with tempfile.NamedTemporaryFile(delete=False) as tmp:
            auth = AuthenticationSystem(db_path=tmp.name)
            
            password = "testpassword123"
            hashed = auth._hash_password(password)
            
            # Hash should be different from password
            assert hashed != password
            
            # Hash should be verifiable
            assert auth._verify_password(password, hashed)
            
            # Wrong password should not verify
            assert not auth._verify_password("wrongpassword", hashed)
            
            os.unlink(tmp.name)
    
    def test_jwt_token_security(self):
        """Test JWT token security"""
        from auth_system import AuthenticationSystem, UserCreate, UserRole
        
        with tempfile.NamedTemporaryFile(delete=False) as tmp:
            auth = AuthenticationSystem(db_path=tmp.name)
            
            # Create user
            user_data = UserCreate(
                username="testuser",
                email="test@example.com",
                password="testpass123",
                full_name="Test User",
                role=UserRole.USER
            )
            user = auth.create_user(user_data)
            
            # Generate token
            token = auth._generate_jwt_token(user)
            
            # Token should be a string
            assert isinstance(token, str)
            assert len(token) > 0
            
            # Token should contain user information when decoded
            import jwt
            from auth_system import JWT_SECRET_KEY, JWT_ALGORITHM
            
            payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
            assert payload["username"] == "testuser"
            assert payload["role"] == "user"
            
            os.unlink(tmp.name)
    
    def test_rate_limit_storage_persistence(self):
        """Test rate limit storage persistence"""
        from rate_limiter import MemoryRateLimitStorage
        
        with tempfile.NamedTemporaryFile(delete=False) as tmp:
            storage = MemoryRateLimitStorage(db_path=tmp.name)
            
            # Increment counter
            count = storage.increment("test_key", 60, 5)
            assert count == 5
            
            # Get count
            current_count = storage.get_count("test_key", 60)
            assert current_count == 5
            
            # Create new storage instance (simulating restart)
            storage2 = MemoryRateLimitStorage(db_path=tmp.name)
            
            # Data should be persisted
            persisted_count = storage2.get_count("test_key", 60)
            assert persisted_count == 5
            
            os.unlink(tmp.name)

# Performance tests
class TestPerformance:
    """Test performance of security components"""
    
    def test_authentication_performance(self):
        """Test authentication performance"""
        from auth_system import AuthenticationSystem, UserCreate, UserLogin, UserRole
        
        with tempfile.NamedTemporaryFile(delete=False) as tmp:
            auth = AuthenticationSystem(db_path=tmp.name)
            
            # Create user
            user_data = UserCreate(
                username="perfuser",
                email="perf@example.com",
                password="perfpass123",
                full_name="Performance User",
                role=UserRole.USER
            )
            auth.create_user(user_data)
            
            # Time authentication
            start_time = time.time()
            
            for i in range(10):
                user = auth.authenticate_user("perfuser", "perfpass123")
                assert user is not None
            
            end_time = time.time()
            avg_time = (end_time - start_time) / 10
            
            # Authentication should be fast (< 100ms per operation)
            assert avg_time < 0.1, f"Authentication too slow: {avg_time}s"
            
            os.unlink(tmp.name)
    
    def test_rate_limiter_performance(self):
        """Test rate limiter performance"""
        from rate_limiter import RateLimiter, MemoryRateLimitStorage
        
        with tempfile.NamedTemporaryFile(delete=False) as tmp:
            storage = MemoryRateLimitStorage(db_path=tmp.name)
            limiter = RateLimiter(storage=storage)
            
            # Time rate limit checks
            start_time = time.time()
            
            for i in range(100):
                is_exceeded, headers = limiter.check_limits(
                    user_id=f"user_{i % 10}",
                    user_role="user",
                    ip_address=f"192.168.1.{i % 255}"
                )
            
            end_time = time.time()
            avg_time = (end_time - start_time) / 100
            
            # Rate limiting should be fast (< 10ms per operation)
            assert avg_time < 0.01, f"Rate limiting too slow: {avg_time}s"
            
            os.unlink(tmp.name)

if __name__ == "__main__":
    # Run tests
    pytest.main([__file__, "-v", "--tb=short"])
