#!/usr/bin/env python3
"""
Pixelated Empathy AI - Phase 1 Validation Script
Tasks 1.1, 1.2, 1.3: Validate Critical Security Blockers Implementation

Comprehensive validation script to verify Phase 1 security implementation is enterprise-ready.
"""

import os
import sys
import json
import time
import asyncio
import tempfile
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any, Tuple
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class Phase1Validator:
    """Phase 1 security implementation validator"""
    
    def __init__(self):
        """Initialize validator"""
        self.results = {
            "timestamp": datetime.utcnow().isoformat(),
            "phase": "Phase 1 - Critical Security Blockers",
            "tasks": {
                "1.1": {"name": "API Authentication System", "status": "pending", "score": 0},
                "1.2": {"name": "API Rate Limiting", "status": "pending", "score": 0},
                "1.3": {"name": "API Security Middleware", "status": "pending", "score": 0}
            },
            "overall_score": 0,
            "enterprise_ready": False,
            "critical_issues": [],
            "recommendations": []
        }
    
    def validate_task_1_1_authentication(self) -> Tuple[int, List[str]]:
        """Validate Task 1.1: API Authentication System"""
        logger.info("Validating Task 1.1: API Authentication System")
        
        score = 0
        issues = []
        
        try:
            # Test 1: Import authentication system
            try:
                from auth_system import (
                    AuthenticationSystem, User, UserCreate, UserLogin, 
                    UserRole, Permission, auth_system
                )
                score += 10
                logger.info("✅ Authentication system imports successfully")
            except ImportError as e:
                issues.append(f"Authentication system import failed: {e}")
                return score, issues
            
            # Test 2: Database initialization
            try:
                with tempfile.NamedTemporaryFile(delete=False) as tmp:
                    auth = AuthenticationSystem(db_path=tmp.name)
                    score += 10
                    logger.info("✅ Authentication database initializes successfully")
                    os.unlink(tmp.name)
            except Exception as e:
                issues.append(f"Database initialization failed: {e}")
            
            # Test 3: User creation
            try:
                with tempfile.NamedTemporaryFile(delete=False) as tmp:
                    auth = AuthenticationSystem(db_path=tmp.name)
                    user_data = UserCreate(
                        username="testuser",
                        email="test@example.com",
                        password="testpass123",
                        full_name="Test User",
                        role=UserRole.USER
                    )
                    user = auth.create_user(user_data)
                    assert user.username == "testuser"
                    score += 15
                    logger.info("✅ User creation works correctly")
                    os.unlink(tmp.name)
            except Exception as e:
                issues.append(f"User creation failed: {e}")
            
            # Test 4: Password hashing
            try:
                with tempfile.NamedTemporaryFile(delete=False) as tmp:
                    auth = AuthenticationSystem(db_path=tmp.name)
                    password = "testpass123"
                    hashed = auth._hash_password(password)
                    assert hashed != password
                    assert auth._verify_password(password, hashed)
                    score += 15
                    logger.info("✅ Password hashing is secure")
                    os.unlink(tmp.name)
            except Exception as e:
                issues.append(f"Password hashing failed: {e}")
            
            # Test 5: JWT token generation and verification
            try:
                with tempfile.NamedTemporaryFile(delete=False) as tmp:
                    auth = AuthenticationSystem(db_path=tmp.name)
                    user_data = UserCreate(
                        username="testuser",
                        email="test@example.com",
                        password="testpass123",
                        full_name="Test User",
                        role=UserRole.USER
                    )
                    user = auth.create_user(user_data)
                    token = auth._generate_jwt_token(user)
                    assert len(token) > 0
                    
                    # Verify token
                    from fastapi.security import HTTPAuthorizationCredentials
                    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
                    verified_user = auth.verify_token(credentials)
                    assert verified_user.username == "testuser"
                    score += 20
                    logger.info("✅ JWT token generation and verification works")
                    os.unlink(tmp.name)
            except Exception as e:
                issues.append(f"JWT token handling failed: {e}")
            
            # Test 6: Role-based permissions
            try:
                with tempfile.NamedTemporaryFile(delete=False) as tmp:
                    auth = AuthenticationSystem(db_path=tmp.name)
                    
                    # Create admin user
                    admin_data = UserCreate(
                        username="admin",
                        email="admin@example.com",
                        password="adminpass123",
                        full_name="Admin User",
                        role=UserRole.ADMIN
                    )
                    admin_user = auth.create_user(admin_data)
                    
                    # Create regular user
                    user_data = UserCreate(
                        username="user",
                        email="user@example.com",
                        password="userpass123",
                        full_name="Regular User",
                        role=UserRole.USER
                    )
                    regular_user = auth.create_user(user_data)
                    
                    # Test permissions
                    assert admin_user.has_permission(Permission.ADMIN_USERS)
                    assert not regular_user.has_permission(Permission.ADMIN_USERS)
                    score += 15
                    logger.info("✅ Role-based permissions work correctly")
                    os.unlink(tmp.name)
            except Exception as e:
                issues.append(f"Role-based permissions failed: {e}")
            
            # Test 7: Login and refresh token flow
            try:
                with tempfile.NamedTemporaryFile(delete=False) as tmp:
                    auth = AuthenticationSystem(db_path=tmp.name)
                    user_data = UserCreate(
                        username="testuser",
                        email="test@example.com",
                        password="testpass123",
                        full_name="Test User",
                        role=UserRole.USER
                    )
                    auth.create_user(user_data)
                    
                    # Login
                    login_data = UserLogin(username="testuser", password="testpass123")
                    token_response = auth.login(login_data)
                    assert token_response.access_token is not None
                    assert token_response.refresh_token is not None
                    
                    # Refresh token
                    from auth_system import RefreshTokenRequest
                    refresh_request = RefreshTokenRequest(refresh_token=token_response.refresh_token)
                    new_token_response = auth.refresh_access_token(refresh_request)
                    assert new_token_response.access_token != token_response.access_token
                    score += 15
                    logger.info("✅ Login and refresh token flow works")
                    os.unlink(tmp.name)
            except Exception as e:
                issues.append(f"Login/refresh flow failed: {e}")
            
        except Exception as e:
            issues.append(f"Critical authentication system error: {e}")
        
        return score, issues
    
    def validate_task_1_2_rate_limiting(self) -> Tuple[int, List[str]]:
        """Validate Task 1.2: API Rate Limiting"""
        logger.info("Validating Task 1.2: API Rate Limiting")
        
        score = 0
        issues = []
        
        try:
            # Test 1: Import rate limiting system
            try:
                from rate_limiter import (
                    RateLimiter, RateLimit, RateLimitScope, RateLimitType,
                    MemoryRateLimitStorage, rate_limiter
                )
                score += 10
                logger.info("✅ Rate limiting system imports successfully")
            except ImportError as e:
                issues.append(f"Rate limiting system import failed: {e}")
                return score, issues
            
            # Test 2: Storage initialization
            try:
                with tempfile.NamedTemporaryFile(delete=False) as tmp:
                    storage = MemoryRateLimitStorage(db_path=tmp.name)
                    limiter = RateLimiter(storage=storage)
                    score += 10
                    logger.info("✅ Rate limiting storage initializes successfully")
                    os.unlink(tmp.name)
            except Exception as e:
                issues.append(f"Rate limiting storage initialization failed: {e}")
            
            # Test 3: Basic rate limit checking
            try:
                with tempfile.NamedTemporaryFile(delete=False) as tmp:
                    storage = MemoryRateLimitStorage(db_path=tmp.name)
                    limiter = RateLimiter(storage=storage)
                    
                    # Check limits (should not be exceeded initially)
                    is_exceeded, headers = limiter.check_limits(
                        user_id="test_user",
                        user_role="user",
                        ip_address="127.0.0.1"
                    )
                    assert not is_exceeded
                    assert "X-RateLimit-Limit" in headers
                    score += 15
                    logger.info("✅ Basic rate limit checking works")
                    os.unlink(tmp.name)
            except Exception as e:
                issues.append(f"Basic rate limit checking failed: {e}")
            
            # Test 4: Rate limit enforcement
            try:
                with tempfile.NamedTemporaryFile(delete=False) as tmp:
                    storage = MemoryRateLimitStorage(db_path=tmp.name)
                    limiter = RateLimiter(storage=storage)
                    
                    # Make many requests to exceed limit
                    for i in range(150):  # Exceed per-minute limit
                        limiter.increment_counters(
                            user_id="test_user",
                            user_role="user",
                            ip_address="127.0.0.1"
                        )
                    
                    # Should be rate limited now
                    is_exceeded, headers = limiter.check_limits(
                        user_id="test_user",
                        user_role="user",
                        ip_address="127.0.0.1"
                    )
                    assert is_exceeded
                    assert "Retry-After" in headers
                    score += 20
                    logger.info("✅ Rate limit enforcement works")
                    os.unlink(tmp.name)
            except Exception as e:
                issues.append(f"Rate limit enforcement failed: {e}")
            
            # Test 5: Different role limits
            try:
                with tempfile.NamedTemporaryFile(delete=False) as tmp:
                    storage = MemoryRateLimitStorage(db_path=tmp.name)
                    limiter = RateLimiter(storage=storage)
                    
                    admin_limits = limiter.get_user_limits("admin")
                    user_limits = limiter.get_user_limits("user")
                    
                    # Admin should have higher limits
                    admin_per_minute = next(l for l in admin_limits if l["limit_type"] == "per_minute")
                    user_per_minute = next(l for l in user_limits if l["limit_type"] == "per_minute")
                    
                    assert admin_per_minute["limit"] > user_per_minute["limit"]
                    score += 15
                    logger.info("✅ Role-based rate limits work correctly")
                    os.unlink(tmp.name)
            except Exception as e:
                issues.append(f"Role-based rate limits failed: {e}")
            
            # Test 6: IP-based rate limiting
            try:
                with tempfile.NamedTemporaryFile(delete=False) as tmp:
                    storage = MemoryRateLimitStorage(db_path=tmp.name)
                    limiter = RateLimiter(storage=storage)
                    
                    # Make requests without user authentication
                    for i in range(15):  # Exceed IP limit
                        limiter.increment_counters(ip_address="192.168.1.1")
                    
                    is_exceeded, headers = limiter.check_limits(ip_address="192.168.1.1")
                    assert is_exceeded
                    score += 15
                    logger.info("✅ IP-based rate limiting works")
                    os.unlink(tmp.name)
            except Exception as e:
                issues.append(f"IP-based rate limiting failed: {e}")
            
            # Test 7: Usage statistics
            try:
                with tempfile.NamedTemporaryFile(delete=False) as tmp:
                    storage = MemoryRateLimitStorage(db_path=tmp.name)
                    limiter = RateLimiter(storage=storage)
                    
                    # Make some requests
                    for i in range(5):
                        limiter.increment_counters(
                            user_id="test_user",
                            user_role="user",
                            ip_address="127.0.0.1"
                        )
                    
                    stats = limiter.get_usage_stats(
                        user_id="test_user",
                        user_role="user",
                        ip_address="127.0.0.1"
                    )
                    
                    assert "user" in stats
                    assert "ip" in stats
                    assert stats["user"][0]["used"] == 5
                    score += 15
                    logger.info("✅ Usage statistics work correctly")
                    os.unlink(tmp.name)
            except Exception as e:
                issues.append(f"Usage statistics failed: {e}")
            
        except Exception as e:
            issues.append(f"Critical rate limiting system error: {e}")
        
        return score, issues
    
    def validate_task_1_3_security_middleware(self) -> Tuple[int, List[str]]:
        """Validate Task 1.3: API Security Middleware"""
        logger.info("Validating Task 1.3: API Security Middleware")
        
        score = 0
        issues = []
        
        try:
            # Test 1: Import security middleware
            try:
                from security_middleware import (
                    SecurityMiddleware, ThreatType, SecurityLevel,
                    SecurityStorage, security_middleware
                )
                score += 10
                logger.info("✅ Security middleware imports successfully")
            except ImportError as e:
                issues.append(f"Security middleware import failed: {e}")
                return score, issues
            
            # Test 2: Security storage initialization
            try:
                with tempfile.NamedTemporaryFile(delete=False) as tmp:
                    storage = SecurityStorage(db_path=tmp.name)
                    middleware = SecurityMiddleware(storage=storage)
                    score += 10
                    logger.info("✅ Security storage initializes successfully")
                    os.unlink(tmp.name)
            except Exception as e:
                issues.append(f"Security storage initialization failed: {e}")
            
            # Test 3: XSS detection
            try:
                with tempfile.NamedTemporaryFile(delete=False) as tmp:
                    storage = SecurityStorage(db_path=tmp.name)
                    middleware = SecurityMiddleware(storage=storage)
                    
                    xss_inputs = [
                        "<script>alert('xss')</script>",
                        "javascript:alert('xss')",
                        "<img src=x onerror=alert('xss')>"
                    ]
                    
                    for xss_input in xss_inputs:
                        threats = middleware._detect_xss(xss_input)
                        assert len(threats) > 0
                    
                    score += 15
                    logger.info("✅ XSS detection works correctly")
                    os.unlink(tmp.name)
            except Exception as e:
                issues.append(f"XSS detection failed: {e}")
            
            # Test 4: SQL injection detection
            try:
                with tempfile.NamedTemporaryFile(delete=False) as tmp:
                    storage = SecurityStorage(db_path=tmp.name)
                    middleware = SecurityMiddleware(storage=storage)
                    
                    sql_inputs = [
                        "'; DROP TABLE users; --",
                        "1' OR '1'='1",
                        "UNION SELECT * FROM passwords"
                    ]
                    
                    for sql_input in sql_inputs:
                        threats = middleware._detect_sql_injection(sql_input)
                        assert len(threats) > 0
                    
                    score += 15
                    logger.info("✅ SQL injection detection works correctly")
                    os.unlink(tmp.name)
            except Exception as e:
                issues.append(f"SQL injection detection failed: {e}")
            
            # Test 5: Malicious pattern detection
            try:
                with tempfile.NamedTemporaryFile(delete=False) as tmp:
                    storage = SecurityStorage(db_path=tmp.name)
                    middleware = SecurityMiddleware(storage=storage)
                    
                    malicious_inputs = [
                        "../../../etc/passwd",
                        "eval('malicious code')",
                        "system('rm -rf /')"
                    ]
                    
                    for malicious_input in malicious_inputs:
                        threats = middleware._detect_malicious_patterns(malicious_input)
                        assert len(threats) > 0
                    
                    score += 15
                    logger.info("✅ Malicious pattern detection works correctly")
                    os.unlink(tmp.name)
            except Exception as e:
                issues.append(f"Malicious pattern detection failed: {e}")
            
            # Test 6: Input validation
            try:
                with tempfile.NamedTemporaryFile(delete=False) as tmp:
                    storage = SecurityStorage(db_path=tmp.name)
                    middleware = SecurityMiddleware(storage=storage)
                    
                    # Safe input
                    is_safe, threats = middleware._validate_input("Hello, world!")
                    assert is_safe
                    assert len(threats) == 0
                    
                    # Unsafe input
                    is_safe, threats = middleware._validate_input("<script>alert('xss')</script>")
                    assert not is_safe
                    assert len(threats) > 0
                    
                    score += 15
                    logger.info("✅ Input validation works correctly")
                    os.unlink(tmp.name)
            except Exception as e:
                issues.append(f"Input validation failed: {e}")
            
            # Test 7: CSRF token handling
            try:
                with tempfile.NamedTemporaryFile(delete=False) as tmp:
                    storage = SecurityStorage(db_path=tmp.name)
                    middleware = SecurityMiddleware(storage=storage)
                    
                    user_id = "test_user"
                    ip_address = "127.0.0.1"
                    
                    # Generate token
                    token = middleware._generate_csrf_token(user_id, ip_address)
                    assert len(token) > 0
                    
                    # Validate token
                    is_valid = storage.validate_csrf_token(token, user_id, ip_address)
                    assert is_valid
                    
                    # Token should be invalid after use
                    is_valid_again = storage.validate_csrf_token(token, user_id, ip_address)
                    assert not is_valid_again
                    
                    score += 10
                    logger.info("✅ CSRF token handling works correctly")
                    os.unlink(tmp.name)
            except Exception as e:
                issues.append(f"CSRF token handling failed: {e}")
            
            # Test 8: IP blacklisting
            try:
                with tempfile.NamedTemporaryFile(delete=False) as tmp:
                    storage = SecurityStorage(db_path=tmp.name)
                    
                    ip_address = "192.168.1.100"
                    
                    # IP should not be blacklisted initially
                    assert not storage.is_ip_blacklisted(ip_address)
                    
                    # Blacklist IP
                    storage.blacklist_ip(ip_address, "Test blacklist", duration_hours=1)
                    
                    # IP should now be blacklisted
                    assert storage.is_ip_blacklisted(ip_address)
                    
                    score += 10
                    logger.info("✅ IP blacklisting works correctly")
                    os.unlink(tmp.name)
            except Exception as e:
                issues.append(f"IP blacklisting failed: {e}")
            
        except Exception as e:
            issues.append(f"Critical security middleware error: {e}")
        
        return score, issues
    
    def validate_api_integration(self) -> Tuple[int, List[str]]:
        """Validate API integration"""
        logger.info("Validating API integration")
        
        score = 0
        issues = []
        
        try:
            # Test 1: Import main secure API
            try:
                from main_secure import app
                score += 20
                logger.info("✅ Secure API imports successfully")
            except ImportError as e:
                issues.append(f"Secure API import failed: {e}")
                return score, issues
            
            # Test 2: FastAPI app configuration
            try:
                assert app.title == "Pixelated Empathy AI - Secure API"
                assert app.version == "2.0.0"
                score += 20
                logger.info("✅ API configuration is correct")
            except Exception as e:
                issues.append(f"API configuration failed: {e}")
            
            # Test 3: Security middleware integration
            try:
                # Check if security middleware is in the middleware stack
                middleware_found = False
                for middleware in app.user_middleware:
                    if "security_middleware" in str(middleware.cls):
                        middleware_found = True
                        break
                
                if middleware_found:
                    score += 30
                    logger.info("✅ Security middleware is integrated")
                else:
                    issues.append("Security middleware not found in middleware stack")
            except Exception as e:
                issues.append(f"Security middleware integration check failed: {e}")
            
            # Test 4: Rate limiting middleware integration
            try:
                # Check if rate limiting middleware is in the middleware stack
                middleware_found = False
                for middleware in app.user_middleware:
                    if "rate_limit_middleware" in str(middleware.cls):
                        middleware_found = True
                        break
                
                if middleware_found:
                    score += 30
                    logger.info("✅ Rate limiting middleware is integrated")
                else:
                    issues.append("Rate limiting middleware not found in middleware stack")
            except Exception as e:
                issues.append(f"Rate limiting middleware integration check failed: {e}")
            
        except Exception as e:
            issues.append(f"Critical API integration error: {e}")
        
        return score, issues
    
    def run_validation(self) -> Dict[str, Any]:
        """Run complete Phase 1 validation"""
        logger.info("Starting Phase 1 validation...")
        
        # Validate Task 1.1
        score_1_1, issues_1_1 = self.validate_task_1_1_authentication()
        self.results["tasks"]["1.1"]["score"] = score_1_1
        self.results["tasks"]["1.1"]["status"] = "passed" if score_1_1 >= 80 else "failed"
        if issues_1_1:
            self.results["critical_issues"].extend([f"Task 1.1: {issue}" for issue in issues_1_1])
        
        # Validate Task 1.2
        score_1_2, issues_1_2 = self.validate_task_1_2_rate_limiting()
        self.results["tasks"]["1.2"]["score"] = score_1_2
        self.results["tasks"]["1.2"]["status"] = "passed" if score_1_2 >= 80 else "failed"
        if issues_1_2:
            self.results["critical_issues"].extend([f"Task 1.2: {issue}" for issue in issues_1_2])
        
        # Validate Task 1.3
        score_1_3, issues_1_3 = self.validate_task_1_3_security_middleware()
        self.results["tasks"]["1.3"]["score"] = score_1_3
        self.results["tasks"]["1.3"]["status"] = "passed" if score_1_3 >= 80 else "failed"
        if issues_1_3:
            self.results["critical_issues"].extend([f"Task 1.3: {issue}" for issue in issues_1_3])
        
        # Validate API integration
        score_integration, issues_integration = self.validate_api_integration()
        if issues_integration:
            self.results["critical_issues"].extend([f"Integration: {issue}" for issue in issues_integration])
        
        # Calculate overall score
        total_score = score_1_1 + score_1_2 + score_1_3 + score_integration
        max_score = 100 + 100 + 100 + 100  # 400 total
        self.results["overall_score"] = (total_score / max_score) * 100
        
        # Determine enterprise readiness
        self.results["enterprise_ready"] = (
            self.results["overall_score"] >= 95 and
            len(self.results["critical_issues"]) == 0 and
            all(task["status"] == "passed" for task in self.results["tasks"].values())
        )
        
        # Generate recommendations
        if not self.results["enterprise_ready"]:
            if self.results["overall_score"] < 95:
                self.results["recommendations"].append("Overall score below 95% - review failed components")
            
            if len(self.results["critical_issues"]) > 0:
                self.results["recommendations"].append("Resolve all critical issues before production deployment")
            
            for task_id, task in self.results["tasks"].items():
                if task["status"] == "failed":
                    self.results["recommendations"].append(f"Task {task_id} failed - requires immediate attention")
        
        return self.results
    
    def generate_report(self) -> str:
        """Generate validation report"""
        report = []
        report.append("=" * 80)
        report.append("PHASE 1 VALIDATION REPORT")
        report.append("Critical Security Blockers Implementation")
        report.append("=" * 80)
        report.append(f"Timestamp: {self.results['timestamp']}")
        report.append(f"Overall Score: {self.results['overall_score']:.1f}%")
        report.append(f"Enterprise Ready: {'✅ YES' if self.results['enterprise_ready'] else '❌ NO'}")
        report.append("")
        
        # Task results
        report.append("TASK RESULTS:")
        report.append("-" * 40)
        for task_id, task in self.results["tasks"].items():
            status_icon = "✅" if task["status"] == "passed" else "❌"
            report.append(f"Task {task_id}: {task['name']}")
            report.append(f"  Status: {status_icon} {task['status'].upper()}")
            report.append(f"  Score: {task['score']}/100")
            report.append("")
        
        # Critical issues
        if self.results["critical_issues"]:
            report.append("CRITICAL ISSUES:")
            report.append("-" * 40)
            for issue in self.results["critical_issues"]:
                report.append(f"❌ {issue}")
            report.append("")
        
        # Recommendations
        if self.results["recommendations"]:
            report.append("RECOMMENDATIONS:")
            report.append("-" * 40)
            for rec in self.results["recommendations"]:
                report.append(f"💡 {rec}")
            report.append("")
        
        # Summary
        report.append("SUMMARY:")
        report.append("-" * 40)
        if self.results["enterprise_ready"]:
            report.append("✅ Phase 1 implementation is ENTERPRISE READY")
            report.append("✅ All security components are operational")
            report.append("✅ Ready to proceed to Phase 2")
        else:
            report.append("❌ Phase 1 implementation is NOT enterprise ready")
            report.append("❌ Critical issues must be resolved")
            report.append("❌ Do NOT proceed to Phase 2 until issues are fixed")
        
        report.append("=" * 80)
        
        return "\n".join(report)

def main():
    """Main validation function"""
    print("Pixelated Empathy AI - Phase 1 Validation")
    print("=" * 50)
    
    # Add current directory to path for imports
    current_dir = Path(__file__).parent
    sys.path.insert(0, str(current_dir))
    
    # Run validation
    validator = Phase1Validator()
    results = validator.run_validation()
    
    # Generate and display report
    report = validator.generate_report()
    print(report)
    
    # Save results to file
    results_file = current_dir / "phase1_validation_results.json"
    with open(results_file, 'w') as f:
        json.dump(results, f, indent=2)
    
    report_file = current_dir / "phase1_validation_report.txt"
    with open(report_file, 'w') as f:
        f.write(report)
    
    print(f"\nResults saved to: {results_file}")
    print(f"Report saved to: {report_file}")
    
    # Exit with appropriate code
    exit_code = 0 if results["enterprise_ready"] else 1
    sys.exit(exit_code)

if __name__ == "__main__":
    main()
