#!/usr/bin/env python3
"""FastAPI application wrapping the HIPAA Compliance Validator."""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, Field

from app.validator import HIPAAValidator, PHIDetector, HIPAAEncryption

logger = logging.getLogger(__name__)

app = FastAPI(
    title="HIPAA Compliance Validator",
    description=(
        "PHI detection across 18 HIPAA identifier types, Fernet AES-256 encryption, "
        "SQLite audit trail logging, compliance scoring, violation tracking, and reporting."
    ),
    version="1.0.0",
    license_info={"name": "Apache-2.0", "url": "https://www.apache.org/licenses/LICENSE-2.0.html"},
)

# Lazily-initialized singletons (init at startup so env vars are validated then).
_validator: HIPAAValidator | None = None
_detector: PHIDetector | None = None
_encryption: HIPAAEncryption | None = None


def get_validator() -> HIPAAValidator:
    global _validator
    if _validator is None:
        _validator = HIPAAValidator()
    return _validator


def get_detector() -> PHIDetector:
    global _detector
    if _detector is None:
        _detector = PHIDetector()
    return _detector


def get_encryption() -> HIPAAEncryption:
    global _encryption
    if _encryption is None:
        _encryption = HIPAAEncryption()
    return _encryption


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------


class ValidateAccessRequest(BaseModel):
    user_id: str = Field(..., description="ID of the user accessing the data")
    data: str = Field(..., description="Text data being accessed")
    context: str = Field("", description="Context of the access (e.g. endpoint name)")
    ip_address: str | None = Field(None, description="Originating IP address")
    user_agent: str | None = Field(None, description="Originating user agent")


class ValidateStorageRequest(BaseModel):
    data: str = Field(..., description="Text data being stored")
    encrypted: bool = Field(False, description="Whether the data is encrypted")


class DetectPHIRequest(BaseModel):
    data: str = Field(..., description="Text to scan for PHI")
    context: str = Field("", description="Context label for detections")


class EncryptRequest(BaseModel):
    data: str = Field(..., description="Plaintext data to encrypt")


class DecryptRequest(BaseModel):
    encrypted_data: str = Field(..., description="Base64 ciphertext produced by /encrypt")


# ---------------------------------------------------------------------------
# Response models
# ---------------------------------------------------------------------------


class PHIDetectionResponse(BaseModel):
    phi_type: str
    value: str
    confidence: float
    location: str
    masked_value: str


class ViolationResponse(BaseModel):
    violation_id: str
    violation_type: str
    severity: str
    description: str
    phi_involved: list[PHIDetectionResponse]
    timestamp: datetime
    user_id: str | None
    ip_address: str | None
    remediation_required: bool


class ValidateAccessResponse(BaseModel):
    is_compliant: bool
    violations: list[ViolationResponse]
    phi_detected: list[PHIDetectionResponse]


class ValidateStorageResponse(BaseModel):
    is_compliant: bool
    violations: list[ViolationResponse]
    phi_detected: list[PHIDetectionResponse]


class DetectPHIResponse(BaseModel):
    phi_detected: list[PHIDetectionResponse]
    count: int


class AuditTrailResponse(BaseModel):
    is_complete: bool
    issues: list[str]


class EncryptResponse(BaseModel):
    encrypted_data: str


class DecryptResponse(BaseModel):
    decrypted_data: str


class HealthResponse(BaseModel):
    status: str = "ok"
    service: str = "hipaa-compliance-validator"
    version: str = "1.0.0"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _violation_to_response(v: Any) -> ViolationResponse:
    return ViolationResponse(
        violation_id=v.violation_id,
        violation_type=v.violation_type.value if hasattr(v.violation_type, "value") else str(v.violation_type),
        severity=v.severity,
        description=v.description,
        phi_involved=[_detection_to_response(p) for p in v.phi_involved],
        timestamp=v.timestamp,
        user_id=v.user_id,
        ip_address=v.ip_address,
        remediation_required=v.remediation_required,
    )


def _detection_to_response(d: Any) -> PHIDetectionResponse:
    return PHIDetectionResponse(
        phi_type=d.phi_type.value if hasattr(d.phi_type, "value") else str(d.phi_type),
        value=d.value,
        confidence=d.confidence,
        location=d.location,
        masked_value=d.masked_value,
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@app.post("/validate/access", response_model=ValidateAccessResponse, tags=["validation"])
def validate_access(req: ValidateAccessRequest) -> ValidateAccessResponse:
    """Validate a data access event for HIPAA compliance."""
    validator = get_validator()
    is_compliant, violations = validator.validate_data_access(
        user_id=req.user_id,
        data=req.data,
        context=req.context,
        ip_address=req.ip_address,
        user_agent=req.user_agent,
    )
    phi_detected = validator.phi_detector.detect_phi(req.data, req.context)
    return ValidateAccessResponse(
        is_compliant=is_compliant,
        violations=[_violation_to_response(v) for v in violations],
        phi_detected=[_detection_to_response(p) for p in phi_detected],
    )


@app.post("/validate/storage", response_model=ValidateStorageResponse, tags=["validation"])
def validate_storage(req: ValidateStorageRequest) -> ValidateStorageResponse:
    """Validate data storage for HIPAA compliance (encryption required for PHI)."""
    validator = get_validator()
    is_compliant, violations = validator.validate_data_storage(req.data, encrypted=req.encrypted)
    phi_detected = validator.phi_detector.detect_phi(req.data, "storage")
    return ValidateStorageResponse(
        is_compliant=is_compliant,
        violations=[_violation_to_response(v) for v in violations],
        phi_detected=[_detection_to_response(p) for p in phi_detected],
    )


@app.get("/audit-trail", response_model=AuditTrailResponse, tags=["audit"])
def audit_trail(
    start_date: datetime = Query(..., description="ISO-8601 start timestamp"),
    end_date: datetime = Query(..., description="ISO-8601 end timestamp"),
) -> AuditTrailResponse:
    """Validate audit trail completeness over a date range."""
    validator = get_validator()
    is_complete, issues = validator.validate_audit_trail(start_date, end_date)
    return AuditTrailResponse(is_complete=is_complete, issues=issues)


@app.get("/report", response_model=dict, tags=["reporting"])
def report() -> dict:
    """Generate a comprehensive HIPAA compliance report."""
    validator = get_validator()
    report_obj = validator.generate_compliance_report()
    return {
        "assessment_id": report_obj.assessment_id,
        "timestamp": report_obj.timestamp.isoformat(),
        "compliance_level": report_obj.compliance_level.value,
        "score": report_obj.score,
        "violations": [
            {
                "violation_id": v.violation_id,
                "violation_type": v.violation_type.value,
                "severity": v.severity,
                "description": v.description,
                "phi_involved": [
                    {
                        "phi_type": p.phi_type.value,
                        "value": p.value,
                        "confidence": p.confidence,
                        "location": p.location,
                        "masked_value": p.masked_value,
                    }
                    for p in v.phi_involved
                ],
                "timestamp": v.timestamp.isoformat() if hasattr(v.timestamp, "isoformat") else str(v.timestamp),
                "user_id": v.user_id,
                "ip_address": v.ip_address,
                "remediation_required": v.remediation_required,
            }
            for v in report_obj.violations
        ],
        "recommendations": report_obj.recommendations,
        "audit_trail_complete": report_obj.audit_trail_complete,
        "encryption_compliant": report_obj.encryption_compliant,
        "access_controls_adequate": report_obj.access_controls_adequate,
    }


@app.post("/detect-phi", response_model=DetectPHIResponse, tags=["phi"])
def detect_phi(req: DetectPHIRequest) -> DetectPHIResponse:
    """Detect PHI in text across 18 HIPAA identifier types."""
    detector = get_detector()
    detections = detector.detect_phi(req.data, req.context)
    return DetectPHIResponse(
        phi_detected=[_detection_to_response(d) for d in detections],
        count=len(detections),
    )


@app.post("/encrypt", response_model=EncryptResponse, tags=["encryption"])
def encrypt(req: EncryptRequest) -> EncryptResponse:
    """Encrypt data using Fernet AES-256 with PBKDF2-derived key."""
    try:
        encryption = get_encryption()
        encrypted = encryption.encrypt_phi(req.data)
        return EncryptResponse(encrypted_data=encrypted)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.post("/decrypt", response_model=DecryptResponse, tags=["encryption"])
def decrypt(req: DecryptRequest) -> DecryptResponse:
    """Decrypt data previously encrypted by /encrypt."""
    try:
        encryption = get_encryption()
        decrypted = encryption.decrypt_phi(req.encrypted_data)
        return DecryptResponse(decrypted_data=decrypted)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Decryption failed: {e}") from e


@app.get("/health", response_model=HealthResponse, tags=["health"])
def health() -> HealthResponse:
    """Health check endpoint."""
    return HealthResponse()

