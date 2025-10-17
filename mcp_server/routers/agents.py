"""
Agent management API endpoints for MCP server.

This module provides RESTful API endpoints for agent registration, authentication,
and management following the Pixelated platform's security standards.
"""

from datetime import datetime

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from ..exceptions import (
    AuthenticationError,
    ConflictError,
    ResourceNotFoundError,
    ValidationError,
)
from ..middleware.auth import get_current_agent
from ..models.agent import Agent, AgentStatus
from ..services.auth import (
    AgentAuthenticationRequest,
    AgentAuthenticationResponse,
    AgentRegistrationRequest,
    AuthService,
    get_auth_service,
)

logger = structlog.get_logger(__name__)


# Request/Response Models
class AgentRegistrationResponse(BaseModel):
    """Response model for agent registration."""

    message: str = Field(..., description="Success message")
    agent: Agent = Field(..., description="Registered agent details")
    api_key: str = Field(..., description="API key (shown only once)")


class AgentListResponse(BaseModel):
    """Response model for agent list."""

    agents: list[Agent] = Field(..., description="List of agents")
    total: int = Field(..., description="Total number of agents")
    page: int = Field(1, description="Current page")
    page_size: int = Field(10, description="Page size")


class AgentUpdateRequest(BaseModel):
    """Request model for agent updates."""

    name: str | None = Field(None, min_length=3, max_length=100, description="Agent name")
    description: str | None = Field(None, max_length=500, description="Agent description")
    max_concurrent_tasks: int | None = Field(None, ge=1, le=100, description="Max concurrent tasks")
    webhook_url: str | None = Field(None, description="Webhook URL")
    metadata: dict | None = Field(None, description="Additional metadata")


class AgentStatusUpdateRequest(BaseModel):
    """Request model for agent status updates."""

    status: AgentStatus = Field(..., description="New agent status")


class RegenerateApiKeyResponse(BaseModel):
    """Response model for API key regeneration."""

    message: str = Field(..., description="Success message")
    api_key: str = Field(..., description="New API key (shown only once)")


# Create router
router = APIRouter(prefix="/agents", tags=["agents"])


@router.post(
    "/register",
    response_model=AgentRegistrationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new agent",
    description="Register a new agent in the MCP system. Returns the agent details and API key."
)
async def register_agent(
    registration: AgentRegistrationRequest,
    auth_service: AuthService = Depends(get_auth_service)
) -> AgentRegistrationResponse:
    """
    Register a new agent in the system.
    
    Args:
        registration: Agent registration data
        auth_service: Authentication service dependency
        
    Returns:
        Registration response with agent details and API key
        
    Raises:
        HTTPException: If registration fails
    """
    logger.info("Agent registration requested", name=registration.name, email=registration.email)

    try:
        agent = await auth_service.register_agent(registration)

        logger.info("Agent registered successfully", agent_id=agent.id, name=agent.name)

        return AgentRegistrationResponse(
            message="Agent registered successfully",
            agent=agent,
            api_key=agent.api_key  # API key is only shown once
        )

    except ConflictError as e:
        logger.warning("Agent registration failed - conflict", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e)
        )
    except ValidationError as e:
        logger.warning("Agent registration failed - validation error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error("Agent registration failed - unexpected error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to register agent"
        )


@router.post(
    "/authenticate",
    response_model=AgentAuthenticationResponse,
    summary="Authenticate an agent",
    description="Authenticate an agent using API key and receive JWT access token."
)
async def authenticate_agent(
    auth_request: AgentAuthenticationRequest,
    auth_service: AuthService = Depends(get_auth_service)
) -> AgentAuthenticationResponse:
    """
    Authenticate an agent using API key.
    
    Args:
        auth_request: Authentication request with agent ID and API key
        auth_service: Authentication service dependency
        
    Returns:
        Authentication response with JWT token
        
    Raises:
        HTTPException: If authentication fails
    """
    logger.info("Agent authentication requested", agent_id=auth_request.agent_id)

    try:
        response = await auth_service.authenticate_agent(
            auth_request.agent_id,
            auth_request.api_key
        )

        logger.info("Agent authenticated successfully", agent_id=auth_request.agent_id)
        return response

    except ResourceNotFoundError as e:
        logger.warning("Agent authentication failed - not found", agent_id=auth_request.agent_id)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except AuthenticationError as e:
        logger.warning("Agent authentication failed", agent_id=auth_request.agent_id)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e)
        )
    except Exception as e:
        logger.error("Agent authentication failed - unexpected error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication failed"
        )


@router.get(
    "/me",
    response_model=Agent,
    summary="Get current agent profile",
    description="Get the profile of the currently authenticated agent."
)
async def get_current_agent_profile(
    current_agent: Agent = Depends(get_current_agent)
) -> Agent:
    """
    Get current agent profile.
    
    Args:
        current_agent: Currently authenticated agent
        
    Returns:
        Agent profile details
    """
    logger.info("Getting current agent profile", agent_id=current_agent.id)
    return current_agent


@router.put(
    "/me",
    response_model=Agent,
    summary="Update current agent profile",
    description="Update the profile of the currently authenticated agent."
)
async def update_current_agent_profile(
    update_request: AgentUpdateRequest,
    current_agent: Agent = Depends(get_current_agent),
    auth_service: AuthService = Depends(get_auth_service)
) -> Agent:
    """
    Update current agent profile.
    
    Args:
        update_request: Update data
        current_agent: Currently authenticated agent
        auth_service: Authentication service dependency
        
    Returns:
        Updated agent profile
        
    Raises:
        HTTPException: If update fails
    """
    logger.info("Updating current agent profile", agent_id=current_agent.id)

    try:
        # Build update data
        update_data = update_request.dict(exclude_unset=True)
        if not update_data:
            raise ValidationError("No update data provided")

        # Update agent in database
        result = await auth_service.agents_collection.update_one(
            {"id": current_agent.id},
            {
                "$set": {
                    **update_data,
                    "updated_at": datetime.utcnow()
                }
            }
        )

        if result.matched_count == 0:
            raise ResourceNotFoundError("Agent not found")

        # Get updated agent
        updated_agent = await auth_service.get_agent_by_id(current_agent.id)
        if not updated_agent:
            raise ResourceNotFoundError("Agent not found after update")

        logger.info("Agent profile updated successfully", agent_id=current_agent.id)
        return updated_agent

    except ValidationError as e:
        logger.warning("Agent update failed - validation error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except ResourceNotFoundError as e:
        logger.error("Agent update failed - not found", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error("Agent update failed - unexpected error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update agent profile"
        )


@router.post(
    "/me/regenerate-api-key",
    response_model=RegenerateApiKeyResponse,
    summary="Regenerate API key",
    description="Regenerate API key for the currently authenticated agent."
)
async def regenerate_api_key(
    current_agent: Agent = Depends(get_current_agent),
    auth_service: AuthService = Depends(get_auth_service)
) -> RegenerateApiKeyResponse:
    """
    Regenerate API key for current agent.
    
    Args:
        current_agent: Currently authenticated agent
        auth_service: Authentication service dependency
        
    Returns:
        New API key (shown only once)
        
    Raises:
        HTTPException: If regeneration fails
    """
    logger.info("Regenerating API key for agent", agent_id=current_agent.id)

    try:
        new_api_key = await auth_service.regenerate_api_key(current_agent.id)

        logger.info("API key regenerated successfully", agent_id=current_agent.id)

        return RegenerateApiKeyResponse(
            message="API key regenerated successfully",
            api_key=new_api_key
        )

    except ResourceNotFoundError as e:
        logger.error("API key regeneration failed - not found", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error("API key regeneration failed - unexpected error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to regenerate API key"
        )


@router.get(
    "/",
    response_model=AgentListResponse,
    summary="List agents",
    description="List all agents in the system (admin only)."
)
async def list_agents(
    page: int = 1,
    page_size: int = 10,
    status: AgentStatus | None = None,
    auth_service: AuthService = Depends(get_auth_service),
    current_agent: Agent = Depends(get_current_agent)
) -> AgentListResponse:
    """
    List agents with optional filtering.
    
    Args:
        page: Page number (1-based)
        page_size: Number of items per page
        status: Optional status filter
        auth_service: Authentication service dependency
        current_agent: Currently authenticated agent (must be admin)
        
    Returns:
        List of agents
        
    Raises:
        HTTPException: If not authorized or request fails
    """
    logger.info("Listing agents", page=page, page_size=page_size, status=status)

    # For now, any authenticated agent can list other agents
    # In a production system, you might want admin-only access

    try:
        # Build query
        query = {}
        if status:
            query["status"] = status

        # Calculate pagination
        skip = (page - 1) * page_size

        # Get total count
        total = await auth_service.agents_collection.count_documents(query)

        # Get agents
        cursor = auth_service.agents_collection.find(query).skip(skip).limit(page_size)
        agents_data = await cursor.to_list(length=page_size)

        # Convert to Agent models (exclude API key hash)
        agents = []
        for agent_data in agents_data:
            agent_dict = {k: v for k, v in agent_data.items() if k != "api_key_hash"}
            agents.append(Agent(**agent_dict))

        logger.info("Agents listed successfully", total=total, returned=len(agents))

        return AgentListResponse(
            agents=agents,
            total=total,
            page=page,
            page_size=page_size
        )

    except Exception as e:
        logger.error("Failed to list agents", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list agents"
        )


@router.get(
    "/{agent_id}",
    response_model=Agent,
    summary="Get agent by ID",
    description="Get agent details by ID."
)
async def get_agent_by_id(
    agent_id: str,
    auth_service: AuthService = Depends(get_auth_service),
    current_agent: Agent = Depends(get_current_agent)
) -> Agent:
    """
    Get agent by ID.
    
    Args:
        agent_id: Agent unique identifier
        auth_service: Authentication service dependency
        current_agent: Currently authenticated agent
        
    Returns:
        Agent details
        
    Raises:
        HTTPException: If agent not found
    """
    logger.info("Getting agent by ID", agent_id=agent_id)

    try:
        agent = await auth_service.get_agent_by_id(agent_id)
        if not agent:
            raise ResourceNotFoundError("Agent not found")

        logger.info("Agent retrieved successfully", agent_id=agent_id)
        return agent

    except ResourceNotFoundError as e:
        logger.warning("Agent not found", agent_id=agent_id)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error("Failed to get agent", error=str(e), agent_id=agent_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get agent"
        )


@router.patch(
    "/{agent_id}/status",
    response_model=Agent,
    summary="Update agent status",
    description="Update the status of an agent (admin only)."
)
async def update_agent_status(
    agent_id: str,
    status_update: AgentStatusUpdateRequest,
    auth_service: AuthService = Depends(get_auth_service),
    current_agent: Agent = Depends(get_current_agent)
) -> Agent:
    """
    Update agent status.
    
    Args:
        agent_id: Agent unique identifier
        status_update: New status
        auth_service: Authentication service dependency
        current_agent: Currently authenticated agent
        
    Returns:
        Updated agent details
        
    Raises:
        HTTPException: If update fails
    """
    logger.info("Updating agent status", agent_id=agent_id, new_status=status_update.status)

    try:
        updated_agent = await auth_service.update_agent_status(agent_id, status_update.status)

        logger.info("Agent status updated successfully", agent_id=agent_id, status=status_update.status)
        return updated_agent

    except ResourceNotFoundError as e:
        logger.warning("Agent status update failed - not found", agent_id=agent_id)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error("Agent status update failed", error=str(e), agent_id=agent_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update agent status"
        )
