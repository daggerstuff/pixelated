"""
Tests for Agent Hand-off Service

Comprehensive test suite for agent hand-off report collection, Phase 6 completion
tracking, and sign-off workflows.
"""

import asyncio
import json
from datetime import datetime
from unittest.mock import AsyncMock, Mock

import pytest

from mcp_server.exceptions import AuthenticationError, ValidationError
from mcp_server.models.agent import Agent, AgentStatus
from mcp_server.models.agent_handoff import (
    AgentHandoffReport,
    AgentHandoffReviewRequest,
    AgentHandoffSignOffRequest,
    AgentHandoffSubmissionRequest,
    ComponentType,
    HandoffReportStatus,
    Phase6ComponentStatus,
    SignOffRole,
    create_handoff_report_id,
    get_default_phase6_components,
)
from mcp_server.services.agent_handoff_service import AgentHandoffService


@pytest.fixture
async def mock_database():
    """Mock MongoDB database."""
    database = Mock()
    database.agent_handoff_reports = AsyncMock()
    database.agent_handoff_sign_offs = AsyncMock()
    database.agent_handoff_reviews = AsyncMock()
    return database


@pytest.fixture
async def mock_redis():
    """Mock Redis client."""
    redis = AsyncMock()
    redis.get = AsyncMock(return_value=None)
    redis.setex = AsyncMock(return_value=True)
    return redis


@pytest.fixture
async def mock_config():
    """Mock MCP configuration."""
    config = Mock()
    config.database = Mock()
    config.redis = Mock()
    return config


@pytest.fixture
async def handoff_service(mock_config, mock_database, mock_redis):
    """Create agent hand-off service instance."""
    service = AgentHandoffService(mock_config, mock_database, mock_redis)
    await service.initialize()
    return service


@pytest.fixture
def sample_agent():
    """Create sample agent."""
    return Agent(
        id="agent_123",
        name="Test Agent",
        email="test@example.com",
        status=AgentStatus.ACTIVE
    )


@pytest.fixture
def sample_report_data():
    """Create sample report data."""
    return {
        "report_id": create_handoff_report_id(),
        "agent_id": "agent_123",
        "pipeline_id": "pipeline_456",
        "task_id": "task_789",
        "work_summary": "This is a comprehensive work summary that meets the minimum length requirement of fifty characters.",
        "achievements": ["Completed error handling", "Implemented API contracts"],
        "challenges_encountered": ["Complex integration issues", "Performance optimization"],
        "lessons_learned": ["Importance of testing", "Value of documentation"],
        "components_implemented": ["Error handling", "Retry mechanisms", "Circuit breaker"],
        "apis_integrated": ["Flask service", "Dataset integration"],
        "services_configured": ["Redis", "MongoDB"],
        "tests_written": ["Unit tests", "Integration tests"],
        "documentation_created": ["API docs", "Setup guide"],
        "quality_score": 0.9,
        "test_coverage_percentage": 85.0
    }


class TestAgentHandoffService:
    """Test cases for Agent Hand-off Service."""

    @pytest.mark.asyncio
    async def test_create_report_success(self, handoff_service, sample_agent, sample_report_data):
        """Test successful report creation."""
        # Mock database operations
        handoff_service.database.agent_handoff_reports.insert_one = AsyncMock(return_value=Mock(inserted_id="report_123"))

        # Create report
        report = await handoff_service.create_report(
            agent_id=sample_agent.id,
            pipeline_id=sample_report_data["pipeline_id"],
            task_id=sample_report_data["task_id"],
            work_summary=sample_report_data["work_summary"],
            achievements=sample_report_data["achievements"],
            challenges_encountered=sample_report_data["challenges_encountered"],
            lessons_learned=sample_report_data["lessons_learned"]
        )

        # Assertions
        assert report is not None
        assert report.agent_id == sample_agent.id
        assert report.pipeline_id == sample_report_data["pipeline_id"]
        assert report.task_id == sample_report_data["task_id"]
        assert report.work_summary == sample_report_data["work_summary"]
        assert report.status == HandoffReportStatus.DRAFT
        assert len(report.phase6_components) == 8  # Default components
        assert report.overall_phase6_progress == 0.0

    @pytest.mark.asyncio
    async def test_create_report_validation_error(self, handoff_service, sample_agent):
        """Test report creation with validation error."""
        # Test with invalid work summary (too short)
        with pytest.raises(ValidationError):
            await handoff_service.create_report(
                agent_id=sample_agent.id,
                pipeline_id="pipeline_123",
                task_id="task_456",
                work_summary="Too short"  # Less than 50 characters
            )

    @pytest.mark.asyncio
    async def test_get_report_success(self, handoff_service, sample_report_data):
        """Test successful report retrieval."""
        # Mock database operation
        handoff_service.database.agent_handoff_reports.find_one = AsyncMock(
            return_value=sample_report_data
        )

        # Get report
        report = await handoff_service.get_report(sample_report_data["report_id"])

        # Assertions
        assert report is not None
        assert report.report_id == sample_report_data["report_id"]
        assert report.agent_id == sample_report_data["agent_id"]

    @pytest.mark.asyncio
    async def test_get_report_not_found(self, handoff_service):
        """Test report retrieval when not found."""
        # Mock database operation
        handoff_service.database.agent_handoff_reports.find_one = AsyncMock(return_value=None)

        # Get report
        report = await handoff_service.get_report("nonexistent_report")

        # Assertions
        assert report is None

    @pytest.mark.asyncio
    async def test_update_report_success(self, handoff_service, sample_agent, sample_report_data):
        """Test successful report update."""
        # Create sample report
        report = AgentHandoffReport(**sample_report_data)

        # Mock database operations
        handoff_service.database.agent_handoff_reports.find_one = AsyncMock(return_value=sample_report_data)
        handoff_service.database.agent_handoff_reports.update_one = AsyncMock(
            return_value=Mock(modified_count=1)
        )

        # Update report
        updated_report = await handoff_service.update_report(
            report_id=report.report_id,
            agent_id=sample_agent.id,
            work_summary="Updated work summary that meets the minimum length requirement of fifty characters.",
            quality_score=0.95
        )

        # Assertions
        assert updated_report is not None
        assert updated_report.work_summary.startswith("Updated work summary")
        assert updated_report.quality_score == 0.95

    @pytest.mark.asyncio
    async def test_update_report_permission_denied(self, handoff_service, sample_agent, sample_report_data):
        """Test report update with permission denied."""
        # Create sample report with different agent
        report_data = sample_report_data.copy()
        report_data["agent_id"] = "different_agent"
        report = AgentHandoffReport(**report_data)

        # Mock database operation
        handoff_service.database.agent_handoff_reports.find_one = AsyncMock(return_value=report_data)

        # Try to update report
        with pytest.raises(AuthenticationError):
            await handoff_service.update_report(
                report_id=report.report_id,
                agent_id=sample_agent.id,  # Different agent
                work_summary="Updated work summary"
            )

    @pytest.mark.asyncio
    async def test_submit_report_success(self, handoff_service, sample_agent, sample_report_data):
        """Test successful report submission."""
        # Create sample report with completed Phase 6 components
        report_data = sample_report_data.copy()
        report_data["phase6_components"] = [
            {
                "component_type": ComponentType.ERROR_HANDLING,
                "status": Phase6ComponentStatus.COMPLETED,
                "progress_percentage": 100.0
            }
            for _ in range(8)  # All components completed
        ]
        report_data["overall_phase6_progress"] = 100.0

        # Mock database operations
        handoff_service.database.agent_handoff_reports.find_one = AsyncMock(return_value=report_data)
        handoff_service.database.agent_handoff_reports.update_one = AsyncMock(
            return_value=Mock(modified_count=1)
        )

        # Create submission request
        submission_request = AgentHandoffSubmissionRequest(
            report_id=report_data["report_id"],
            agent_id=sample_agent.id,
            submission_notes="Ready for review"
        )

        # Submit report
        submitted_report = await handoff_service.submit_report(submission_request)

        # Assertions
        assert submitted_report is not None
        assert submitted_report.status == HandoffReportStatus.SUBMITTED
        assert submitted_report.submitted_at is not None

    @pytest.mark.asyncio
    async def test_submit_report_incomplete_phase6(self, handoff_service, sample_agent, sample_report_data):
        """Test report submission with incomplete Phase 6 components."""
        # Create sample report with incomplete Phase 6 components
        report_data = sample_report_data.copy()
        report_data["phase6_components"] = [
            {
                "component_type": ComponentType.ERROR_HANDLING,
                "status": Phase6ComponentStatus.IN_PROGRESS,
                "progress_percentage": 50.0
            }
            for _ in range(8)  # All components incomplete
        ]
        report_data["overall_phase6_progress"] = 50.0

        # Mock database operation
        handoff_service.database.agent_handoff_reports.find_one = AsyncMock(return_value=report_data)

        # Create submission request
        submission_request = AgentHandoffSubmissionRequest(
            report_id=report_data["report_id"],
            agent_id=sample_agent.id
        )

        # Try to submit report
        with pytest.raises(ValidationError):
            await handoff_service.submit_report(submission_request)

    @pytest.mark.asyncio
    async def test_review_report_approved(self, handoff_service, sample_agent, sample_report_data):
        """Test successful report review (approved)."""
        # Create sample report in under review status
        report_data = sample_report_data.copy()
        report_data["status"] = HandoffReportStatus.UNDER_REVIEW

        # Mock database operations
        handoff_service.database.agent_handoff_reports.find_one = AsyncMock(return_value=report_data)
        handoff_service.database.agent_handoff_reports.update_one = AsyncMock(
            return_value=Mock(modified_count=1)
        )

        # Create review request
        review_request = AgentHandoffReviewRequest(
            report_id=report_data["report_id"],
            reviewer_id="reviewer_123",
            review_status="approved",
            review_comments="Excellent work! All requirements met.",
            quality_score=0.95
        )

        # Review report
        reviewed_report = await handoff_service.review_report(review_request)

        # Assertions
        assert reviewed_report is not None
        assert reviewed_report.status == HandoffReportStatus.APPROVED
        assert reviewed_report.quality_score == 0.95
        assert reviewed_report.review_feedback == review_request.review_comments

    @pytest.mark.asyncio
    async def test_review_report_rejected(self, handoff_service, sample_agent, sample_report_data):
        """Test report review (rejected)."""
        # Create sample report in under review status
        report_data = sample_report_data.copy()
        report_data["status"] = HandoffReportStatus.UNDER_REVIEW

        # Mock database operations
        handoff_service.database.agent_handoff_reports.find_one = AsyncMock(return_value=report_data)
        handoff_service.database.agent_handoff_reports.update_one = AsyncMock(
            return_value=Mock(modified_count=1)
        )

        # Create review request
        review_request = AgentHandoffReviewRequest(
            report_id=report_data["report_id"],
            reviewer_id="reviewer_123",
            review_status="rejected",
            review_comments="Does not meet requirements. Major issues found."
        )

        # Review report
        reviewed_report = await handoff_service.review_report(review_request)

        # Assertions
        assert reviewed_report is not None
        assert reviewed_report.status == HandoffReportStatus.REJECTED
        assert reviewed_report.review_feedback == review_request.review_comments

    @pytest.mark.asyncio
    async def test_sign_off_report_approved(self, handoff_service, sample_agent, sample_report_data):
        """Test successful report sign-off (approved)."""
        # Create sample report in approved status
        report_data = sample_report_data.copy()
        report_data["status"] = HandoffReportStatus.APPROVED
        report_data["sign_offs_required"] = ["developer", "tech_lead"]

        # Mock database operations
        handoff_service.database.agent_handoff_reports.find_one = AsyncMock(return_value=report_data)
        handoff_service.database.agent_handoff_reports.update_one = AsyncMock(
            return_value=Mock(modified_count=1)
        )
        handoff_service.database.agent_handoff_sign_offs.insert_one = AsyncMock(
            return_value=Mock(inserted_id="signoff_123")
        )

        # Create sign-off request
        sign_off_request = AgentHandoffSignOffRequest(
            report_id=report_data["report_id"],
            sign_off_role=SignOffRole.DEVELOPER,
            agent_id="developer_123",
            status="approved",
            comments="Code review passed. Ready for production."
        )

        # Sign off report
        signed_report = await handoff_service.sign_off_report(sign_off_request)

        # Assertions
        assert signed_report is not None
        assert len(signed_report.sign_offs_received) == 1
        assert signed_report.sign_offs_received[0].role == SignOffRole.DEVELOPER
        assert signed_report.sign_offs_received[0].status == "approved"
        assert signed_report.sign_off_status == "partially_approved"

    @pytest.mark.asyncio
    async def test_update_component_progress(self, handoff_service, sample_agent, sample_report_data):
        """Test updating component progress."""
        from mcp_server.models.agent_handoff import Phase6ComponentProgress

        # Create sample report
        report_data = sample_report_data.copy()
        report_data["phase6_components"] = get_default_phase6_components()

        # Mock database operations
        handoff_service.database.agent_handoff_reports.find_one = AsyncMock(return_value=report_data)
        handoff_service.database.agent_handoff_reports.update_one = AsyncMock(
            return_value=Mock(modified_count=1)
        )

        # Create progress update
        progress = Phase6ComponentProgress(
            component_type=ComponentType.ERROR_HANDLING,
            status=Phase6ComponentStatus.COMPLETED,
            progress_percentage=100.0,
            completed_at=datetime.utcnow(),
            notes="Error handling implementation completed successfully"
        )

        # Update component progress
        updated_report = await handoff_service.update_component_progress(
            report_id=report_data["report_id"],
            agent_id=sample_agent.id,
            component_type=ComponentType.ERROR_HANDLING,
            progress=progress
        )

        # Assertions
        assert updated_report is not None
        error_handling_component = updated_report.get_component_progress(ComponentType.ERROR_HANDLING)
        assert error_handling_component is not None
        assert error_handling_component.status == Phase6ComponentStatus.COMPLETED
        assert error_handling_component.progress_percentage == 100.0
        assert error_handling_component.notes == "Error handling implementation completed successfully"

    @pytest.mark.asyncio
    async def test_get_dashboard_data(self, handoff_service):
        """Test getting dashboard data."""
        # Mock database operations
        handoff_service.database.agent_handoff_reports.count_documents = AsyncMock(return_value=5)
        handoff_service.database.agent_handoff_reports.aggregate = AsyncMock()

        # Configure aggregate mock to return async iterator
        async def mock_aggregate():
            yield {"_id": "draft", "count": 2}
            yield {"_id": "submitted", "count": 2}
            yield {"_id": "approved", "count": 1}

        handoff_service.database.agent_handoff_reports.aggregate.return_value = mock_aggregate()

        # Get dashboard data
        dashboard_data = await handoff_service.get_dashboard_data()

        # Assertions
        assert dashboard_data is not None
        assert dashboard_data.statistics.total_reports == 5
        assert dashboard_data.statistics.draft_reports == 2
        assert dashboard_data.statistics.submitted_reports == 2
        assert dashboard_data.statistics.approved_reports == 1

    @pytest.mark.asyncio
    async def test_report_completeness_check(self, handoff_service, sample_report_data):
        """Test report completeness validation."""
        # Create sample report with all required fields
        report_data = sample_report_data.copy()
        report_data["phase6_components"] = [
            {
                "component_type": ComponentType.ERROR_HANDLING,
                "status": Phase6ComponentStatus.COMPLETED,
                "progress_percentage": 100.0
            }
            for _ in range(8)  # All components completed
        ]
        report_data["overall_phase6_progress"] = 100.0

        report = AgentHandoffReport(**report_data)

        # Test completeness check
        assert report.is_complete() is True

        # Test with incomplete components
        report.phase6_components[0].status = Phase6ComponentStatus.IN_PROGRESS
        report.phase6_components[0].progress_percentage = 50.0
        report._recalculate_overall_progress()

        assert report.is_complete() is False

    @pytest.mark.asyncio
    async def test_report_approval_check(self, handoff_service, sample_report_data):
        """Test report approval validation."""
        # Create sample report with sign-offs
        report_data = sample_report_data.copy()
        report_data["sign_offs_required"] = ["developer", "tech_lead"]
        report_data["sign_offs_received"] = [
            {
                "sign_off_id": "signoff_1",
                "role": SignOffRole.DEVELOPER,
                "signed_by": "developer_123",
                "signed_at": datetime.utcnow(),
                "status": "approved"
            },
            {
                "sign_off_id": "signoff_2",
                "role": SignOffRole.TECH_LEAD,
                "signed_by": "tech_lead_123",
                "signed_at": datetime.utcnow(),
                "status": "approved"
            }
        ]

        report = AgentHandoffReport(**report_data)

        # Test approval check
        assert report.is_approved() is True

        # Test with missing sign-off
        report.sign_offs_received.pop()
        report._update_sign_off_status()

        assert report.is_approved() is False

    @pytest.mark.asyncio
    async def test_phase6_completion_validation(self, handoff_service):
        """Test Phase 6 completion validation."""
        # Create completed components
        components = [
            {
                "component_type": ComponentType.ERROR_HANDLING,
                "status": Phase6ComponentStatus.COMPLETED,
                "progress_percentage": 100.0
            },
            {
                "component_type": ComponentType.API_CONTRACTS,
                "status": Phase6ComponentStatus.COMPLETED,
                "progress_percentage": 100.0
            }
        ]

        # Convert to proper model instances
        from mcp_server.models.agent_handoff import Phase6ComponentProgress
        component_models = [Phase6ComponentProgress(**comp) for comp in components]

        # Test validation
        from mcp_server.models.agent_handoff import validate_phase6_completion
        assert validate_phase6_completion(component_models) is True

        # Test with incomplete component
        component_models[0].status = Phase6ComponentStatus.IN_PROGRESS
        component_models[0].progress_percentage = 50.0

        assert validate_phase6_completion(component_models) is False

    @pytest.mark.asyncio
    async def test_report_caching(self, handoff_service, sample_report_data):
        """Test report caching functionality."""
        # Create sample report
        report = AgentHandoffReport(**sample_report_data)

        # Mock Redis operations
        handoff_service.redis_client.setex = AsyncMock(return_value=True)
        handoff_service.redis_client.get = AsyncMock(return_value=None)

        # Cache report
        await handoff_service._cache_report(report)

        # Verify cache call
        handoff_service.redis_client.setex.assert_called_once()
        cache_key = handoff_service.redis_client.setex.call_args[0][0]
        assert cache_key == f"handoff:report:{report.report_id}"

        # Test cache retrieval
        cached_report_data = report.dict()
        handoff_service.redis_client.get = AsyncMock(
            return_value=json.dumps(cached_report_data, default=str)
        )

        cached_report = await handoff_service._get_cached_report(report.report_id)

        assert cached_report is not None
        assert cached_report.report_id == report.report_id

    @pytest.mark.asyncio
    async def test_service_health_check(self, handoff_service):
        """Test service health check."""
        # Test healthy service
        health_status = await handoff_service.get_integration_status()

        assert health_status is not None
        assert health_status["status"] == "active"
        assert "websocket_connections" in health_status
        assert "event_handlers_registered" in health_status

    @pytest.mark.asyncio
    async def test_service_shutdown(self, handoff_service):
        """Test service shutdown."""
        # Shutdown service
        await handoff_service.shutdown()

        # Verify shutdown
        assert handoff_service._initialized is False


class TestAgentHandoffIntegration:
    """Integration tests for agent hand-off service."""

    @pytest.mark.asyncio
    async def test_full_report_lifecycle(self, handoff_service, sample_agent):
        """Test complete report lifecycle: create -> update -> submit -> review -> sign off."""
        # Step 1: Create report
        report_data = {
            "report_id": create_handoff_report_id(),
            "agent_id": sample_agent.id,
            "pipeline_id": "pipeline_123",
            "task_id": "task_456",
            "work_summary": "This is a comprehensive work summary that meets the minimum length requirement of fifty characters.",
            "achievements": ["Implemented error handling", "Created API contracts"],
            "challenges_encountered": ["Complex integrations", "Performance issues"],
            "lessons_learned": ["Testing is crucial", "Documentation matters"]
        }

        # Mock database operations for creation
        handoff_service.database.agent_handoff_reports.insert_one = AsyncMock(
            return_value=Mock(inserted_id="report_123")
        )

        report = await handoff_service.create_report(**report_data)
        assert report is not None
        assert report.status == HandoffReportStatus.DRAFT

        # Step 2: Update component progress
        from mcp_server.models.agent_handoff import Phase6ComponentProgress

        # Mock database operations for update
        handoff_service.database.agent_handoff_reports.find_one = AsyncMock(return_value=report.dict())
        handoff_service.database.agent_handoff_reports.update_one = AsyncMock(
            return_value=Mock(modified_count=1)
        )

        # Update all components to completed
        for component_type in ComponentType:
            progress = Phase6ComponentProgress(
                component_type=component_type,
                status=Phase6ComponentStatus.COMPLETED,
                progress_percentage=100.0,
                completed_at=datetime.utcnow(),
                notes=f"{component_type.value} implementation completed"
            )

            updated_report = await handoff_service.update_component_progress(
                report_id=report.report_id,
                agent_id=sample_agent.id,
                component_type=component_type,
                progress=progress
            )

            assert updated_report is not None

        # Step 3: Submit report
        # Mock database operations for submission
        handoff_service.database.agent_handoff_reports.find_one = AsyncMock(
            return_value=updated_report.dict()
        )

        submission_request = AgentHandoffSubmissionRequest(
            report_id=report.report_id,
            agent_id=sample_agent.id,
            submission_notes="Ready for review and approval"
        )

        submitted_report = await handoff_service.submit_report(submission_request)
        assert submitted_report is not None
        assert submitted_report.status == HandoffReportStatus.SUBMITTED

        # Step 4: Review report (approve)
        # Mock database operations for review
        handoff_service.database.agent_handoff_reports.find_one = AsyncMock(
            return_value=submitted_report.dict()
        )
        handoff_service.database.agent_handoff_reviews.insert_one = AsyncMock(
            return_value=Mock(inserted_id="review_123")
        )

        review_request = AgentHandoffReviewRequest(
            report_id=report.report_id,
            reviewer_id="reviewer_123",
            review_status="approved",
            review_comments="Excellent implementation. All requirements satisfied.",
            quality_score=0.95
        )

        reviewed_report = await handoff_service.review_report(review_request)
        assert reviewed_report is not None
        assert reviewed_report.status == HandoffReportStatus.APPROVED
        assert reviewed_report.quality_score == 0.95

        # Step 5: Sign off report
        # Mock database operations for sign-off
        handoff_service.database.agent_handoff_reports.find_one = AsyncMock(
            return_value=reviewed_report.dict()
        )
        handoff_service.database.agent_handoff_sign_offs.insert_one = AsyncMock(
            return_value=Mock(inserted_id="signoff_123")
        )

        # Developer sign-off
        dev_sign_off = AgentHandoffSignOffRequest(
            report_id=report.report_id,
            sign_off_role=SignOffRole.DEVELOPER,
            agent_id="developer_123",
            status="approved",
            comments="Code review passed. Implementation is solid."
        )

        dev_signed_report = await handoff_service.sign_off_report(dev_sign_off)
        assert dev_signed_report is not None
        assert len(dev_signed_report.sign_offs_received) == 1

        # Tech lead sign-off
        tl_sign_off = AgentHandoffSignOffRequest(
            report_id=report.report_id,
            sign_off_role=SignOffRole.TECH_LEAD,
            agent_id="tech_lead_123",
            status="approved",
            comments="Architecture review passed. Ready for production."
        )

        final_report = await handoff_service.sign_off_report(tl_sign_off)
        assert final_report is not None
        assert len(final_report.sign_offs_received) == 2
        assert final_report.is_approved() is True
        assert final_report.sign_off_status == "approved"

    @pytest.mark.asyncio
    async def test_report_with_amendments_workflow(self, handoff_service, sample_agent):
        """Test report workflow with amendments required."""
        # Create and submit report
        report_data = {
            "report_id": create_handoff_report_id(),
            "agent_id": sample_agent.id,
            "pipeline_id": "pipeline_123",
            "task_id": "task_456",
            "work_summary": "This is a comprehensive work summary that meets the minimum length requirement of fifty characters.",
            "status": HandoffReportStatus.SUBMITTED
        }

        # Mock database operations
        handoff_service.database.agent_handoff_reports.find_one = AsyncMock(return_value=report_data)
        handoff_service.database.agent_handoff_reports.update_one = AsyncMock(
            return_value=Mock(modified_count=1)
        )

        # Review with amendments required
        review_request = AgentHandoffReviewRequest(
            report_id=report_data["report_id"],
            reviewer_id="reviewer_123",
            review_status="amendments_required",
            review_comments="Good work, but some improvements needed.",
            amendments_required=["Add more test coverage", "Improve error handling documentation"]
        )

        reviewed_report = await handoff_service.review_report(review_request)
        assert reviewed_report is not None
        assert reviewed_report.status == HandoffReportStatus.AMENDMENTS_REQUIRED
        assert len(reviewed_report.amendments_required) == 2

        # Agent updates report with amendments
        updated_report = await handoff_service.update_report(
            report_id=report_data["report_id"],
            agent_id=sample_agent.id,
            work_summary="Updated work summary with additional details about test coverage and error handling documentation.",
            test_coverage_percentage=95.0
        )

        assert updated_report is not None
        assert updated_report.status == HandoffReportStatus.AMENDMENTS_REQUIRED

        # Resubmit report
        resubmission_request = AgentHandoffSubmissionRequest(
            report_id=report_data["report_id"],
            agent_id=sample_agent.id,
            submission_notes="Amendments completed as requested."
        )

        resubmitted_report = await handoff_service.submit_report(resubmission_request)
        assert resubmitted_report is not None
        assert resubmitted_report.status == HandoffReportStatus.SUBMITTED


@pytest.mark.asyncio
async def test_concurrent_report_operations(handoff_service, sample_agent):
    """Test concurrent operations on multiple reports."""
    # Create multiple reports
    report_ids = []
    for i in range(5):
        report_data = {
            "report_id": create_handoff_report_id(),
            "agent_id": sample_agent.id,
            "pipeline_id": f"pipeline_{i}",
            "task_id": f"task_{i}",
            "work_summary": f"Work summary for report {i} that meets the minimum length requirement.",
        }

        # Mock database operation
        handoff_service.database.agent_handoff_reports.insert_one = AsyncMock(
            return_value=Mock(inserted_id=f"report_{i}")
        )

        report = await handoff_service.create_report(**report_data)
        report_ids.append(report.report_id)

    # Perform concurrent updates
    async def update_report_component(report_id, component_type):
        from mcp_server.models.agent_handoff import Phase6ComponentProgress

        progress = Phase6ComponentProgress(
            component_type=component_type,
            status=Phase6ComponentStatus.COMPLETED,
            progress_percentage=100.0
        )

        # Mock database operations
        handoff_service.database.agent_handoff_reports.find_one = AsyncMock(
            return_value={"report_id": report_id, "agent_id": sample_agent.id, "status": "draft"}
        )
        handoff_service.database.agent_handoff_reports.update_one = AsyncMock(
            return_value=Mock(modified_count=1)
        )

        return await handoff_service.update_component_progress(
            report_id=report_id,
            agent_id=sample_agent.id,
            component_type=component_type,
            progress=progress
        )

    # Run concurrent updates
    tasks = []
    for i, report_id in enumerate(report_ids):
        component_type = list(ComponentType)[i % len(ComponentType)]
        tasks.append(update_report_component(report_id, component_type))

    results = await asyncio.gather(*tasks)

    # Assertions
    assert len(results) == 5
    for result in results:
        assert result is not None
        assert any(comp.status == Phase6ComponentStatus.COMPLETED for comp in result.phase6_components)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
