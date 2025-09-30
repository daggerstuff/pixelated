"""
Authentication service for MCP server agent registration and management.

This service handles agent authentication, registration, and token management
following the Pixelated platform's security standards and HIPAA compliance requirements.
"""

import uuid
import hashlib
import secrets
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from pydantic import BaseModel, EmailStr, Field, validator
from motor.motor_asyncio import AsyncIOMotorDatabase
from redis.asyncio import Redis
import jwt
import structlog

from mcp_server.config import settings
from mcp_server.exceptions import (
    AuthenticationError,
    AuthorizationError,
    ValidationError,
    ResourceNotFoundError,
    ConflictError
)
from mcp_server.models.agent import Agent, AgentStatus, AgentCapabilities
from mcp_server.utils.security import hash_password, verify_password, generate_secure_token
from .token_manager import TokenManager, get_token_manager


logger = structlog.get_logger(__name__)


class AgentRegistrationRequest(BaseModel):
    """Request model for agent registration."""

    name: str = Field(..., min_length=3, max_length=100, description="Agent display name")
    email: EmailStr = Field(..., description="Agent contact email")
    description: Optional[str] = Field(None, max_length=500, description="Agent description")
    capabilities: AgentCapabilities = Field(..., description="Agent capabilities and specializations")
    max_concurrent_tasks: int = Field(1, ge=1, le=100, description="Maximum concurrent tasks")
    webhook_url: Optional[str] = Field(None, description="Webhook URL for notifications")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Additional metadata")

    @validator('webhook_url')
    def validate_webhook_url(cls, v):
        """Validate webhook URL format."""
        if v and not v.startswith(('http://', 'https://')):
            raise ValueError('Webhook URL must start with http:// or https://')
        return v


class AgentAuthenticationRequest(BaseModel):
    """Request model for agent authentication."""

    agent_id: str = Field(..., description="Agent unique identifier")
    api_key: str = Field(..., min_length=32, description="Agent API key")


class AgentAuthenticationResponse(BaseModel):
    """Response model for agent authentication."""

    access_token: str = Field(..., description="JWT access token")
    token_type: str = Field("Bearer", description="Token type")
    expires_in: int = Field(..., description="Token expiration time in seconds")
    agent: Agent = Field(..., description="Authenticated agent details")


class AuthService:
    """Service for handling agent authentication and registration."""

    def __init__(self, db: AsyncIOMotorDatabase, redis: Redis):
        """
        Initialize authentication service.

        Args:
            db: MongoDB database instance
            redis: Redis client instance
        """
        self.db = db
        self.redis = redis
        self.agents_collection = db.agents
        self.tokens_collection = db.tokens
        self.token_manager = TokenManager(redis)
        logger.info("AuthService initialized")

    async def register_agent(self, registration: AgentRegistrationRequest) -> Agent:
        """
        Register a new agent in the system.

        Args:
            registration: Agent registration request

        Returns:
            Registered agent details

        Raises:
            ConflictError: If agent with same email already exists
            ValidationError: If registration data is invalid
        """
        logger.info("Registering new agent", name=registration.name, email=registration.email)

        # Check if agent with same email already exists
        existing_agent = await self.agents_collection.find_one({"email": registration.email})
        if existing_agent:
            logger.warning("Agent registration failed - email already exists", email=registration.email)
            raise ConflictError("Agent with this email already exists")

        # Generate unique agent ID and API key
        agent_id = str(uuid.uuid4())
        api_key = generate_secure_token(64)
        api_key_hash = hash_password(api_key)

        # Create agent document
        agent_data = {
            "id": agent_id,
            "name": registration.name,
            "email": registration.email,
            "description": registration.description,
            "capabilities": registration.capabilities.dict(),
            "status": AgentStatus.INACTIVE,
            "max_concurrent_tasks": registration.max_concurrent_tasks,
            "current_tasks": 0,
            "webhook_url": registration.webhook_url,
            "metadata": registration.metadata,
            "api_key_hash": api_key_hash,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "last_seen": None
        }

        try:
            # Insert agent into database
            await self.agents_collection.insert_one(agent_data)

            # Create agent model (excluding API key hash)
            agent_dict = {k: v for k, v in agent_data.items() if k != "api_key_hash"}
            agent = Agent(**agent_dict)

            logger.info("Agent registered successfully", agent_id=agent_id, name=registration.name)

            # Store API key in Redis for quick validation (with expiration)
            await self.redis.setex(
                f"agent_api_key:{agent_id}",
                86400 * 30,  # 30 days
                api_key_hash
            )

            # Return agent with API key (only shown once)
            agent_with_key = agent.copy()
            agent_with_key.api_key = api_key

            return agent_with_key

        except Exception as e:
            logger.error("Agent registration failed", error=str(e), email=registration.email)
            raise ValidationError(f"Failed to register agent: {str(e)}")

    async def authenticate_agent(self, agent_id: str, api_key: str) -> AgentAuthenticationResponse:
        """
        Authenticate an agent using API key.

        Args:
            agent_id: Agent unique identifier
            api_key: Agent API key

        Returns:
            Authentication response with JWT token

        Raises:
            AuthenticationError: If authentication fails
            ResourceNotFoundError: If agent not found
        """
        logger.info("Authenticating agent", agent_id=agent_id)

        # Retrieve agent from database
        agent_data = await self.agents_collection.find_one({"id": agent_id})
        if not agent_data:
            logger.warning("Authentication failed - agent not found", agent_id=agent_id)
            raise ResourceNotFoundError("Agent not found")

        # Verify API key
        if not verify_password(api_key, agent_data["api_key_hash"]):
            logger.warning("Authentication failed - invalid API key", agent_id=agent_id)
            raise AuthenticationError("Invalid API key")

        # Check if agent is active
        if agent_data["status"] != AgentStatus.ACTIVE:
            logger.warning("Authentication failed - agent not active", agent_id=agent_id, status=agent_data["status"])
            raise AuthenticationError("Agent is not active")

        # Create agent model
        agent_dict = {k: v for k, v in agent_data.items() if k != "api_key_hash"}
        agent = Agent(**agent_dict)

        # Generate JWT token
        token_data = {
            "sub": agent_id,
            "type": "agent",
            "iat": datetime.utcnow(),
            "exp": datetime.utcnow() + timedelta(seconds=settings.auth.jwt_expiration_seconds)
        }

        access_token = jwt.encode(token_data, settings.auth.jwt_secret, algorithm="HS256")

        # Update last seen timestamp
        await self.agents_collection.update_one(
            {"id": agent_id},
            {"$set": {"last_seen": datetime.utcnow()}}
        )

        logger.info("Agent authenticated successfully", agent_id=agent_id)

        return AgentAuthenticationResponse(
            access_token=access_token,
            expires_in=settings.auth.jwt_expiration_seconds,
            agent=agent
        )

    async def validate_token(self, token: str) -> Dict[str, Any]:
        """
        Validate JWT token and return token data.

        Args:
            token: JWT access token

        Returns:
            Token payload data

        Raises:
            AuthenticationError: If token is invalid, expired, or blacklisted
        """
        try:
            # First check if token is blacklisted
            if await self.token_manager.is_token_blacklisted(token):
                raise AuthenticationError("Token has been revoked")

            payload = jwt.decode(token, settings.auth.jwt_secret, algorithms=["HS256"])

            # Verify token type
            if payload.get("type") != "agent":
                raise AuthenticationError("Invalid token type")

            # Check if agent still exists and is active
            agent_data = await self.agents_collection.find_one({"id": payload["sub"]})
            if not agent_data:
                raise AuthenticationError("Agent not found")

            if agent_data["status"] != AgentStatus.ACTIVE:
                raise AuthenticationError("Agent is not active")

            return payload

        except jwt.ExpiredSignatureError:
            raise AuthenticationError("Token has expired")
        except jwt.InvalidTokenError:
            raise AuthenticationError("Invalid token")

    async def revoke_agent_tokens(self, agent_id: str) -> None:
        """
        Revoke all tokens for an agent.

        Args:
            agent_id: Agent unique identifier
        """
        logger.info("Revoking tokens for agent", agent_id=agent_id)

        # Remove API key from Redis
        await self.redis.delete(f"agent_api_key:{agent_id}")

        # Revoke all JWT tokens associated with the agent
        await self.token_manager.revoke_all_agent_tokens(agent_id)

    async def update_agent_status(self, agent_id: str, status: AgentStatus) -> Agent:
        """
        Update agent status.

        Args:
            agent_id: Agent unique identifier
            status: New agent status

        Returns:
            Updated agent details

        Raises:
            ResourceNotFoundError: If agent not found
        """
        logger.info("Updating agent status", agent_id=agent_id, status=status)

        # Update agent status
        result = await self.agents_collection.update_one(
            {"id": agent_id},
            {
                "$set": {
                    "status": status,
                    "updated_at": datetime.utcnow()
                }
            }
        )

        if result.matched_count == 0:
            raise ResourceNotFoundError("Agent not found")

        # Retrieve updated agent
        agent_data = await self.agents_collection.find_one({"id": agent_id})
        agent_dict = {k: v for k, v in agent_data.items() if k != "api_key_hash"}

        return Agent(**agent_dict)

    async def get_agent_by_id(self, agent_id: str) -> Optional[Agent]:
        """
        Retrieve agent by ID.

        Args:
            agent_id: Agent unique identifier

        Returns:
            Agent details or None if not found
        """
        agent_data = await self.agents_collection.find_one({"id": agent_id})
        if not agent_data:
            return None

        agent_dict = {k: v for k, v in agent_data.items() if k != "api_key_hash"}
        return Agent(**agent_dict)

    async def regenerate_api_key(self, agent_id: str) -> str:
        """
        Regenerate API key for an agent.

        Args:
            agent_id: Agent unique identifier

        Returns:
            New API key

        Raises:
            ResourceNotFoundError: If agent not found
        """
        logger.info("Regenerating API key for agent", agent_id=agent_id)

        # Generate new API key
        new_api_key = generate_secure_token(64)
        api_key_hash = hash_password(new_api_key)

        # Update agent with new API key hash
        result = await self.agents_collection.update_one(
            {"id": agent_id},
            {
                "$set": {
                    "api_key_hash": api_key_hash,
                    "updated_at": datetime.utcnow()
                }
            }
        )

        if result.matched_count == 0:
            raise ResourceNotFoundError("Agent not found")

        # Update Redis cache
        await self.redis.setex(
            f"agent_api_key:{agent_id}",
            86400 * 30,  # 30 days
            api_key_hash
        )

        logger.info("API key regenerated successfully", agent_id=agent_id)
        return new_api_key


# Global auth service instance
_auth_service: Optional[AuthService] = None


async def get_auth_service() -> AuthService:
    """
    Get the global auth service instance.

    Returns:
        AuthService instance

    Raises:
        RuntimeError: If service not initialized
    """
    if _auth_service is None:
        raise RuntimeError("AuthService not initialized")
    return _auth_service


def init_auth_service(db: AsyncIOMotorDatabase, redis: Redis) -> AuthService:
    """
    Initialize the global auth service.

    Args:
        db: MongoDB database instance
        redis: Redis client instance

    Returns:
        AuthService instance
    """
    global _auth_service
    _auth_service = AuthService(db, redis)
    return _auth_service
