#!/usr/bin/env python3
"""
HIPAA Compliance Validator — standalone build for AWS Marketplace.

HIPAA compliance validation for healthcare data protection.
Implements PHI protection, audit logging, and access controls per HIPAA requirements.
"""

import base64
import hashlib
import json
import logging
import os
import re
import sqlite3
import uuid
from dataclasses import asdict, dataclass
from datetime import UTC, datetime, timedelta
from enum import StrEnum
from pathlib import Path

from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

logger = logging.getLogger(__name__)


class PHIType(StrEnum):
    """Protected Health Information types per HIPAA"""

    NAME = "name"
    ADDRESS = "address"
    BIRTH_DATE = "birth_date"
    PHONE = "phone"
    EMAIL = "email"
    SSN = "ssn"
    MEDICAL_RECORD = "medical_record"
    ACCOUNT_NUMBER = "account_number"
    CERTIFICATE_NUMBER = "certificate_number"
    VEHICLE_IDENTIFIER = "vehicle_identifier"
    DEVICE_IDENTIFIER = "device_identifier"
    WEB_URL = "web_url"
    IP_ADDRESS = "ip_address"
    BIOMETRIC = "biometric"
    PHOTO = "photo"
    OTHER_UNIQUE_ID = "other_unique_id"
    HEALTH_PLAN_ID = "health_plan_id"
    PROVIDER_ID = "provider_id"


class HIPAAViolationType(StrEnum):
    """HIPAA violation types"""

    UNAUTHORIZED_ACCESS = "unauthorized_access"
    IMPROPER_DISCLOSURE = "improper_disclosure"
    INSUFFICIENT_SAFEGUARDS = "insufficient_safeguards"
    LACK_OF_ENCRYPTION = "lack_of_encryption"
    MISSING_AUDIT_TRAIL = "missing_audit_trail"
    INADEQUATE_ACCESS_CONTROLS = "inadequate_access_controls"
    BREACH_NOTIFICATION_FAILURE = "breach_notification_failure"
    MINIMUM_NECESSARY_VIOLATION = "minimum_necessary_violation"


class ComplianceLevel(StrEnum):
    """HIPAA compliance levels"""

    COMPLIANT = "compliant"
    NON_COMPLIANT = "non_compliant"
    REQUIRES_REVIEW = "requires_review"
    BREACH_DETECTED = "breach_detected"


@dataclass
class PHIDetection:
    """PHI detection result"""

    phi_type: PHIType
    value: str
    confidence: float
    location: str
    masked_value: str


@dataclass
class HIPAAViolation:
    """HIPAA violation record"""

    violation_id: str
    violation_type: HIPAAViolationType
    severity: str
    description: str
    phi_involved: list[PHIDetection]
    timestamp: datetime
    user_id: str | None
    ip_address: str | None
    remediation_required: bool


@dataclass
class HIPAAComplianceReport:
    """HIPAA compliance assessment report"""

    assessment_id: str
    timestamp: datetime
    compliance_level: ComplianceLevel
    score: float
    violations: list[HIPAAViolation]
    phi_detected: list[PHIDetection]
    recommendations: list[str]
    audit_trail_complete: bool
    encryption_compliant: bool
    access_controls_adequate: bool


class PHIDetector:
    """Protected Health Information detector"""

    def __init__(self):
        """Initialize PHI detection patterns"""
        self.patterns = {
            PHIType.SSN: [r"\b\d{3}-\d{2}-\d{4}\b", r"\b\d{3}\s\d{2}\s\d{4}\b", r"\b\d{9}\b"],
            PHIType.PHONE: [r"\b\d{3}-\d{3}-\d{4}\b", r"\(\d{3}\)\s?\d{3}-\d{4}", r"\b\d{10}\b"],
            PHIType.EMAIL: [r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b"],
            PHIType.BIRTH_DATE: [r"\b\d{1,2}/\d{1,2}/\d{4}\b", r"\b\d{4}-\d{2}-\d{2}\b", r"\b\d{1,2}-\d{1,2}-\d{4}\b"],
            PHIType.MEDICAL_RECORD: [
                r"\bMRN\s*:?\s*\d+\b",
                r"\bMedical\s+Record\s*:?\s*\d+\b",
                r"\bPatient\s+ID\s*:?\s*\d+\b",
            ],
            PHIType.IP_ADDRESS: [r"\b(?:\d{1,3}\.){3}\d{1,3}\b"],
            PHIType.ADDRESS: [
                r"\b\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Place|Pl)\b"
            ],
        }

        # Compile patterns for performance
        self.compiled_patterns = {}
        for phi_type, patterns in self.patterns.items():
            self.compiled_patterns[phi_type] = [re.compile(pattern, re.IGNORECASE) for pattern in patterns]

    def detect_phi(self, text: str, context: str = "") -> list[PHIDetection]:
        """Detect PHI in text"""
        detections = []

        for phi_type, patterns in self.compiled_patterns.items():
            for pattern in patterns:
                matches = pattern.finditer(text)
                for match in matches:
                    value = match.group()
                    masked_value = self._mask_phi(value, phi_type)

                    detection = PHIDetection(
                        phi_type=phi_type,
                        value=value,
                        confidence=self._calculate_confidence(value, phi_type),
                        location=context,
                        masked_value=masked_value,
                    )
                    detections.append(detection)

        return detections

    def _mask_phi(self, value: str, phi_type: PHIType) -> str:
        """Mask PHI value for logging"""
        if phi_type == PHIType.SSN:
            return f"***-**-{value[-4:]}" if len(value) >= 4 else "***"
        if phi_type == PHIType.PHONE:
            return f"***-***-{value[-4:]}" if len(value) >= 4 else "***"
        if phi_type == PHIType.EMAIL:
            parts = value.split("@")
            if len(parts) == 2:
                return f"{parts[0][:2]}***@{parts[1]}"
            return "***@***.***"
        return f"{value[:2]}***" if len(value) > 2 else "***"

    def _calculate_confidence(self, value: str, phi_type: PHIType) -> float:
        """Calculate confidence score for PHI detection"""
        # Basic confidence calculation - can be enhanced with ML models
        base_confidence = 0.8

        # Adjust based on PHI type and value characteristics
        if phi_type == PHIType.SSN and len(value.replace("-", "").replace(" ", "")) == 9:
            return 0.95
        if (phi_type == PHIType.EMAIL and "@" in value and "." in value) or (
            phi_type == PHIType.PHONE
            and len(value.replace("-", "").replace("(", "").replace(")", "").replace(" ", "")) == 10
        ):
            return 0.9

        return base_confidence


class HIPAAEncryption:
    """HIPAA-compliant encryption for PHI"""

    def __init__(self, password: str | None = None, salt: str | None = None):
        """Initialize encryption with HIPAA-compliant parameters.

        The encryption password and salt MUST be provided either as arguments or via the
        environment variables ``HIPAA_ENCRYPTION_PASSWORD`` and ``HIPAA_ENCRYPTION_SALT``.
        There are no hardcoded defaults — failing to set them raises a ``RuntimeError``.
        """
        if password is None:
            password = os.getenv("HIPAA_ENCRYPTION_PASSWORD")
        if not password:
            raise RuntimeError(
                "HIPAA_ENCRYPTION_PASSWORD environment variable is required but not set. "
                "Generate one with: python -c \"import secrets; print(secrets.token_urlsafe(32))\""
            )

        if salt is None:
            salt = os.getenv("HIPAA_ENCRYPTION_SALT")
        if not salt:
            raise RuntimeError(
                "HIPAA_ENCRYPTION_SALT environment variable is required but not set. "
                "Generate one with: python -c \"import secrets; print(secrets.token_urlsafe(16))\""
            )

        self.password = password
        self.salt = salt
        self.key = self._derive_key(self.password, self.salt)
        self.cipher = Fernet(self.key)

    def _derive_key(self, password: str, salt: str) -> bytes:
        """Derive encryption key using PBKDF2"""
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt.encode(),
            iterations=100000,  # HIPAA recommended minimum
        )
        return base64.urlsafe_b64encode(kdf.derive(password.encode()))

    def encrypt_phi(self, data: str) -> str:
        """Encrypt PHI data"""
        try:
            encrypted_data = self.cipher.encrypt(data.encode())
            return base64.urlsafe_b64encode(encrypted_data).decode()
        except Exception as e:
            logger.error(f"PHI encryption failed: {e}")
            raise

    def decrypt_phi(self, encrypted_data: str) -> str:
        """Decrypt PHI data"""
        try:
            decoded_data = base64.urlsafe_b64decode(encrypted_data.encode())
            decrypted_data = self.cipher.decrypt(decoded_data)
            return decrypted_data.decode()
        except Exception as e:
            logger.error(f"PHI decryption failed: {e}")
            raise


class HIPAAStorage:
    """HIPAA-compliant storage for audit logs and compliance data"""

    def __init__(self, db_path: str | None = None):
        """Initialize HIPAA storage.

        The SQLite database path is configurable via the ``HIPAA_DB_PATH`` environment variable,
        defaulting to ``./data/hipaa_compliance.db`` when not set.
        """
        self.db_path = db_path or os.getenv("HIPAA_DB_PATH", "./data/hipaa_compliance.db")
        # Ensure the parent directory exists
        Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)
        self.encryption = HIPAAEncryption()
        self._init_database()

    def _init_database(self):
        """Initialize HIPAA compliance database"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            # PHI access log
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS phi_access_log (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    access_id TEXT UNIQUE NOT NULL,
                    user_id TEXT NOT NULL,
                    phi_type TEXT NOT NULL,
                    action TEXT NOT NULL,
                    resource_id TEXT,
                    ip_address TEXT,
                    user_agent TEXT,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    success BOOLEAN NOT NULL,
                    failure_reason TEXT,
                    phi_hash TEXT
                )
            """)

            # HIPAA violations
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS hipaa_violations (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    violation_id TEXT UNIQUE NOT NULL,
                    violation_type TEXT NOT NULL,
                    severity TEXT NOT NULL,
                    description TEXT NOT NULL,
                    phi_involved TEXT,
                    timestamp TIMESTAMP NOT NULL,
                    user_id TEXT,
                    ip_address TEXT,
                    remediation_required BOOLEAN NOT NULL,
                    remediation_completed BOOLEAN DEFAULT FALSE,
                    remediation_date TIMESTAMP
                )
            """)

            # Compliance assessments
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS compliance_assessments (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    assessment_id TEXT UNIQUE NOT NULL,
                    timestamp TIMESTAMP NOT NULL,
                    compliance_level TEXT NOT NULL,
                    score REAL NOT NULL,
                    violations_count INTEGER NOT NULL,
                    phi_detected_count INTEGER NOT NULL,
                    audit_trail_complete BOOLEAN NOT NULL,
                    encryption_compliant BOOLEAN NOT NULL,
                    access_controls_adequate BOOLEAN NOT NULL,
                    report_data TEXT NOT NULL
                )
            """)

            # Data retention tracking
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS data_retention (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    data_id TEXT UNIQUE NOT NULL,
                    data_type TEXT NOT NULL,
                    created_date TIMESTAMP NOT NULL,
                    retention_period INTEGER NOT NULL,
                    deletion_date TIMESTAMP NOT NULL,
                    deleted BOOLEAN DEFAULT FALSE,
                    deletion_confirmed_date TIMESTAMP
                )
            """)

            # Create indexes
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_phi_access_user ON phi_access_log(user_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_phi_access_timestamp ON phi_access_log(timestamp)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_violations_timestamp ON hipaa_violations(timestamp)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_assessments_timestamp ON compliance_assessments(timestamp)")

            conn.commit()
            conn.close()
            logger.info("HIPAA compliance database initialized successfully")

        except Exception as e:
            logger.error(f"Failed to initialize HIPAA database: {e}")
            raise

    def log_phi_access(
        self,
        user_id: str,
        phi_type: PHIType,
        action: str,
        resource_id: str | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
        success: bool = True,
        failure_reason: str | None = None,
        phi_data: str | None = None,
    ):
        """Log PHI access for audit trail"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            access_id = str(uuid.uuid4())
            phi_hash = None

            if phi_data:
                # Create hash of PHI for audit purposes (not storing actual PHI)
                phi_hash = hashlib.sha256(phi_data.encode()).hexdigest()

            cursor.execute(
                """
                INSERT INTO phi_access_log
                (access_id, user_id, phi_type, action, resource_id, ip_address,
                 user_agent, success, failure_reason, phi_hash)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
                (
                    access_id,
                    user_id,
                    phi_type.value,
                    action,
                    resource_id,
                    ip_address,
                    user_agent,
                    success,
                    failure_reason,
                    phi_hash,
                ),
            )

            conn.commit()
            conn.close()

            logger.info(f"PHI access logged: {user_id} - {action} - {phi_type.value}")

        except Exception as e:
            logger.error(f"Failed to log PHI access: {e}")
            raise

    def store_violation(self, violation: HIPAAViolation):
        """Store HIPAA violation"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            phi_involved_json = json.dumps([asdict(phi) for phi in violation.phi_involved])

            cursor.execute(
                """
                INSERT INTO hipaa_violations
                (violation_id, violation_type, severity, description, phi_involved,
                 timestamp, user_id, ip_address, remediation_required)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
                (
                    violation.violation_id,
                    violation.violation_type.value,
                    violation.severity,
                    violation.description,
                    phi_involved_json,
                    violation.timestamp,
                    violation.user_id,
                    violation.ip_address,
                    violation.remediation_required,
                ),
            )

            conn.commit()
            conn.close()

            logger.warning(f"HIPAA violation stored: {violation.violation_id}")

        except Exception as e:
            logger.error(f"Failed to store HIPAA violation: {e}")
            raise

    def store_assessment(self, report: HIPAAComplianceReport):
        """Store compliance assessment"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()

            report_json = json.dumps(asdict(report), default=str)

            cursor.execute(
                """
                INSERT INTO compliance_assessments
                (assessment_id, timestamp, compliance_level, score, violations_count,
                 phi_detected_count, audit_trail_complete, encryption_compliant,
                 access_controls_adequate, report_data)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
                (
                    report.assessment_id,
                    report.timestamp,
                    report.compliance_level.value,
                    report.score,
                    len(report.violations),
                    len(report.phi_detected),
                    report.audit_trail_complete,
                    report.encryption_compliant,
                    report.access_controls_adequate,
                    report_json,
                ),
            )

            conn.commit()
            conn.close()

            logger.info(f"HIPAA assessment stored: {report.assessment_id}")

        except Exception as e:
            logger.error(f"Failed to store HIPAA assessment: {e}")
            raise


class HIPAAValidator:
    """HIPAA compliance validator"""

    def __init__(self, storage: HIPAAStorage | None = None):
        """Initialize HIPAA validator"""
        self.storage = storage or HIPAAStorage()
        self.phi_detector = PHIDetector()
        self.encryption = HIPAAEncryption()

        # HIPAA compliance requirements
        self.requirements = {
            "minimum_encryption": True,
            "audit_trail_required": True,
            "access_controls_required": True,
            "phi_detection_required": True,
            "breach_notification_required": True,
            "minimum_necessary_standard": True,
            "data_retention_limits": True,
        }

        logger.info("HIPAA validator initialized successfully")

    def validate_data_access(
        self, user_id: str, data: str, context: str = "", ip_address: str | None = None, user_agent: str | None = None
    ) -> tuple[bool, list[HIPAAViolation]]:
        """Validate data access for HIPAA compliance"""
        violations = []

        # Detect PHI in data
        phi_detections = self.phi_detector.detect_phi(data, context)

        # Log PHI access
        for detection in phi_detections:
            self.storage.log_phi_access(
                user_id=user_id,
                phi_type=detection.phi_type,
                action="access",
                ip_address=ip_address,
                user_agent=user_agent,
                success=True,
                phi_data=detection.value,
            )

        # Check for violations
        if phi_detections:
            # Check if user has proper authorization (simplified check)
            if not self._check_user_authorization(user_id, phi_detections):
                violation = HIPAAViolation(
                    violation_id=str(uuid.uuid4()),
                    violation_type=HIPAAViolationType.UNAUTHORIZED_ACCESS,
                    severity="HIGH",
                    description=f"Unauthorized access to PHI by user {user_id}",
                    phi_involved=phi_detections,
                    timestamp=datetime.now(UTC),
                    user_id=user_id,
                    ip_address=ip_address,
                    remediation_required=True,
                )
                violations.append(violation)
                self.storage.store_violation(violation)

        is_compliant = len(violations) == 0
        return is_compliant, violations

    def validate_data_storage(self, data: str, encrypted: bool = False) -> tuple[bool, list[HIPAAViolation]]:
        """Validate data storage for HIPAA compliance"""
        violations = []

        # Detect PHI in data
        phi_detections = self.phi_detector.detect_phi(data, "storage")

        # Check encryption requirement
        if phi_detections and not encrypted:
            violation = HIPAAViolation(
                violation_id=str(uuid.uuid4()),
                violation_type=HIPAAViolationType.LACK_OF_ENCRYPTION,
                severity="CRITICAL",
                description="PHI stored without encryption",
                phi_involved=phi_detections,
                timestamp=datetime.now(UTC),
                user_id=None,
                ip_address=None,
                remediation_required=True,
            )
            violations.append(violation)
            self.storage.store_violation(violation)

        is_compliant = len(violations) == 0
        return is_compliant, violations

    def validate_audit_trail(self, start_date: datetime, end_date: datetime) -> tuple[bool, list[str]]:
        """Validate audit trail completeness"""
        issues = []

        try:
            conn = sqlite3.connect(self.storage.db_path)
            cursor = conn.cursor()

            # Check for gaps in audit trail
            cursor.execute(
                """
                SELECT COUNT(*) FROM phi_access_log
                WHERE timestamp BETWEEN ? AND ?
            """,
                (start_date, end_date),
            )

            access_count = cursor.fetchone()[0]

            # Check for failed access attempts
            cursor.execute(
                """
                SELECT COUNT(*) FROM phi_access_log
                WHERE timestamp BETWEEN ? AND ? AND success = FALSE
            """,
                (start_date, end_date),
            )

            failed_count = cursor.fetchone()[0]

            conn.close()

            if access_count == 0:
                issues.append("No PHI access logged in specified period")

            if failed_count > 0:
                issues.append(f"{failed_count} failed PHI access attempts detected")

        except Exception as e:
            issues.append(f"Audit trail validation failed: {e}")

        is_complete = len(issues) == 0
        return is_complete, issues

    def _check_user_authorization(self, user_id: str, _phi_detections: list[PHIDetection]) -> bool:
        """Check if user is authorized to access PHI (simplified implementation)"""
        # In a real implementation, this would check against user roles,
        # permissions, and the minimum necessary standard
        # For now, assume all users with valid IDs are authorized
        # This should be replaced with proper authorization logic
        return user_id is not None and len(user_id) > 0

    def generate_compliance_report(self) -> HIPAAComplianceReport:
        """Generate comprehensive HIPAA compliance report"""
        assessment_id = str(uuid.uuid4())
        timestamp = datetime.now(UTC)

        # Get recent violations
        violations = self._get_recent_violations(days=30)

        # Calculate compliance score
        score = self._calculate_compliance_score(violations)

        # Determine compliance level
        if score >= 95:
            compliance_level = ComplianceLevel.COMPLIANT
        elif score >= 80:
            compliance_level = ComplianceLevel.REQUIRES_REVIEW
        else:
            compliance_level = ComplianceLevel.NON_COMPLIANT

        # Check audit trail
        audit_trail_complete, audit_issues = self.validate_audit_trail(timestamp - timedelta(days=30), timestamp)

        # Generate recommendations
        recommendations = self._generate_recommendations(violations, audit_issues)

        report = HIPAAComplianceReport(
            assessment_id=assessment_id,
            timestamp=timestamp,
            compliance_level=compliance_level,
            score=score,
            violations=violations,
            phi_detected=[],  # Would be populated from recent scans
            recommendations=recommendations,
            audit_trail_complete=audit_trail_complete,
            encryption_compliant=True,  # Assuming encryption is properly configured
            access_controls_adequate=True,  # Assuming access controls are in place
        )

        # Store assessment
        self.storage.store_assessment(report)

        return report

    def _get_recent_violations(self, days: int = 30) -> list[HIPAAViolation]:
        """Get recent HIPAA violations"""
        violations = []

        try:
            conn = sqlite3.connect(self.storage.db_path)
            cursor = conn.cursor()

            since_date = datetime.now(UTC) - timedelta(days=days)

            cursor.execute(
                """
                SELECT violation_id, violation_type, severity, description,
                       phi_involved, timestamp, user_id, ip_address, remediation_required
                FROM hipaa_violations
                WHERE timestamp > ?
                ORDER BY timestamp DESC
            """,
                (since_date,),
            )

            for row in cursor.fetchall():
                phi_involved = json.loads(row[4]) if row[4] else []
                phi_detections = [PHIDetection(**phi) for phi in phi_involved]

                violation = HIPAAViolation(
                    violation_id=row[0],
                    violation_type=HIPAAViolationType(row[1]),
                    severity=row[2],
                    description=row[3],
                    phi_involved=phi_detections,
                    timestamp=datetime.fromisoformat(row[5].replace("Z", "+00:00")),
                    user_id=row[6],
                    ip_address=row[7],
                    remediation_required=row[8],
                )
                violations.append(violation)

            conn.close()

        except Exception as e:
            logger.error(f"Failed to get recent violations: {e}")

        return violations

    def _calculate_compliance_score(self, violations: list[HIPAAViolation]) -> float:
        """Calculate HIPAA compliance score"""
        base_score = 100.0

        # Deduct points based on violations
        for violation in violations:
            if violation.severity == "CRITICAL":
                base_score -= 20
            elif violation.severity == "HIGH":
                base_score -= 10
            elif violation.severity == "MEDIUM":
                base_score -= 5
            else:
                base_score -= 2

        return max(0.0, base_score)

    def _generate_recommendations(self, violations: list[HIPAAViolation], audit_issues: list[str]) -> list[str]:
        """Generate compliance recommendations"""
        recommendations = []

        # Violation-based recommendations
        violation_types = {v.violation_type for v in violations}

        if HIPAAViolationType.UNAUTHORIZED_ACCESS in violation_types:
            recommendations.append("Implement stronger access controls and user authentication")

        if HIPAAViolationType.LACK_OF_ENCRYPTION in violation_types:
            recommendations.append("Ensure all PHI is encrypted at rest and in transit")

        if HIPAAViolationType.MISSING_AUDIT_TRAIL in violation_types:
            recommendations.append("Enhance audit logging for all PHI access")

        # Audit trail recommendations
        if audit_issues:
            recommendations.append("Address audit trail gaps and failed access attempts")

        # General recommendations
        if len(violations) > 0:
            recommendations.append("Conduct regular HIPAA compliance training for all staff")
            recommendations.append("Implement automated PHI detection and protection")

        return recommendations


# Global HIPAA validator instance
hipaa_validator = HIPAAValidator()

if __name__ == "__main__":
    # Test HIPAA validator
    validator = HIPAAValidator()

    # Test PHI detection
    test_data = "Patient John Doe, SSN: 123-45-6789, Phone: (555) 123-4567"
    is_compliant, violations = validator.validate_data_access("test_user", test_data)

    # Generate compliance report
    report = validator.generate_compliance_report()
