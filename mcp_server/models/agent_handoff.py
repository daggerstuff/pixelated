"""
Agent Hand-off Report Models for MCP Server

This module defines comprehensive data models for agent hand-off reports,
Phase 6 completion tracking, and sign-off workflows following the Pixelated
platform's security and data standards.
"""

from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field, validator


class HandoffReportStatus(str, Enum):
    """Agent hand-off report status enumeration."""

    DRAFT = "draft"
    SUBMITTED = "submitted"
    UNDER_REVIEW = "under_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    AMENDMENTS_REQUIRED = "amendments_required"


class Phase6ComponentStatus(str, Enum):
    """Phase 6 MCP server component completion status."""

    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    BLOCKED = "blocked"
    FAILED = "failed"
    VERIFIED = "verified"


class ComponentType(str, Enum):
    """MCP server component types for Phase 6 tracking."""

    ERROR_HANDLING = "error_handling"
    API_CONTRACTS = "api_contracts"
    RETRY_MECHANISMS = "retry_mechanisms"
    CIRCUIT_BREAKER = "circuit_breaker"
    VALIDATION_LAYER = "validation_layer"
    MONITORING_HOOKS = "monitoring_hooks"
    SECURITY_ENHANCEMENTS = "security_enhancements"
    INTEGRATION_TESTS = "integration_tests"


class SignOffRole(str, Enum):
    """Sign-off role types for phase gate approval."""

    DEVELOPER = "developer"
    TECH_LEAD = "tech_lead"
    QA_ENGINEER = "qa_engineer"
    SECURITY_REVIEWER = "security_reviewer"
    PRODUCT_OWNER = "product_owner"
    ARCHITECT = "architect"


class HandoffReportMetrics(BaseModel):
    """Metrics and performance data for agent hand-off reports."""

    tasks_completed: int = Field(default=0, ge=0, description="Number of tasks completed")
    tasks_failed: int = Field(default=0, ge=0, description="Number of tasks failed")
    average_task_duration_seconds: float | None = Field(None, ge=0, description="Average task duration")
    total_processing_time_seconds: float | None = Field(None, ge=0, description="Total processing time")
    memory_usage_peak_mb: float | None = Field(None, ge=0, description="Peak memory usage in MB")
    api_calls_made: int = Field(default=0, ge=0, description="Number of API calls made")
    external_service_calls: int = Field(default=0, ge=0, description="Number of external service calls")
    errors_encountered: int = Field(default=0, ge=0, description="Number of errors encountered")
    warnings_generated: int = Field(default=0, ge=0, description="Number of warnings generated")
    retry_attempts: int = Field(default=0, ge=0, description="Number of retry attempts")
    circuit_breaker_activations: int = Field(default=0, ge=0, description="Circuit breaker activations")


class Phase6ComponentProgress(BaseModel):
    """Progress tracking for individual Phase 6 components."""

    component_type: ComponentType = Field(..., description="Type of MCP server component")
    status: Phase6ComponentStatus = Field(default=Phase6ComponentStatus.NOT_STARTED, description="Component completion status")
    progress_percentage: float = Field(default=0.0, ge=0.0, le=100.0, description="Completion percentage")
    started_at: datetime | None = Field(None, description="When component work started")
    completed_at: datetime | None = Field(None, description="When component work completed")
    estimated_completion: datetime | None = Field(None, description="Estimated completion time")
    assigned_to: str | None = Field(None, description="Agent ID assigned to this component")
    dependencies: list[str] = Field(default_factory=list, description="Component dependencies")
    blockers: list[str] = Field(default_factory=list, description="Current blockers")
    notes: str | None = Field(None, max_length=2000, description="Progress notes and comments")
    test_results: dict[str, Any] | None = Field(None, description="Test results and validation data")
    code_review_status: str | None = Field(None, description="Code review status")
    security_review_status: str | None = Field(None, description="Security review status")


class SignOffRecord(BaseModel):
    """Individual sign-off record for phase gate approval."""

    sign_off_id: str = Field(..., description="Unique sign-off identifier")
    role: SignOffRole = Field(..., description="Sign-off role")
    signed_by: str = Field(..., description="Agent ID who signed off")
    signed_at: datetime = Field(..., description="Sign-off timestamp")
    status: str = Field(..., description="Sign-off status (approved/rejected/conditional)")
    comments: str | None = Field(None, max_length=1000, description="Sign-off comments")
    conditions: list[str] | None = Field(None, description="Approval conditions if applicable")
    expires_at: datetime | None = Field(None, description="Sign-off expiration time")


class AgentHandoffReport(BaseModel):
    """Comprehensive agent hand-off report model."""

    report_id: str = Field(..., description="Unique report identifier")
    agent_id: str = Field(..., description="Agent ID submitting the report")
    pipeline_id: str = Field(..., description="Associated pipeline ID")
    task_id: str = Field(..., description="Associated task ID")

    # Report metadata
    report_type: str = Field(default="phase6_completion", description="Type of hand-off report")
    status: HandoffReportStatus = Field(default=HandoffReportStatus.DRAFT, description="Report status")
    version: str = Field(default="1.0.0", description="Report format version")

    # Phase 6 component tracking
    phase6_components: list[Phase6ComponentProgress] = Field(default_factory=list, description="Phase 6 component progress")
    overall_phase6_progress: float = Field(default=0.0, ge=0.0, le=100.0, description="Overall Phase 6 completion percentage")

    # Work summary
    work_summary: str = Field(..., min_length=50, max_length=5000, description="Detailed work summary")
    achievements: list[str] = Field(default_factory=list, description="Key achievements")
    challenges_encountered: list[str] = Field(default_factory=list, description="Challenges encountered")
    lessons_learned: list[str] = Field(default_factory=list, description="Lessons learned")

    # Technical details
    components_implemented: list[str] = Field(default_factory=list, description="Components implemented")
    apis_integrated: list[str] = Field(default_factory=list, description="APIs integrated")
    services_configured: list[str] = Field(default_factory=list, description="Services configured")
    tests_written: list[str] = Field(default_factory=list, description="Tests written")
    documentation_created: list[str] = Field(default_factory=list, description="Documentation created")

    # Performance metrics
    metrics: HandoffReportMetrics = Field(default_factory=HandoffReportMetrics, description="Performance metrics")

    # Quality assurance
    quality_score: float | None = Field(None, ge=0.0, le=1.0, description="Overall quality score")
    test_coverage_percentage: float | None = Field(None, ge=0.0, le=100.0, description="Test coverage percentage")
    security_scan_results: dict[str, Any] | None = Field(None, description="Security scan results")
    performance_benchmarks: dict[str, Any] | None = Field(None, description="Performance benchmark results")

    # Sign-off workflow
    sign_offs_required: list[SignOffRole] = Field(default_factory=list, description="Required sign-off roles")
    sign_offs_received: list[SignOffRecord] = Field(default_factory=list, description="Received sign-offs")
    sign_off_status: str = Field(default="pending", description="Overall sign-off status")

    # Attachments and evidence
    attachments: list[str] = Field(default_factory=list, description="Attachment file paths/URLs")
    code_references: list[str] = Field(default_factory=list, description="Code reference links")
    documentation_links: list[str] = Field(default_factory=list, description="Documentation links")

    # Review and feedback
    review_feedback: str | None = Field(None, max_length=2000, description="Review feedback")
    amendments_required: list[str] = Field(default_factory=list, description="Required amendments")

    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow, description="Report creation timestamp")
    submitted_at: datetime | None = Field(None, description="Report submission timestamp")
    reviewed_at: datetime | None = Field(None, description="Report review timestamp")
    approved_at: datetime | None = Field(None, description="Report approval timestamp")
    updated_at: datetime = Field(default_factory=datetime.utcnow, description="Last update timestamp")

    class Config:
        """Pydantic configuration."""
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None
        }

    @validator("work_summary")
    def validate_work_summary(cls, v):
        """Validate work summary minimum length."""
        if len(v.strip()) < 50:
            raise ValueError("Work summary must be at least 50 characters")
        return v.strip()

    def is_complete(self) -> bool:
        """Check if report is complete and ready for submission."""
        return (
            self.work_summary and
            len(self.phase6_components) > 0 and
            self.overall_phase6_progress >= 100.0
        )

    def is_approved(self) -> bool:
        """Check if report has been fully approved."""
        required_roles = set(self.sign_offs_required)
        approved_roles = {
            sign_off.role for sign_off in self.sign_offs_received
            if sign_off.status == "approved"
        }
        return required_roles.issubset(approved_roles)

    def get_component_progress(self, component_type: ComponentType) -> Phase6ComponentProgress | None:
        """Get progress for a specific component type."""
        for component in self.phase6_components:
            if component.component_type == component_type:
                return component
        return None

    def update_component_progress(self, component_type: ComponentType, progress: Phase6ComponentProgress) -> None:
        """Update progress for a specific component type."""
        for i, component in enumerate(self.phase6_components):
            if component.component_type == component_type:
                self.phase6_components[i] = progress
                break
        else:
            self.phase6_components.append(progress)

        # Recalculate overall progress
        self._recalculate_overall_progress()

    def _recalculate_overall_progress(self) -> None:
        """Recalculate overall Phase 6 progress."""
        if not self.phase6_components:
            self.overall_phase6_progress = 0.0
            return

        total_progress = sum(component.progress_percentage for component in self.phase6_components)
        self.overall_phase6_progress = total_progress / len(self.phase6_components)

    def add_sign_off(self, sign_off: SignOffRecord) -> None:
        """Add a sign-off record."""
        self.sign_offs_received.append(sign_off)
        self._update_sign_off_status()

    def _update_sign_off_status(self) -> None:
        """Update overall sign-off status."""
        if not self.sign_offs_required:
            self.sign_off_status = "not_required"
            return

        required_roles = set(self.sign_offs_required)
        approved_roles = set()
        rejected_roles = set()

        for sign_off in self.sign_offs_received:
            if sign_off.status == "approved":
                approved_roles.add(sign_off.role)
            elif sign_off.status == "rejected":
                rejected_roles.add(sign_off.role)

        if rejected_roles:
            self.sign_off_status = "rejected"
        elif required_roles.issubset(approved_roles):
            self.sign_off_status = "approved"
        elif approved_roles:
            self.sign_off_status = "partially_approved"
        else:
            self.sign_off_status = "pending"


class AgentHandoffSubmissionRequest(BaseModel):
    """Request model for submitting agent hand-off reports."""

    report_id: str = Field(..., description="Report ID to submit")
    agent_id: str = Field(..., description="Agent ID submitting the report")
    submission_notes: str | None = Field(None, max_length=1000, description="Submission notes")
    attachments: list[str] | None = Field(None, description="Additional attachment paths")


class AgentHandoffReviewRequest(BaseModel):
    """Request model for reviewing agent hand-off reports."""

    report_id: str = Field(..., description="Report ID to review")
    reviewer_id: str = Field(..., description="Reviewer agent ID")
    review_status: str = Field(..., description="Review status (approved/rejected/amendments_required)")
    review_comments: str = Field(..., min_length=10, max_length=2000, description="Detailed review comments")
    amendments_required: list[str] | None = Field(None, description="Specific amendments required")
    quality_score: float | None = Field(None, ge=0.0, le=1.0, description="Quality score assigned by reviewer")


class AgentHandoffSignOffRequest(BaseModel):
    """Request model for signing off on agent hand-off reports."""

    report_id: str = Field(..., description="Report ID to sign off")
    sign_off_role: SignOffRole = Field(..., description="Sign-off role")
    agent_id: str = Field(..., description="Agent ID signing off")
    status: str = Field(..., description="Sign-off status (approved/rejected/conditional)")
    comments: str | None = Field(None, max_length=1000, description="Sign-off comments")
    conditions: list[str] | None = Field(None, description="Approval conditions if applicable")
    expires_in_days: int | None = Field(None, ge=1, le=365, description="Sign-off expiration in days")


class AgentHandoffFilter(BaseModel):
    """Filter model for querying agent hand-off reports."""

    agent_id: str | None = Field(None, description="Filter by agent ID")
    pipeline_id: str | None = Field(None, description="Filter by pipeline ID")
    task_id: str | None = Field(None, description="Filter by task ID")
    status: HandoffReportStatus | None = Field(None, description="Filter by report status")
    report_type: str | None = Field(None, description="Filter by report type")
    created_after: datetime | None = Field(None, description="Filter reports created after this time")
    created_before: datetime | None = Field(None, description="Filter reports created before this time")
    min_quality_score: float | None = Field(None, ge=0.0, le=1.0, description="Minimum quality score")
    sign_off_status: str | None = Field(None, description="Filter by sign-off status")
    requires_review: bool | None = Field(None, description="Filter by review requirement")


class AgentHandoffStats(BaseModel):
    """Statistics for agent hand-off reports."""

    total_reports: int = Field(default=0, ge=0, description="Total number of reports")
    draft_reports: int = Field(default=0, ge=0, description="Number of draft reports")
    submitted_reports: int = Field(default=0, ge=0, description="Number of submitted reports")
    approved_reports: int = Field(default=0, ge=0, description="Number of approved reports")
    rejected_reports: int = Field(default=0, ge=0, description="Number of rejected reports")

    # Phase 6 specific stats
    phase6_completed_reports: int = Field(default=0, ge=0, description="Phase 6 completion reports")
    phase6_in_progress_reports: int = Field(default=0, ge=0, description="Phase 6 in-progress reports")
    average_phase6_progress: float | None = Field(None, ge=0.0, le=100.0, description="Average Phase 6 progress")

    # Quality metrics
    average_quality_score: float | None = Field(None, ge=0.0, le=1.0, description="Average quality score")
    average_test_coverage: float | None = Field(None, ge=0.0, le=100.0, description="Average test coverage")

    # Timing statistics
    average_review_time_days: float | None = Field(None, ge=0.0, description="Average review time in days")
    average_approval_time_days: float | None = Field(None, ge=0.0, description="Average approval time in days")


class AgentHandoffDashboardData(BaseModel):
    """Dashboard data for agent hand-off reports."""

    statistics: AgentHandoffStats = Field(..., description="Hand-off report statistics")
    recent_reports: list[AgentHandoffReport] = Field(default_factory=list, description="Recent reports")
    pending_reviews: list[AgentHandoffReport] = Field(default_factory=list, description="Reports pending review")
    phase6_progress_summary: dict[str, Any] = Field(default_factory=dict, description="Phase 6 progress summary")
    component_completion_rates: dict[str, float] = Field(default_factory=dict, description="Component completion rates")
    sign_off_status_summary: dict[str, Any] = Field(default_factory=dict, description="Sign-off status summary")


# Helper functions
def create_handoff_report_id() -> str:
    """Create a unique hand-off report ID."""
    from uuid import uuid4
    return f"handoff_{uuid4().hex}"


def create_sign_off_id() -> str:
    """Create a unique sign-off ID."""
    from uuid import uuid4
    return f"signoff_{uuid4().hex}"


def get_default_phase6_components() -> list[Phase6ComponentProgress]:
    """Get default Phase 6 component tracking entries."""
    return [
        Phase6ComponentProgress(
            component_type=ComponentType.ERROR_HANDLING,
            status=Phase6ComponentStatus.NOT_STARTED,
            progress_percentage=0.0
        ),
        Phase6ComponentProgress(
            component_type=ComponentType.API_CONTRACTS,
            status=Phase6ComponentStatus.NOT_STARTED,
            progress_percentage=0.0
        ),
        Phase6ComponentProgress(
            component_type=ComponentType.RETRY_MECHANISMS,
            status=Phase6ComponentStatus.NOT_STARTED,
            progress_percentage=0.0
        ),
        Phase6ComponentProgress(
            component_type=ComponentType.CIRCUIT_BREAKER,
            status=Phase6ComponentStatus.NOT_STARTED,
            progress_percentage=0.0
        ),
        Phase6ComponentProgress(
            component_type=ComponentType.VALIDATION_LAYER,
            status=Phase6ComponentStatus.NOT_STARTED,
            progress_percentage=0.0
        ),
        Phase6ComponentProgress(
            component_type=ComponentType.MONITORING_HOOKS,
            status=Phase6ComponentStatus.NOT_STARTED,
            progress_percentage=0.0
        ),
        Phase6ComponentProgress(
            component_type=ComponentType.SECURITY_ENHANCEMENTS,
            status=Phase6ComponentStatus.NOT_STARTED,
            progress_percentage=0.0
        ),
        Phase6ComponentProgress(
            component_type=ComponentType.INTEGRATION_TESTS,
            status=Phase6ComponentStatus.NOT_STARTED,
            progress_percentage=0.0
        )
    ]


def validate_phase6_completion(components: list[Phase6ComponentProgress]) -> bool:
    """Validate that all Phase 6 components are completed."""
    if not components:
        return False

    for component in components:
        if component.status != Phase6ComponentStatus.COMPLETED:
            return False
        if component.progress_percentage < 100.0:
            return False

    return True


# Export all models
__all__ = [
    "AgentHandoffDashboardData",
    "AgentHandoffFilter",
    "AgentHandoffReport",
    "AgentHandoffReviewRequest",
    "AgentHandoffSignOffRequest",
    "AgentHandoffStats",
    "AgentHandoffSubmissionRequest",
    "ComponentType",
    "HandoffReportMetrics",
    "HandoffReportStatus",
    "Phase6ComponentProgress",
    "Phase6ComponentStatus",
    "SignOffRecord",
    "SignOffRole",
    "create_handoff_report_id",
    "create_sign_off_id",
    "get_default_phase6_components",
    "validate_phase6_completion"
]
