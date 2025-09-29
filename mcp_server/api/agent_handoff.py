"""
Agent Hand-off API Endpoints for MCP Server

Provides RESTful API endpoints for agent hand-off report management,
Phase 6 completion tracking, and sign-off workflows.
"""

from typing import List, Optional, Dict, Any
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Path, Body
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from mcp_server.config import MCPConfig
from mcp_server.services.agent_handoff_service import AgentHandoffService
from mcp_server.models.agent_handoff import (
    AgentHandoffReport,
    AgentHandoffSubmissionRequest,
    AgentHandoffReviewRequest,
    AgentHandoffSignOffRequest,
    AgentHandoffFilter,
    AgentHandoffDashboardData,
    ComponentType,
    HandoffReportStatus
)
from mcp_server.middleware.auth import get_current_agent
from mcp_server.models.agent import Agent
from mcp_server.exceptions import ValidationError, ResourceNotFoundError, AuthenticationError


# Request/Response Models
class CreateReportRequest(BaseModel):
    """Request model for creating agent hand-off report."""
    
    pipeline_id: str = Field(..., description="Associated pipeline ID")
    task_id: str = Field(..., description="Associated task ID")
    work_summary: str = Field(..., min_length=50, max_length=5000, description="Detailed work summary")
    achievements: Optional[List[str]] = Field(None, description="Key achievements")
    challenges_encountered: Optional[List[str]] = Field(None, description="Challenges encountered")
    lessons_learned: Optional[List[str]] = Field(None, description="Lessons learned")
    components_implemented: Optional[List[str]] = Field(None, description="Components implemented")
    apis_integrated: Optional[List[str]] = Field(None, description="APIs integrated")
    services_configured: Optional[List[str]] = Field(None, description="Services configured")
    tests_written: Optional[List[str]] = Field(None, description="Tests written")
    documentation_created: Optional[List[str]] = Field(None, description="Documentation created")
    quality_score: Optional[float] = Field(None, ge=0.0, le=1.0, description="Quality score")
    test_coverage_percentage: Optional[float] = Field(None, ge=0.0, le=100.0, description="Test coverage percentage")


class UpdateReportRequest(BaseModel):
    """Request model for updating agent hand-off report."""
    
    work_summary: Optional[str] = Field(None, min_length=50, max_length=5000, description="Detailed work summary")
    achievements: Optional[List[str]] = Field(None, description="Key achievements")
    challenges_encountered: Optional[List[str]] = Field(None, description="Challenges encountered")
    lessons_learned: Optional[List[str]] = Field(None, description="Lessons learned")
    components_implemented: Optional[List[str]] = Field(None, description="Components implemented")
    apis_integrated: Optional[List[str]] = Field(None, description="APIs integrated")
    services_configured: Optional[List[str]] = Field(None, description="Services configured")
    tests_written: Optional[List[str]] = Field(None, description="Tests written")
    documentation_created: Optional[List[str]] = Field(None, description="Documentation created")
    quality_score: Optional[float] = Field(None, ge=0.0, le=1.0, description="Quality score")
    test_coverage_percentage: Optional[float] = Field(None, ge=0.0, le=100.0, description="Test coverage percentage")
    attachments: Optional[List[str]] = Field(None, description="Attachment file paths/URLs")
    code_references: Optional[List[str]] = Field(None, description="Code reference links")
    documentation_links: Optional[List[str]] = Field(None, description="Documentation links")


class ComponentProgressRequest(BaseModel):
    """Request model for updating component progress."""
    
    component_type: ComponentType = Field(..., description="Component type to update")
    status: str = Field(..., description="Component status")
    progress_percentage: float = Field(..., ge=0.0, le=100.0, description="Completion percentage")
    started_at: Optional[datetime] = Field(None, description="When component work started")
    completed_at: Optional[datetime] = Field(None, description="When component work completed")
    estimated_completion: Optional[datetime] = Field(None, description="Estimated completion time")
    notes: Optional[str] = Field(None, max_length=2000, description="Progress notes and comments")
    test_results: Optional[Dict[str, Any]] = Field(None, description="Test results and validation data")
    code_review_status: Optional[str] = Field(None, description="Code review status")
    security_review_status: Optional[str] = Field(None, description="Security review status")


class ReportListResponse(BaseModel):
    """Response model for report list."""
    
    reports: List[AgentHandoffReport]
    total_count: int
    page: int
    page_size: int
    has_next: bool
    has_previous: bool


class DashboardResponse(BaseModel):
    """Response model for dashboard data."""
    
    dashboard_data: AgentHandoffDashboardData


# API Router
router = APIRouter(prefix="/api/v1/agent-handoff", tags=["Agent Hand-off"])


def get_handoff_service(request) -> AgentHandoffService:
    """Get agent hand-off service from request app state."""
    return request.app.state.handoff_service


@router.post("/reports", response_model=AgentHandoffReport)
async def create_report(
    request: CreateReportRequest,
    current_agent: Agent = Depends(get_current_agent),
    handoff_service: AgentHandoffService = Depends(get_handoff_service)
) -> AgentHandoffReport:
    """
    Create a new agent hand-off report.
    
    Args:
        request: Report creation request
        current_agent: Currently authenticated agent
        handoff_service: Agent hand-off service
        
    Returns:
        Created agent hand-off report
        
    Raises:
        HTTPException: If creation fails
    """
    try:
        report = await handoff_service.create_report(
            agent_id=current_agent.id,
            pipeline_id=request.pipeline_id,
            task_id=request.task_id,
            work_summary=request.work_summary,
            achievements=request.achievements,
            challenges_encountered=request.challenges_encountered,
            lessons_learned=request.lessons_learned,
            components_implemented=request.components_implemented,
            apis_integrated=request.apis_integrated,
            services_configured=request.services_configured,
            tests_written=request.tests_written,
            documentation_created=request.documentation_created,
            quality_score=request.quality_score,
            test_coverage_percentage=request.test_coverage_percentage
        )
        
        return report
        
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ResourceNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create report: {str(e)}")


@router.get("/reports/{report_id}", response_model=AgentHandoffReport)
async def get_report(
    report_id: str = Path(..., description="Report ID"),
    current_agent: Agent = Depends(get_current_agent),
    handoff_service: AgentHandoffService = Depends(get_handoff_service)
) -> AgentHandoffReport:
    """
    Get agent hand-off report by ID.
    
    Args:
        report_id: Report ID
        current_agent: Currently authenticated agent
        handoff_service: Agent hand-off service
        
    Returns:
        Agent hand-off report
        
    Raises:
        HTTPException: If report not found or access denied
    """
    try:
        report = await handoff_service.get_report(report_id)
        
        if not report:
            raise HTTPException(status_code=404, detail="Report not found")
        
        # Check if agent has permission to view this report
        if report.agent_id != current_agent.id and not current_agent.is_admin:
            raise HTTPException(status_code=403, detail="Access denied")
        
        return report
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get report: {str(e)}")


@router.put("/reports/{report_id}", response_model=AgentHandoffReport)
async def update_report(
    report_id: str = Path(..., description="Report ID"),
    request: UpdateReportRequest,
    current_agent: Agent = Depends(get_current_agent),
    handoff_service: AgentHandoffService = Depends(get_handoff_service)
) -> AgentHandoffReport:
    """
    Update agent hand-off report.
    
    Args:
        report_id: Report ID to update
        request: Update request
        current_agent: Currently authenticated agent
        handoff_service: Agent hand-off service
        
    Returns:
        Updated agent hand-off report
        
    Raises:
        HTTPException: If update fails
    """
    try:
        # Filter out None values
        updates = {k: v for k, v in request.dict().items() if v is not None}
        
        if not updates:
            raise HTTPException(status_code=400, detail="No updates provided")
        
        report = await handoff_service.update_report(
            report_id=report_id,
            agent_id=current_agent.id,
            **updates
        )
        
        if not report:
            raise HTTPException(status_code=404, detail="Report not found")
        
        return report
        
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except AuthenticationError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update report: {str(e)}")


@router.post("/reports/{report_id}/submit", response_model=AgentHandoffReport)
async def submit_report(
    report_id: str = Path(..., description="Report ID to submit"),
    submission_notes: Optional[str] = Body(None, description="Submission notes"),
    attachments: Optional[List[str]] = Body(None, description="Additional attachments"),
    current_agent: Agent = Depends(get_current_agent),
    handoff_service: AgentHandoffService = Depends(get_handoff_service)
) -> AgentHandoffReport:
    """
    Submit agent hand-off report for review.
    
    Args:
        report_id: Report ID to submit
        submission_notes: Optional submission notes
        attachments: Optional additional attachments
        current_agent: Currently authenticated agent
        handoff_service: Agent hand-off service
        
    Returns:
        Updated agent hand-off report
        
    Raises:
        HTTPException: If submission fails
    """
    try:
        submission_request = AgentHandoffSubmissionRequest(
            report_id=report_id,
            agent_id=current_agent.id,
            submission_notes=submission_notes,
            attachments=attachments
        )
        
        report = await handoff_service.submit_report(submission_request)
        
        if not report:
            raise HTTPException(status_code=404, detail="Report not found")
        
        return report
        
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except AuthenticationError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ResourceNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to submit report: {str(e)}")


@router.post("/reports/{report_id}/review", response_model=AgentHandoffReport)
async def review_report(
    report_id: str = Path(..., description="Report ID to review"),
    review_status: str = Body(..., description="Review status (approved/rejected/amendments_required)"),
    review_comments: str = Body(..., description="Detailed review comments"),
    amendments_required: Optional[List[str]] = Body(None, description="Specific amendments required"),
    quality_score: Optional[float] = Body(None, ge=0.0, le=1.0, description="Quality score"),
    current_agent: Agent = Depends(get_current_agent),
    handoff_service: AgentHandoffService = Depends(get_handoff_service)
) -> AgentHandoffReport:
    """
    Review agent hand-off report.
    
    Args:
        report_id: Report ID to review
        review_status: Review status
        review_comments: Review comments
        amendments_required: Required amendments if applicable
        quality_score: Quality score if approved
        current_agent: Currently authenticated agent (reviewer)
        handoff_service: Agent hand-off service
        
    Returns:
        Updated agent hand-off report
        
    Raises:
        HTTPException: If review fails
    """
    try:
        review_request = AgentHandoffReviewRequest(
            report_id=report_id,
            reviewer_id=current_agent.id,
            review_status=review_status,
            review_comments=review_comments,
            amendments_required=amendments_required,
            quality_score=quality_score
        )
        
        report = await handoff_service.review_report(review_request)
        
        if not report:
            raise HTTPException(status_code=404, detail="Report not found")
        
        return report
        
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except AuthenticationError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ResourceNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to review report: {str(e)}")


@router.post("/reports/{report_id}/sign-off", response_model=AgentHandoffReport)
async def sign_off_report(
    report_id: str = Path(..., description="Report ID to sign off"),
    sign_off_role: str = Body(..., description="Sign-off role"),
    status: str = Body(..., description="Sign-off status (approved/rejected/conditional)"),
    comments: Optional[str] = Body(None, description="Sign-off comments"),
    conditions: Optional[List[str]] = Body(None, description="Approval conditions if applicable"),
    expires_in_days: Optional[int] = Body(None, ge=1, le=365, description="Sign-off expiration in days"),
    current_agent: Agent = Depends(get_current_agent),
    handoff_service: AgentHandoffService = Depends(get_handoff_service)
) -> AgentHandoffReport:
    """
    Sign off on agent hand-off report.
    
    Args:
        report_id: Report ID to sign off
        sign_off_role: Sign-off role
        status: Sign-off status
        comments: Optional sign-off comments
        conditions: Optional approval conditions
        expires_in_days: Optional expiration in days
        current_agent: Currently authenticated agent
        handoff_service: Agent hand-off service
        
    Returns:
        Updated agent hand-off report
        
    Raises:
        HTTPException: If sign-off fails
    """
    try:
        sign_off_request = AgentHandoffSignOffRequest(
            report_id=report_id,
            sign_off_role=sign_off_role,
            agent_id=current_agent.id,
            status=status,
            comments=comments,
            conditions=conditions,
            expires_in_days=expires_in_days
        )
        
        report = await handoff_service.sign_off_report(sign_off_request)
        
        if not report:
            raise HTTPException(status_code=404, detail="Report not found")
        
        return report
        
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except AuthenticationError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ResourceNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to sign off report: {str(e)}")


@router.put("/reports/{report_id}/components/{component_type}", response_model=AgentHandoffReport)
async def update_component_progress(
    report_id: str = Path(..., description="Report ID"),
    component_type: ComponentType = Path(..., description="Component type"),
    request: ComponentProgressRequest,
    current_agent: Agent = Depends(get_current_agent),
    handoff_service: AgentHandoffService = Depends(get_handoff_service)
) -> AgentHandoffReport:
    """
    Update Phase 6 component progress in a report.
    
    Args:
        report_id: Report ID
        component_type: Component type to update
        request: Component progress update request
        current_agent: Currently authenticated agent
        handoff_service: Agent hand-off service
        
    Returns:
        Updated agent hand-off report
        
    Raises:
        HTTPException: If update fails
    """
    try:
        from mcp_server.models.agent_handoff import Phase6ComponentProgress
        
        progress = Phase6ComponentProgress(
            component_type=component_type,
            status=request.status,
            progress_percentage=request.progress_percentage,
            started_at=request.started_at,
            completed_at=request.completed_at,
            estimated_completion=request.estimated_completion,
            notes=request.notes,
            test_results=request.test_results,
            code_review_status=request.code_review_status,
            security_review_status=request.security_review_status
        )
        
        report = await handoff_service.update_component_progress(
            report_id=report_id,
            agent_id=current_agent.id,
            component_type=component_type,
            progress=progress
        )
        
        if not report:
            raise HTTPException(status_code=404, detail="Report not found")
        
        return report
        
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except AuthenticationError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update component progress: {str(e)}")


@router.get("/reports", response_model=ReportListResponse)
async def list_reports(
    status: Optional[str] = Query(None, description="Filter by report status"),
    agent_id: Optional[str] = Query(None, description="Filter by agent ID"),
    pipeline_id: Optional[str] = Query(None, description="Filter by pipeline ID"),
    task_id: Optional[str] = Query(None, description="Filter by task ID"),
    created_after: Optional[datetime] = Query(None, description="Filter reports created after this time"),
    created_before: Optional[datetime] = Query(None, description="Filter reports created before this time"),
    min_quality_score: Optional[float] = Query(None, ge=0.0, le=1.0, description="Minimum quality score"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Page size"),
    current_agent: Agent = Depends(get_current_agent),
    handoff_service: AgentHandoffService = Depends(get_handoff_service)
) -> ReportListResponse:
    """
    List agent hand-off reports with filtering and pagination.
    
    Args:
        status: Optional status filter
        agent_id: Optional agent ID filter
        pipeline_id: Optional pipeline ID filter
        task_id: Optional task ID filter
        created_after: Optional creation time filter
        created_before: Optional creation time filter
        min_quality_score: Optional minimum quality score filter
        page: Page number
        page_size: Page size
        current_agent: Currently authenticated agent
        handoff_service: Agent hand-off service
        
    Returns:
        Paginated list of reports
        
    Raises:
        HTTPException: If listing fails
    """
    try:
        # Build filter
        report_filter = AgentHandoffFilter(
            status=status,
            agent_id=agent_id,
            pipeline_id=pipeline_id,
            task_id=task_id,
            created_after=created_after,
            created_before=created_before,
            min_quality_score=min_quality_score
        )
        
        # If not admin, only show reports for current agent
        if not current_agent.is_admin:
            report_filter.agent_id = current_agent.id
        
        # This would need to be implemented in the service
        # For now, return empty list
        reports = []  # await handoff_service.list_reports(filter=report_filter, page=page, page_size=page_size)
        
        return ReportListResponse(
            reports=reports,
            total_count=len(reports),
            page=page,
            page_size=page_size,
            has_next=False,
            has_previous=page > 1
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list reports: {str(e)}")


@router.get("/dashboard", response_model=DashboardResponse)
async def get_dashboard(
    force_refresh: bool = Query(False, description="Force refresh of cached data"),
    current_agent: Agent = Depends(get_current_agent),
    handoff_service: AgentHandoffService = Depends(get_handoff_service)
) -> DashboardResponse:
    """
    Get agent hand-off dashboard data.
    
    Args:
        force_refresh: Force refresh of cached data
        current_agent: Currently authenticated agent
        handoff_service: Agent hand-off service
        
    Returns:
        Dashboard data
        
    Raises:
        HTTPException: If dashboard data retrieval fails
    """
    try:
        dashboard_data = await handoff_service.get_dashboard_data(force_refresh=force_refresh)
        
        return DashboardResponse(dashboard_data=dashboard_data)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get dashboard data: {str(e)}")


@router.get("/components/status")
async def get_component_status_summary(
    current_agent: Agent = Depends(get_current_agent),
    handoff_service: AgentHandoffService = Depends(get_handoff_service)
) -> Dict[str, Any]:
    """
    Get Phase 6 component status summary across all reports.
    
    Args:
        current_agent: Currently authenticated agent
        handoff_service: Agent hand-off service
        
    Returns:
        Component status summary
        
    Raises:
        HTTPException: If status retrieval fails
    """
    try:
        # This would be implemented in the service
        # For now, return empty summary
        return {
            "component_completion_rates": {},
            "overall_progress": 0.0,
            "total_reports": 0
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get component status: {str(e)}")


@router.get("/statistics")
async def get_statistics(
    current_agent: Agent = Depends(get_current_agent),
    handoff_service: AgentHandoffService = Depends(get_handoff_service)
) -> Dict[str, Any]:
    """
    Get agent hand-off statistics.
    
    Args:
        current_agent: Currently authenticated agent
        handoff_service: Agent hand-off service
        
    Returns:
        Statistics data
        
    Raises:
        HTTPException: If statistics retrieval fails
    """
    try:
        # This would be implemented in the service
        # For now, return empty statistics
        from mcp_server.models.agent_handoff import AgentHandoffStats
        stats = AgentHandoffStats()
        
        return stats.dict()
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get statistics: {str(e)}")


@router.get("/health")
async def health_check(
    handoff_service: AgentHandoffService = Depends(get_handoff_service)
) -> Dict[str, str]:
    """
    Health check endpoint for agent hand-off service.
    
    Args:
        handoff_service: Agent hand-off service
        
    Returns:
        Health status
        
    Raises:
        HTTPException: If service is unhealthy
    """
    try:
        # Check if service is initialized
        if not hasattr(handoff_service, '_initialized') or not handoff_service._initialized:
            raise HTTPException(status_code=503, detail="Service not initialized")
        
        return {
            "status": "healthy",
            "service": "agent_handoff",
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Service unhealthy: {str(e)}")


# WebSocket event handlers for real-time updates
async def handle_report_created(report: AgentHandoffReport):
    """Handle report creation event for WebSocket broadcasting."""
    # This would integrate with WebSocket manager
    pass


async def handle_report_updated(report: AgentHandoffReport):
    """Handle report update event for WebSocket broadcasting."""
    # This would integrate with WebSocket manager
    pass


async def handle_report_submitted(report: AgentHandoffReport):
    """Handle report submission event for WebSocket broadcasting."""
    # This would integrate with WebSocket manager
    pass


async def handle_report_reviewed(report: AgentHandoffReport):
    """Handle report review event for WebSocket broadcasting."""
    # This would integrate with WebSocket manager
    pass


async def handle_report_signed_off(report: AgentHandoffReport):
    """Handle report sign-off event for WebSocket broadcasting."""
    # This would integrate with WebSocket manager
    pass


# Integration with existing services
def integrate_with_integration_manager(integration_manager):
    """
    Integrate agent hand-off service with integration manager.
    
    Args:
        integration_manager: Integration manager instance
    """
    # Register event handlers for hand-off events
    # This would integrate with the existing integration manager
    pass


def integrate_with_websocket_manager(websocket_manager):
    """
    Integrate agent hand-off service with WebSocket manager.
    
    Args:
        websocket_manager: WebSocket manager instance
    """
    # Register WebSocket event handlers
    # This would integrate with the existing WebSocket manager
    pass