"""
Agent models for MCP server.

This module defines the data models for agents in the MCP system,
following the Pixelated platform's security and data standards.
"""


import builtins
from datetime import datetime, timezone
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field, validator


class AgentStatus(str, Enum):
    """Agent status enumeration."""

    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"
    PENDING = "pending"


class AgentCapabilities(BaseModel):
    """Agent capabilities model."""

    max_concurrent_tasks: int = Field(default=1, ge=1, le=100, description="Maximum concurrent tasks")
    supported_task_types: list[str] = Field(default_factory=list, description="Supported task types")
    requires_gpu: bool = Field(default=False, description="Requires GPU resources")
    memory_limit_mb: int | None = Field(default=None, ge=128, description="Memory limit in MB")
    cpu_limit_cores: float | None = Field(default=None, gt=0, description="CPU limit in cores")
    custom_capabilities: dict[str, Any] = Field(default_factory=dict, description="Custom capability flags")


class Agent(BaseModel):
    """Agent model for MCP system."""

    id: str = Field(..., description="Unique agent identifier")
    name: str = Field(..., min_length=3, max_length=100, description="Agent name")
    email: str = Field(..., description="Agent email address")
    description: str | None = Field(default=None, max_length=500, description="Agent description")
    status: AgentStatus = Field(default=AgentStatus.PENDING, description="Agent status")
    capabilities: AgentCapabilities = Field(default_factory=AgentCapabilities, description="Agent capabilities")
    api_key: str | None = Field(default=None, description="API key (excluded from responses)")
    api_key_hash: str | None = Field(default=None, description="Hashed API key")
    webhook_url: str | None = Field(default=None, description="Webhook URL for notifications")
    last_seen: datetime | None = Field(default=None, description="Last seen timestamp")
    metadata: dict[str, Any] = Field(default_factory=dict, description="Additional metadata")
    created_at: datetime = Field(default_factory=datetime.utcnow, description="Creation timestamp")
    updated_at: datetime = Field(default_factory=datetime.utcnow, description="Last update timestamp")

    class Config:
        """Pydantic configuration."""

        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None
        }

    @validator("email")
    def validate_email(cls, v):
        """Validate email format."""
        if "@" not in v or "." not in v.split("@")[-1]:
            raise ValueError("Invalid email format")
        return v.lower()

    def dict(self, **kwargs):
        """Convert to dictionary, excluding sensitive fields."""
        # Exclude API key from dictionary output
        exclude = kwargs.get("exclude", set())
        if isinstance(exclude, set):
            exclude.add("api_key")
            exclude.add("api_key_hash")
        else:
            exclude = {"api_key", "api_key_hash"}

        kwargs["exclude"] = exclude
        return super().dict(**kwargs)

    def is_active(self) -> bool:
        """Check if agent is active."""
        return self.status == AgentStatus.ACTIVE

    def can_handle_task(self, task_type: str, required_memory_mb: int | None = None) -> bool:
        """
        Check if agent can handle a specific task.

        Args:
            task_type: Type of task to handle
            required_memory_mb: Required memory in MB

        Returns:
            True if agent can handle the task
        """
        if not self.is_active():
            return False

        # Check if task type is supported
        if self.capabilities.supported_task_types and task_type not in self.capabilities.supported_task_types:
            return False

        # Check memory requirements
        return (
            not required_memory_mb
            or not self.capabilities.memory_limit_mb
            or required_memory_mb <= self.capabilities.memory_limit_mb
        )

    def update_last_seen(self) -> None:
        """Update last seen timestamp."""
        self.last_seen = datetime.now(timezone.utc)

    def to_mongo_document(self) -> builtins.dict[str, Any]:
        """Convert to MongoDB document format."""
        data = self.dict()
        # Convert datetime to ISO format for MongoDB
        if data.get("created_at"):
            data["created_at"] = data["created_at"].isoformat()
        if data.get("updated_at"):
            data["updated_at"] = data["updated_at"].isoformat()
        if data.get("last_seen"):
            data["last_seen"] = data["last_seen"].isoformat()
        return data


class AgentRegistrationRequest(BaseModel):
    """Request model for agent registration."""

    name: str = Field(..., min_length=3, max_length=100, description="Agent name")
    email: str = Field(..., description="Agent email address")
    description: str | None = Field(default=None, max_length=500, description="Agent description")
    capabilities: AgentCapabilities | None = Field(default=None, description="Agent capabilities")
    webhook_url: str | None = Field(default=None, description="Webhook URL")
    metadata: dict[str, Any] = Field(default_factory=dict, description="Additional metadata")

    @validator("email")
    def validate_email(cls, v):
        """Validate email format."""
        if "@" not in v or "." not in v.split("@")[-1]:
            raise ValueError("Invalid email format")
        return v.lower()


class AgentAuthenticationRequest(BaseModel):
    """Request model for agent authentication."""

    agent_id: str = Field(..., description="Agent unique identifier")
    api_key: str = Field(..., description="Agent API key")


class AgentAuthenticationResponse(BaseModel):
    """Response model for agent authentication."""

    access_token: str = Field(..., description="JWT access token")
    token_type: str = Field(default="Bearer", description="Token type")
    expires_in: int = Field(..., description="Token expiration time in seconds")
    agent: Agent = Field(..., description="Authenticated agent details")


# Backwards-compatible alias: some modules expect the singular "AgentCapability"
# while this module defines "AgentCapabilities". Provide an alias to avoid
# import-time failures in tests and other modules that reference the older name.
AgentCapability = AgentCapabilities
