"""Agent Hand-off Service for MCP Server

Provides comprehensive agent hand-off report collection, validation, storage,
and Phase 6 completion tracking with integration to existing MCP services.
"""

from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

import structlog
from motor.motor_asyncio import AsyncIOMotorDatabase
from redis.asyncio import Redis

from mcp_server.config import MCPConfig
from mcp_server.exceptions import (
    AuthenticationError,
    IntegrationError,
    ResourceNotFoundError,
    ValidationError,
)
from mcp_server.models.agent_handoff import (
    AgentHandoffDashboardData,
    AgentHandoffReport,
    AgentHandoffReviewRequest,
    AgentHandoffSignOffRequest,
    AgentHandoffStats,
    AgentHandoffSubmissionRequest,
    ComponentType,
    HandoffReportStatus,
    Phase6ComponentProgress,
    SignOffRecord,
    create_handoff_report_id,
    create_sign_off_id,
    get_default_phase6_components,
    validate_phase6_completion,
)

logger = structlog.get_logger(__name__)


@dataclass
class HandoffServiceConfig:
    """Configuration for agent hand-off service."""

    max_report_size_mb: int = 10
    review_timeout_days: int = 7
    sign_off_expiry_days: int = 30
    auto_approval_threshold: float = 0.9
    required_sign_offs: list[str] = None
    enable_notifications: bool = True
    enable_auto_validation: bool = True

    def __post_init__(self):
        if self.required_sign_offs is None:
            self.required_sign_offs = ["developer", "tech_lead", "qa_engineer"]


class AgentHandoffService:
    """
    Service for managing agent hand-off reports and Phase 6 completion tracking.

    Provides comprehensive functionality for:
    - Report creation and management
    - Phase 6 component progress tracking
    - Report submission and validation
    - Review and sign-off workflows
    - Dashboard and monitoring
    """

    def __init__(self, config: MCPConfig, database: AsyncIOMotorDatabase, redis_client: Redis):
        """
        Initialize agent hand-off service.

        Args:
            config: MCP configuration
            database: MongoDB database instance
            redis_client: Redis client instance
        """
        self.config = config
        self.database = database
        self.redis_client = redis_client
        self.logger = structlog.get_logger(__name__)
        self.service_config = HandoffServiceConfig()

        # Collection names
        self.reports_collection = "agent_handoff_reports"
        self.sign_offs_collection = "agent_handoff_sign_offs"
        self.reviews_collection = "agent_handoff_reviews"

        # Redis keys
        self.report_cache_prefix = "handoff:report:"
        self.dashboard_cache_key = "handoff:dashboard"
        self.stats_cache_key = "handoff:stats"

        self._initialized = False

    async def initialize(self) -> None:
        """Initialize service and create indexes."""
        try:
            self.logger.info("Initializing agent hand-off service")

            # Create MongoDB indexes
            await self._create_indexes()

            # Initialize default configurations
            await self._initialize_defaults()

            self._initialized = True
            self.logger.info("Agent hand-off service initialized successfully")

        except Exception as e:
            self.logger.error("Failed to initialize agent hand-off service", error=str(e))
            raise IntegrationError(
                f"Agent hand-off service initialization failed: {e!s}"
            ) from e

    async def _create_indexes(self) -> None:
        """Create MongoDB indexes for optimal performance."""
        try:
            # Reports collection indexes
            reports_coll = self.database[self.reports_collection]
            await reports_coll.create_index("report_id", unique=True)
            await reports_coll.create_index("agent_id")
            await reports_coll.create_index("pipeline_id")
            await reports_coll.create_index("task_id")
            await reports_coll.create_index("status")
            await reports_coll.create_index("created_at")
            await reports_coll.create_index([
                ("agent_id", 1),
                ("status", 1),
                ("created_at", -1)
            ])

            # Sign-offs collection indexes
            sign_offs_coll = self.database[self.sign_offs_collection]
            await sign_offs_coll.create_index("sign_off_id", unique=True)
            await sign_offs_coll.create_index("report_id")
            await sign_offs_coll.create_index("signed_by")
            await sign_offs_coll.create_index("role")
            await sign_offs_coll.create_index("signed_at")

            # Reviews collection indexes
            reviews_coll = self.database[self.reviews_collection]
            await reviews_coll.create_index("report_id")
            await reviews_coll.create_index("reviewer_id")
            await reviews_coll.create_index("review_status")
            await reviews_coll.create_index("reviewed_at")

            self.logger.debug("MongoDB indexes created successfully")

        except Exception as e:
            self.logger.error("Failed to create MongoDB indexes", error=str(e))
            raise

    async def _initialize_defaults(self) -> None:
        """Initialize default configurations and settings."""
        try:
            # No specific defaults needed for now
            self.logger.debug("Default configurations initialized")

        except Exception as e:
            self.logger.error("Failed to initialize defaults", error=str(e))
            raise

    async def create_report(
        self,
        agent_id: str,
        pipeline_id: str,
        task_id: str,
        work_summary: str,
        **kwargs
    ) -> AgentHandoffReport:
        """
        Create a new agent hand-off report.

        Args:
            agent_id: Agent ID creating the report
            pipeline_id: Associated pipeline ID
            task_id: Associated task ID
            work_summary: Detailed work summary
            **kwargs: Additional report fields

        Returns:
            Created agent hand-off report

        Raises:
            ValidationError: If input validation fails
            ResourceNotFoundError: If referenced resources don't exist
        """
        try:
            self.logger.info("Creating agent hand-off report", agent_id=agent_id)

            # Validate agent exists and is active
            await self._validate_agent(agent_id)

            # Validate pipeline and task exist
            await self._validate_pipeline_and_task(pipeline_id, task_id)

            # Create report ID
            report_id = create_handoff_report_id()

            # Initialize default Phase 6 components if not provided
            if "phase6_components" not in kwargs or not kwargs["phase6_components"]:
                kwargs["phase6_components"] = get_default_phase6_components()

            # Set default required sign-offs if not provided
            if "sign_offs_required" not in kwargs or not kwargs["sign_offs_required"]:
                kwargs["sign_offs_required"] = self.service_config.required_sign_offs

            # Create report
            report = AgentHandoffReport(
                report_id=report_id,
                agent_id=agent_id,
                pipeline_id=pipeline_id,
                task_id=task_id,
                work_summary=work_summary,
                **kwargs
            )

            # Store in MongoDB
            reports_coll = self.database[self.reports_collection]
            await reports_coll.insert_one(report.dict())

            # Cache in Redis
            await self._cache_report(report)

            self.logger.info(
                "Agent hand-off report created successfully",
                report_id=report_id,
                agent_id=agent_id
            )

            return report

        except ValidationError:
            raise
        except Exception as e:
            self.logger.error("Failed to create agent hand-off report", error=str(e))
            raise IntegrationError(f"Failed to create hand-off report: {e!s}") from e

    async def get_report(self, report_id: str) -> AgentHandoffReport | None:
        """
        Get agent hand-off report by ID.

        Args:
            report_id: Report ID

        Returns:
            Agent hand-off report or None if not found
        """
        try:
            # Check Redis cache first
            cached_report = await self._get_cached_report(report_id)
            if cached_report:
                return cached_report

            # Query MongoDB
            reports_coll = self.database[self.reports_collection]
            report_data = await reports_coll.find_one({"report_id": report_id})

            if not report_data:
                return None

            # Convert to model
            report = AgentHandoffReport(**report_data)

            # Cache for future use
            await self._cache_report(report)

            return report

        except Exception as e:
            self.logger.error("Failed to get agent hand-off report", report_id=report_id, error=str(e))
            return None

    async def update_report(
        self,
        report_id: str,
        agent_id: str,
        **updates
    ) -> AgentHandoffReport | None:
        """
        Update agent hand-off report.

        Args:
            report_id: Report ID to update
            agent_id: Agent ID making the update
            **updates: Fields to update

        Returns:
            Updated report or None if not found

        Raises:
            ValidationError: If validation fails
            AuthenticationError: If agent doesn't have permission
        """
        try:
            self.logger.info("Updating agent hand-off report", report_id=report_id, agent_id=agent_id)

            # Get existing report
            report = await self.get_report(report_id)
            if not report:
                raise ResourceNotFoundError(f"Report {report_id} not found")

            # Validate agent ownership
            if report.agent_id != agent_id:
                raise AuthenticationError("Agent does not have permission to update this report")

            # Validate status allows updates
            if report.status not in [HandoffReportStatus.DRAFT, HandoffReportStatus.AMENDMENTS_REQUIRED]:
                raise ValidationError(f"Cannot update report in status {report.status}")

            # Update fields
            update_data = updates.copy()
            update_data["updated_at"] = datetime.now(timezone.utc)

            # Update in MongoDB
            reports_coll = self.database[self.reports_collection]
            result = await reports_coll.update_one(
                {"report_id": report_id},
                {"$set": update_data}
            )

            if result.modified_count == 0:
                return None

            # Get updated report
            updated_report = await self.get_report(report_id)

            # Update cache
            if updated_report:
                await self._cache_report(updated_report)

            self.logger.info(
                "Agent hand-off report updated successfully",
                report_id=report_id,
                agent_id=agent_id
            )

            return updated_report

        except (ValidationError, AuthenticationError, ResourceNotFoundError):
            raise
        except Exception as e:
            self.logger.error("Failed to update agent hand-off report", error=str(e))
            raise IntegrationError(f"Failed to update hand-off report: {e!s}") from e

    async def submit_report(
        self,
        submission_request: AgentHandoffSubmissionRequest
    ) -> AgentHandoffReport | None:
        """
        Submit agent hand-off report for review.

        Args:
            submission_request: Report submission request

        Returns:
            Updated report or None if not found

        Raises:
            ValidationError: If report validation fails
            ResourceNotFoundError: If report not found
        """
        try:
            self.logger.info(
                "Submitting agent hand-off report",
                report_id=submission_request.report_id,
                agent_id=submission_request.agent_id
            )

            # Get report
            report = await self.get_report(submission_request.report_id)
            if not report:
                raise ResourceNotFoundError(f"Report {submission_request.report_id} not found")

            # Validate agent ownership
            if report.agent_id != submission_request.agent_id:
                raise AuthenticationError("Agent does not have permission to submit this report")

            # Validate report completeness
            if not report.is_complete():
                raise ValidationError("Report is not complete and cannot be submitted")

            # Validate Phase 6 completion
            if not validate_phase6_completion(report.phase6_components):
                raise ValidationError("Phase 6 components are not fully completed")

            # Update report status
            updates = {
                "status": HandoffReportStatus.SUBMITTED,
                "submitted_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }

            # Add submission notes if provided
            if submission_request.submission_notes:
                # Append to existing work summary or add as separate field
                pass

            # Add attachments if provided
            if submission_request.attachments:
                current_attachments = report.attachments or []
                current_attachments.extend(submission_request.attachments)
                updates["attachments"] = list(set(current_attachments))  # Remove duplicates

            # Update report
            updated_report = await self.update_report(
                submission_request.report_id,
                submission_request.agent_id,
                **updates
            )

            if updated_report:
                # Trigger review workflow
                await self._trigger_review_workflow(updated_report)

                # Send notifications
                if self.service_config.enable_notifications:
                    await self._send_submission_notifications(updated_report)

            self.logger.info(
                "Agent hand-off report submitted successfully",
                report_id=submission_request.report_id,
                agent_id=submission_request.agent_id
            )

            return updated_report

        except (ValidationError, AuthenticationError, ResourceNotFoundError):
            raise
        except Exception as e:
            self.logger.error("Failed to submit agent hand-off report", error=str(e))
            raise IntegrationError(f"Failed to submit hand-off report: {e!s}")

    async def review_report(
        self,
        review_request: AgentHandoffReviewRequest
    ) -> AgentHandoffReport | None:
        """
        Review agent hand-off report.

        Args:
            review_request: Report review request

        Returns:
            Updated report or None if not found

        Raises:
            ValidationError: If review validation fails
            ResourceNotFoundError: If report not found
        """
        try:
            self.logger.info(
                "Reviewing agent hand-off report",
                report_id=review_request.report_id,
                reviewer_id=review_request.reviewer_id
            )

            # Get report
            report = await self.get_report(review_request.report_id)
            if not report:
                raise ResourceNotFoundError(f"Report {review_request.report_id} not found")

            # Validate reviewer permissions
            await self._validate_reviewer_permissions(review_request.reviewer_id, report)

            # Validate review status
            if report.status != HandoffReportStatus.UNDER_REVIEW:
                raise ValidationError(f"Cannot review report in status {report.status}")

            # Update report based on review
            updates = {
                "review_feedback": review_request.review_comments,
                "updated_at": datetime.utcnow(),
                "reviewed_at": datetime.utcnow()
            }

            # Handle different review outcomes
            if review_request.review_status == "approved":
                updates["status"] = HandoffReportStatus.APPROVED
                updates["quality_score"] = review_request.quality_score
            elif review_request.review_status == "rejected":
                updates["status"] = HandoffReportStatus.REJECTED
            elif review_request.review_status == "amendments_required":
                updates["status"] = HandoffReportStatus.AMENDMENTS_REQUIRED
                updates["amendments_required"] = review_request.amendments_required or []

            # Update report
            updated_report = await self.update_report(
                review_request.report_id,
                review_request.reviewer_id,
                **updates
            )

            if updated_report:
                # Store review record
                await self._store_review_record(review_request)

                # Trigger sign-off workflow if approved
                if review_request.review_status == "approved":
                    await self._trigger_sign_off_workflow(updated_report)

                # Send notifications
                if self.service_config.enable_notifications:
                    await self._send_review_notifications(updated_report, review_request)

            self.logger.info(
                "Agent hand-off report reviewed successfully",
                report_id=review_request.report_id,
                reviewer_id=review_request.reviewer_id,
                review_status=review_request.review_status
            )

            return updated_report

        except (ValidationError, AuthenticationError, ResourceNotFoundError):
            raise
        except Exception as e:
            self.logger.error("Failed to review agent hand-off report", error=str(e))
            raise IntegrationError(f"Failed to review hand-off report: {e!s}")

    async def sign_off_report(
        self,
        sign_off_request: AgentHandoffSignOffRequest
    ) -> AgentHandoffReport | None:
        """
        Sign off on agent hand-off report.

        Args:
            sign_off_request: Sign-off request

        Returns:
            Updated report or None if not found

        Raises:
            ValidationError: If sign-off validation fails
            ResourceNotFoundError: If report not found
        """
        try:
            self.logger.info(
                "Signing off on agent hand-off report",
                report_id=sign_off_request.report_id,
                agent_id=sign_off_request.agent_id,
                role=sign_off_request.sign_off_role
            )

            # Get report
            report = await self.get_report(sign_off_request.report_id)
            if not report:
                raise ResourceNotFoundError(f"Report {sign_off_request.report_id} not found")

            # Validate sign-off permissions
            await self._validate_sign_off_permissions(
                sign_off_request.agent_id,
                sign_off_request.sign_off_role,
                report
            )

            # Validate report status
            if report.status != HandoffReportStatus.APPROVED:
                raise ValidationError(f"Cannot sign off on report in status {report.status}")

            # Create sign-off record
            sign_off_record = SignOffRecord(
                sign_off_id=create_sign_off_id(),
                role=sign_off_request.sign_off_role,
                signed_by=sign_off_request.agent_id,
                signed_at=datetime.utcnow(),
                status=sign_off_request.status,
                comments=sign_off_request.comments,
                conditions=sign_off_request.conditions,
                expires_at=datetime.utcnow() + timedelta(days=sign_off_request.expires_in_days)
                           if sign_off_request.expires_in_days else None
            )

            # Add sign-off to report
            report.add_sign_off(sign_off_record)

            # Update report in database
            updates = {
                "sign_offs_received": [so.dict() for so in report.sign_offs_received],
                "sign_off_status": report.sign_off_status,
                "updated_at": datetime.utcnow()
            }

            # If fully approved, mark as fully approved
            if report.is_approved():
                updates["approved_at"] = datetime.utcnow()

            updated_report = await self.update_report(
                sign_off_request.report_id,
                sign_off_request.agent_id,
                **updates
            )

            if updated_report:
                # Store sign-off record
                await self._store_sign_off_record(sign_off_record, sign_off_request.report_id)

                # Send notifications
                if self.service_config.enable_notifications:
                    await self._send_sign_off_notifications(updated_report, sign_off_record)

            self.logger.info(
                "Agent hand-off report signed off successfully",
                report_id=sign_off_request.report_id,
                agent_id=sign_off_request.agent_id,
                role=sign_off_request.sign_off_role,
                status=sign_off_request.status
            )

            return updated_report

        except (ValidationError, AuthenticationError, ResourceNotFoundError):
            raise
        except Exception as e:
            self.logger.error("Failed to sign off on agent hand-off report", error=str(e))
            raise IntegrationError(f"Failed to sign off on hand-off report: {e!s}")

    async def get_dashboard_data(self, force_refresh: bool = False) -> AgentHandoffDashboardData:
        """
        Get dashboard data for agent hand-off reports.

        Args:
            force_refresh: Force refresh of cached data

        Returns:
            Dashboard data
        """
        try:
            # Check cache first
            if not force_refresh:
                cached_data = await self._get_cached_dashboard_data()
                if cached_data:
                    return cached_data

            # Calculate statistics
            stats = await self._calculate_statistics()

            # Get recent reports
            recent_reports = await self._get_recent_reports(limit=10)

            # Get pending reviews
            pending_reviews = await self._get_pending_reviews()

            # Calculate Phase 6 progress summary
            phase6_summary = await self._calculate_phase6_summary()

            # Calculate component completion rates
            completion_rates = await self._calculate_completion_rates()

            # Calculate sign-off status summary
            sign_off_summary = await self._calculate_sign_off_summary()

            # Create dashboard data
            dashboard_data = AgentHandoffDashboardData(
                statistics=stats,
                recent_reports=recent_reports,
                pending_reviews=pending_reviews,
                phase6_progress_summary=phase6_summary,
                component_completion_rates=completion_rates,
                sign_off_status_summary=sign_off_summary
            )

            # Cache dashboard data
            await self._cache_dashboard_data(dashboard_data)

            return dashboard_data

        except Exception as e:
            self.logger.error("Failed to get dashboard data", error=str(e))
            raise IntegrationError(f"Failed to get dashboard data: {e!s}")

    async def update_component_progress(
        self,
        report_id: str,
        agent_id: str,
        component_type: ComponentType,
        progress: Phase6ComponentProgress
    ) -> AgentHandoffReport | None:
        """
        Update Phase 6 component progress in a report.

        Args:
            report_id: Report ID
            agent_id: Agent ID making the update
            component_type: Component type to update
            progress: Updated progress data

        Returns:
            Updated report or None if not found
        """
        try:
            self.logger.info(
                "Updating Phase 6 component progress",
                report_id=report_id,
                agent_id=agent_id,
                component_type=component_type
            )

            # Get report
            report = await self.get_report(report_id)
            if not report:
                return None

            # Validate agent ownership
            if report.agent_id != agent_id:
                raise AuthenticationError("Agent does not have permission to update this report")

            # Validate status allows updates
            if report.status not in [HandoffReportStatus.DRAFT, HandoffReportStatus.AMENDMENTS_REQUIRED]:
                raise ValidationError(f"Cannot update report in status {report.status}")

            # Update component progress
            report.update_component_progress(component_type, progress)

            # Update report in database
            updates = {
                "phase6_components": [comp.dict() for comp in report.phase6_components],
                "overall_phase6_progress": report.overall_phase6_progress,
                "updated_at": datetime.utcnow()
            }

            updated_report = await self.update_report(report_id, agent_id, **updates)

            self.logger.info(
                "Phase 6 component progress updated successfully",
                report_id=report_id,
                component_type=component_type,
                progress_percentage=progress.progress_percentage
            )

            return updated_report

        except (ValidationError, AuthenticationError):
            raise
        except Exception as e:
            self.logger.error("Failed to update component progress", error=str(e))
            raise IntegrationError(f"Failed to update component progress: {e!s}")

    # Helper methods
    async def _validate_agent(self, agent_id: str) -> None:
        """Validate agent exists and is active."""
        # This would integrate with existing agent service
        # For now, basic validation
        if not agent_id or not agent_id.strip():
            raise ValidationError("Invalid agent ID")

    async def _validate_pipeline_and_task(self, pipeline_id: str, task_id: str) -> None:
        """Validate pipeline and task exist."""
        # This would integrate with existing pipeline and task services
        # For now, basic validation
        if not pipeline_id or not pipeline_id.strip():
            raise ValidationError("Invalid pipeline ID")
        if not task_id or not task_id.strip():
            raise ValidationError("Invalid task ID")

    async def _validate_reviewer_permissions(self, reviewer_id: str, report: AgentHandoffReport) -> None:
        """Validate reviewer has permission to review the report."""
        # This would implement role-based permission checking
        # For now, basic validation
        if not reviewer_id or not reviewer_id.strip():
            raise ValidationError("Invalid reviewer ID")

    async def _validate_sign_off_permissions(
        self,
        agent_id: str,
        sign_off_role: str,
        report: AgentHandoffReport
    ) -> None:
        """Validate agent has permission for sign-off role."""
        # This would implement role-based permission checking
        # For now, basic validation
        if not agent_id or not agent_id.strip():
            raise ValidationError("Invalid agent ID")
        if sign_off_role not in [role.value for role in report.sign_offs_required]:
            raise ValidationError(f"Sign-off role {sign_off_role} not required for this report")

    async def _cache_report(self, report: AgentHandoffReport) -> None:
        """Cache report in Redis."""
        try:
            cache_key = f"{self.report_cache_prefix}{report.report_id}"
            cache_data = report.dict()
            await self.redis_client.setex(
                cache_key,
                3600,  # 1 hour TTL
                json.dumps(cache_data, default=str)
            )
        except Exception as e:
            self.logger.warning("Failed to cache report", error=str(e))

    async def _get_cached_report(self, report_id: str) -> AgentHandoffReport | None:
        """Get cached report from Redis."""
        try:
            cache_key = f"{self.report_cache_prefix}{report_id}"
            cached_data = await self.redis_client.get(cache_key)

            if cached_data:
                report_data = json.loads(cached_data)
                return AgentHandoffReport(**report_data)

            return None

        except Exception as e:
            self.logger.warning("Failed to get cached report", error=str(e))
            return None

    async def _cache_dashboard_data(self, dashboard_data: AgentHandoffDashboardData) -> None:
        """Cache dashboard data in Redis."""
        try:
            cache_data = dashboard_data.dict()
            await self.redis_client.setex(
                self.dashboard_cache_key,
                300,  # 5 minutes TTL
                json.dumps(cache_data, default=str)
            )
        except Exception as e:
            self.logger.warning("Failed to cache dashboard data", error=str(e))

    async def _get_cached_dashboard_data(self) -> AgentHandoffDashboardData | None:
        """Get cached dashboard data from Redis."""
        try:
            cached_data = await self.redis_client.get(self.dashboard_cache_key)

            if cached_data:
                dashboard_data = json.loads(cached_data)
                return AgentHandoffDashboardData(**dashboard_data)

            return None

        except Exception as e:
            self.logger.warning("Failed to get cached dashboard data", error=str(e))
            return None

    async def _trigger_review_workflow(self, report: AgentHandoffReport) -> None:
        """Trigger review workflow for submitted report."""
        try:
            # Update report status to under review
            reports_coll = self.database[self.reports_collection]
            await reports_coll.update_one(
                {"report_id": report.report_id},
                {"$set": {"status": HandoffReportStatus.UNDER_REVIEW}}
            )

            # Schedule review timeout
            asyncio.create_task(self._schedule_review_timeout(report.report_id))

            self.logger.info(
                "Review workflow triggered",
                report_id=report.report_id,
                review_timeout_days=self.service_config.review_timeout_days
            )

        except Exception as e:
            self.logger.error("Failed to trigger review workflow", error=str(e))

    async def _trigger_sign_off_workflow(self, report: AgentHandoffReport) -> None:
        """Trigger sign-off workflow for approved report."""
        try:
            # Send notifications to required sign-off roles
            if self.service_config.enable_notifications:
                await self._send_sign_off_requests(report)

            self.logger.info(
                "Sign-off workflow triggered",
                report_id=report.report_id,
                required_roles=report.sign_offs_required
            )

        except Exception as e:
            self.logger.error("Failed to trigger sign-off workflow", error=str(e))

    async def _schedule_review_timeout(self, report_id: str) -> None:
        """Schedule review timeout for report."""
        try:
            await asyncio.sleep(self.service_config.review_timeout_days * 24 * 3600)

            # Check if report still needs review
            report = await self.get_report(report_id)
            if report and report.status == HandoffReportStatus.UNDER_REVIEW:
                # Auto-approve based on quality metrics
                if (report.quality_score and
                    report.quality_score >= self.service_config.auto_approval_threshold):
                    await self._auto_approve_report(report_id)
                else:
                    await self._escalate_review(report_id)

        except Exception as e:
            self.logger.error("Review timeout scheduling failed", error=str(e))

    async def _auto_approve_report(self, report_id: str) -> None:
        """Auto-approve report based on quality metrics."""
        try:
            reports_coll = self.database[self.reports_collection]
            await reports_coll.update_one(
                {"report_id": report_id},
                {
                    "$set": {
                        "status": HandoffReportStatus.APPROVED,
                        "reviewed_at": datetime.utcnow(),
                        "review_feedback": "Auto-approved based on quality metrics"
                    }
                }
            )

            self.logger.info("Report auto-approved", report_id=report_id)

        except Exception as e:
            self.logger.error("Auto-approval failed", report_id=report_id, error=str(e))

    async def _escalate_review(self, report_id: str) -> None:
        """Escalate review for manual intervention."""
        try:
            reports_coll = self.database[self.reports_collection]
            await reports_coll.update_one(
                {"report_id": report_id},
                {
                    "$set": {
                        "status": HandoffReportStatus.AMENDMENTS_REQUIRED,
                        "reviewed_at": datetime.utcnow(),
                        "review_feedback": "Review timed out - manual intervention required"
                    }
                }
            )

            self.logger.warning("Review escalated for manual intervention", report_id=report_id)

        except Exception as e:
            self.logger.error("Review escalation failed", report_id=report_id, error=str(e))

    async def _store_review_record(self, review_request: AgentHandoffReviewRequest) -> None:
        """Store review record in database."""
        try:
            reviews_coll = self.database[self.reviews_collection]
            review_record = {
                "report_id": review_request.report_id,
                "reviewer_id": review_request.reviewer_id,
                "review_status": review_request.review_status,
                "review_comments": review_request.review_comments,
                "amendments_required": review_request.amendments_required,
                "quality_score": review_request.quality_score,
                "reviewed_at": datetime.utcnow()
            }

            await reviews_coll.insert_one(review_record)

        except Exception as e:
            self.logger.error("Failed to store review record", error=str(e))

    async def _store_sign_off_record(self, sign_off: SignOffRecord, report_id: str) -> None:
        """Store sign-off record in database."""
        try:
            sign_offs_coll = self.database[self.sign_offs_collection]
            sign_off_record = sign_off.dict()
            sign_off_record["report_id"] = report_id

            await sign_offs_coll.insert_one(sign_off_record)

        except Exception as e:
            self.logger.error("Failed to store sign-off record", error=str(e))

    async def _calculate_statistics(self) -> AgentHandoffStats:
        """Calculate hand-off report statistics."""
        try:
            reports_coll = self.database[self.reports_collection]

            # Total reports
            total_reports = await reports_coll.count_documents({})

            # Status breakdown
            pipeline = [
                {
                    "$group": {
                        "_id": "$status",
                        "count": {"$sum": 1}
                    }
                }
            ]

            status_counts = {}
            async for doc in reports_coll.aggregate(pipeline):
                status_counts[doc["_id"]] = doc["count"]

            # Phase 6 specific stats
            phase6_completed = await reports_coll.count_documents({
                "overall_phase6_progress": {"$gte": 100.0}
            })

            phase6_in_progress = await reports_coll.count_documents({
                "overall_phase6_progress": {"$gt": 0.0, "$lt": 100.0}
            })

            # Quality metrics
            quality_pipeline = [
                {
                    "$match": {"quality_score": {"$exists": True}}
                },
                {
                    "$group": {
                        "_id": None,
                        "avg_quality": {"$avg": "$quality_score"},
                        "avg_coverage": {"$avg": "$test_coverage_percentage"}
                    }
                }
            ]

            quality_stats = await reports_coll.aggregate(quality_pipeline).to_list(1)
            avg_quality = quality_stats[0]["avg_quality"] if quality_stats else None
            avg_coverage = quality_stats[0]["avg_coverage"] if quality_stats else None

            # Timing statistics
            timing_pipeline = [
                {
                    "$match": {
                        "submitted_at": {"$exists": True},
                        "reviewed_at": {"$exists": True}
                    }
                },
                {
                    "$project": {
                        "review_time_days": {
                            "$divide": [
                                {"$subtract": ["$reviewed_at", "$submitted_at"]},
                                1000 * 60 * 60 * 24
                            ]
                        }
                    }
                },
                {
                    "$group": {
                        "_id": None,
                        "avg_review_time": {"$avg": "$review_time_days"}
                    }
                }
            ]

            timing_stats = await reports_coll.aggregate(timing_pipeline).to_list(1)
            avg_review_time = timing_stats[0]["avg_review_time"] if timing_stats else None

            # Calculate average Phase 6 progress
            progress_pipeline = [
                {
                    "$group": {
                        "_id": None,
                        "avg_progress": {"$avg": "$overall_phase6_progress"}
                    }
                }
            ]

            progress_stats = await reports_coll.aggregate(progress_pipeline).to_list(1)
            avg_phase6_progress = progress_stats[0]["avg_progress"] if progress_stats else None

            return AgentHandoffStats(
                total_reports=total_reports,
                draft_reports=status_counts.get("draft", 0),
                submitted_reports=status_counts.get("submitted", 0),
                approved_reports=status_counts.get("approved", 0),
                rejected_reports=status_counts.get("rejected", 0),
                phase6_completed_reports=phase6_completed,
                phase6_in_progress_reports=phase6_in_progress,
                average_phase6_progress=avg_phase6_progress,
                average_quality_score=avg_quality,
                average_test_coverage=avg_coverage,
                average_review_time_days=avg_review_time
            )

        except Exception as e:
            self.logger.error("Failed to calculate statistics", error=str(e))
            return AgentHandoffStats()

    async def _get_recent_reports(self, limit: int = 10) -> list[AgentHandoffReport]:
        """Get recent hand-off reports."""
        try:
            reports_coll = self.database[self.reports_collection]

            cursor = reports_coll.find({}).sort("created_at", -1).limit(limit)
            reports = []

            async for doc in cursor:
                reports.append(AgentHandoffReport(**doc))

            return reports

        except Exception as e:
            self.logger.error("Failed to get recent reports", error=str(e))
            return []

    async def _get_pending_reviews(self) -> list[AgentHandoffReport]:
        """Get reports pending review."""
        try:
            reports_coll = self.database[self.reports_collection]

            cursor = reports_coll.find({
                "status": HandoffReportStatus.UNDER_REVIEW
            }).sort("submitted_at", 1)

            reports = []
            async for doc in cursor:
                reports.append(AgentHandoffReport(**doc))

            return reports

        except Exception as e:
            self.logger.error("Failed to get pending reviews", error=str(e))
            return []

    async def _calculate_phase6_summary(self) -> dict[str, Any]:
        """Calculate Phase 6 progress summary."""
        try:
            reports_coll = self.database[self.reports_collection]

            # Aggregate component progress across all reports
            pipeline = [
                {"$unwind": "$phase6_components"},
                {
                    "$group": {
                        "_id": "$phase6_components.component_type",
                        "avg_progress": {"$avg": "$phase6_components.progress_percentage"},
                        "completed_count": {
                            "$sum": {
                                "$cond": [
                                    {"$eq": ["$phase6_components.status", "completed"]},
                                    1,
                                    0
                                ]
                            }
                        },
                        "total_count": {"$sum": 1}
                    }
                }
            ]

            component_summary = {}
            async for doc in reports_coll.aggregate(pipeline):
                component_type = doc["_id"]
                component_summary[component_type] = {
                    "average_progress": doc["avg_progress"],
                    "completion_rate": doc["completed_count"] / doc["total_count"] if doc["total_count"] > 0 else 0,
                    "completed_count": doc["completed_count"],
                    "total_count": doc["total_count"]
                }

            return component_summary

        except Exception as e:
            self.logger.error("Failed to calculate Phase 6 summary", error=str(e))
            return {}

    async def _calculate_completion_rates(self) -> dict[str, float]:
        """Calculate component completion rates."""
        try:
            reports_coll = self.database[self.reports_collection]

            # Get all unique component types
            component_types = [ct.value for ct in ComponentType]
            completion_rates = {}

            for component_type in component_types:
                pipeline = [
                    {"$unwind": "$phase6_components"},
                    {
                        "$match": {
                            "phase6_components.component_type": component_type,
                            "phase6_components.status": "completed"
                        }
                    },
                    {
                        "$group": {
                            "_id": None,
                            "completed_count": {"$sum": 1}
                        }
                    }
                ]

                result = await reports_coll.aggregate(pipeline).to_list(1)
                completed = result[0]["completed_count"] if result else 0

                # Get total reports with this component
                total_pipeline = [
                    {"$unwind": "$phase6_components"},
                    {
                        "$match": {
                            "phase6_components.component_type": component_type
                        }
                    },
                    {
                        "$group": {
                            "_id": None,
                            "total_count": {"$sum": 1}
                        }
                    }
                ]

                total_result = await reports_coll.aggregate(total_pipeline).to_list(1)
                total = total_result[0]["total_count"] if total_result else 0

                completion_rates[component_type] = (completed / total * 100) if total > 0 else 0.0

            return completion_rates

        except Exception as e:
            self.logger.error("Failed to calculate completion rates", error=str(e))
            return {}

    async def _calculate_sign_off_summary(self) -> dict[str, Any]:
        """Calculate sign-off status summary."""
        try:
            reports_coll = self.database[self.reports_collection]

            # Count reports by sign-off status
            pipeline = [
                {
                    "$group": {
                        "_id": "$sign_off_status",
                        "count": {"$sum": 1}
                    }
                }
            ]

            sign_off_counts = {}
            async for doc in reports_coll.aggregate(pipeline):
                sign_off_counts[doc["_id"]] = doc["count"]

            # Calculate average sign-off completion rate
            completion_pipeline = [
                {
                    "$project": {
                        "required_count": {"$size": "$sign_offs_required"},
                        "received_count": {"$size": "$sign_offs_received"}
                    }
                },
                {
                    "$project": {
                        "completion_rate": {
                            "$cond": [
                                {"$gt": ["$required_count", 0]},
                                {"$divide": ["$received_count", "$required_count"]},
                                0
                            ]
                        }
                    }
                },
                {
                    "$group": {
                        "_id": None,
                        "avg_completion_rate": {"$avg": "$completion_rate"}
                    }
                }
            ]

            completion_result = await reports_coll.aggregate(completion_pipeline).to_list(1)
            avg_completion_rate = completion_result[0]["avg_completion_rate"] if completion_result else 0.0

            return {
                "status_counts": sign_off_counts,
                "average_completion_rate": avg_completion_rate * 100  # Convert to percentage
            }

        except Exception as e:
            self.logger.error("Failed to calculate sign-off summary", error=str(e))
            return {}

    # Notification methods
    async def _send_submission_notifications(self, report: AgentHandoffReport) -> None:
        """Send notifications for report submission."""
        try:
            # This would integrate with existing notification service
            self.logger.info(
                "Sending submission notifications",
                report_id=report.report_id,
                agent_id=report.agent_id
            )

        except Exception as e:
            self.logger.error("Failed to send submission notifications", error=str(e))

    async def _send_review_notifications(
        self,
        report: AgentHandoffReport,
        review_request: AgentHandoffReviewRequest
    ) -> None:
        """Send notifications for report review."""
        try:
            self.logger.info(
                "Sending review notifications",
                report_id=report.report_id,
                reviewer_id=review_request.reviewer_id,
                review_status=review_request.review_status
            )

        except Exception as e:
            self.logger.error("Failed to send review notifications", error=str(e))

    async def _send_sign_off_notifications(
        self,
        report: AgentHandoffReport,
        sign_off: SignOffRecord
    ) -> None:
        """Send notifications for report sign-off."""
        try:
            self.logger.info(
                "Sending sign-off notifications",
                report_id=report.report_id,
                sign_off_role=sign_off.role,
                status=sign_off.status
            )

        except Exception as e:
            self.logger.error("Failed to send sign-off notifications", error=str(e))

    async def _send_sign_off_requests(self, report: AgentHandoffReport) -> None:
        """Send sign-off requests to required roles."""
        try:
            self.logger.info(
                "Sending sign-off requests",
                report_id=report.report_id,
                required_roles=report.sign_offs_required
            )

        except Exception as e:
            self.logger.error("Failed to send sign-off requests", error=str(e))

    async def shutdown(self) -> None:
        """Shutdown agent hand-off service."""
        try:
            self.logger.info("Shutting down agent hand-off service")
            self._initialized = False
            self.logger.info("Agent hand-off service shutdown completed")

        except Exception as e:
            self.logger.error("Error during agent hand-off service shutdown", error=str(e))
