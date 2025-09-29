"""
MCP Server Custom Exceptions

Defines custom exception classes for the MCP server following the
established patterns from the Pixelated platform.
"""

from typing import Optional, Dict, Any


class MCPException(Exception):
    """Base exception for MCP server."""

    def __init__(
        self,
        message: str,
        error_code: str = "INTERNAL_ERROR",
        status_code: int = 500,
        details: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None
    ) -> None:
        """
        Initialize MCP exception.

        Args:
            message: Human-readable error message
            error_code: Machine-readable error code
            status_code: HTTP status code
            details: Additional error details
            headers: Additional HTTP headers
        """
        super().__init__(message)
        self.message = message
        self.error_code = error_code
        self.status_code = status_code
        self.details = details or {}
        self.headers = headers or {}


class AuthenticationError(MCPException):
    """Authentication-related exceptions."""

    def __init__(self, message: str = "Authentication failed", **kwargs: Any) -> None:
        super().__init__(
            message=message,
            error_code="AUTHENTICATION_FAILED",
            status_code=401,
            **kwargs
        )


class AuthorizationError(MCPException):
    """Authorization-related exceptions."""

    def __init__(self, message: str = "Access denied", **kwargs: Any) -> None:
        super().__init__(
            message=message,
            error_code="AUTHORIZATION_FAILED",
            status_code=403,
            **kwargs
        )


class ValidationError(MCPException):
    """Validation-related exceptions."""

    def __init__(self, message: str = "Validation failed", **kwargs: Any) -> None:
        super().__init__(
            message=message,
            error_code="VALIDATION_ERROR",
            status_code=400,
            **kwargs
        )


class IntegrationError(MCPException):
    """Errors raised by external integrations and pipeline orchestration."""

    def __init__(self, message: str = "Integration error", **kwargs: Any) -> None:
        super().__init__(
            message=message,
            error_code="INTEGRATION_ERROR",
            status_code=502,
            **kwargs
        )


class NotFoundError(MCPException):
    """Resource not found exceptions."""

    def __init__(self, message: str = "Resource not found", **kwargs: Any) -> None:
        super().__init__(
            message=message,
            error_code="NOT_FOUND",
            status_code=404,
            **kwargs
        )

# Backwards-compatible alias used across the codebase
ResourceNotFoundError = NotFoundError


class ConflictError(MCPException):
    """Resource conflict exceptions."""

    def __init__(self, message: str = "Resource conflict", **kwargs: Any) -> None:
        super().__init__(
            message=message,
            error_code="CONFLICT",
            status_code=409,
            **kwargs
        )


class RateLimitExceededError(MCPException):
    """Rate limit exceeded exceptions."""

    def __init__(
        self,
        message: str = "Rate limit exceeded",
        retry_after: Optional[int] = None,
        **kwargs: Any
    ) -> None:
        super().__init__(
            message=message,
            error_code="RATE_LIMIT_EXCEEDED",
            status_code=429,
            **kwargs
        )
        self.retry_after = retry_after


class ServiceUnavailableError(MCPException):
    """Service unavailable exceptions."""

    def __init__(self, message: str = "Service unavailable", **kwargs: Any) -> None:
        super().__init__(
            message=message,
            error_code="SERVICE_UNAVAILABLE",
            status_code=503,
            **kwargs
        )


class DatabaseError(MCPException):
    """Database-related exceptions."""

    def __init__(self, message: str = "Database error", **kwargs: Any) -> None:
        super().__init__(
            message=message,
            error_code="DATABASE_ERROR",
            status_code=500,
            **kwargs
        )


class RedisError(MCPException):
    """Redis-related exceptions."""

    def __init__(self, message: str = "Cache error", **kwargs: Any) -> None:
        super().__init__(
            message=message,
            error_code="CACHE_ERROR",
            status_code=500,
            **kwargs
        )


class AgentNotFoundError(NotFoundError):
    """Agent not found exceptions."""

    def __init__(self, agent_id: str, **kwargs: Any) -> None:
        super().__init__(
            message=f"Agent with ID '{agent_id}' not found",
            error_code="AGENT_NOT_FOUND",
            **kwargs
        )


class DuplicateAgentError(ConflictError):
    """Duplicate agent exceptions."""

    def __init__(self, agent_id: str, **kwargs: Any) -> None:
        super().__init__(
            message=f"Agent with ID '{agent_id}' already exists",
            error_code="AGENT_ALREADY_REGISTERED",
            **kwargs
        )


class TaskNotFoundError(NotFoundError):
    """Task not found exceptions."""

    def __init__(self, task_id: str, **kwargs: Any) -> None:
        super().__init__(
            message=f"Task with ID '{task_id}' not found",
            error_code="TASK_NOT_FOUND",
            **kwargs
        )


class PipelineNotFoundError(NotFoundError):
    """Pipeline not found exceptions."""

    def __init__(self, pipeline_id: str, **kwargs: Any) -> None:
        super().__init__(
            message=f"Pipeline with ID '{pipeline_id}' not found",
            error_code="PIPELINE_NOT_FOUND",
            **kwargs
        )


class TaskAssignmentError(MCPException):
    """Task assignment exceptions."""

    def __init__(self, message: str = "Task assignment failed", **kwargs: Any) -> None:
        super().__init__(
            message=message,
            error_code="TASK_ASSIGNMENT_FAILED",
            status_code=400,
            **kwargs
        )


class NoSuitableAgentError(TaskAssignmentError):
    """No suitable agent available exceptions."""

    def __init__(self, message: str = "No suitable agents available", **kwargs: Any) -> None:
        super().__init__(
            message=message,
            error_code="NO_SUITABLE_AGENT",
            **kwargs
        )


class TaskCompletionError(MCPException):
    """Task completion exceptions."""

    def __init__(self, message: str = "Task completion failed", **kwargs: Any) -> None:
        super().__init__(
            message=message,
            error_code="TASK_COMPLETION_FAILED",
            status_code=400,
            **kwargs
        )


class InvalidStatusTransitionError(MCPException):
    """Invalid status transition exceptions."""

    def __init__(self, message: str = "Invalid status transition", **kwargs: Any) -> None:
        super().__init__(
            message=message,
            error_code="INVALID_STATUS_TRANSITION",
            status_code=400,
            **kwargs
        )


class UnauthorizedStatusUpdateError(AuthorizationError):
    """Unauthorized status update exceptions."""

    def __init__(self, message: str = "Unauthorized status update", **kwargs: Any) -> None:
        super().__init__(
            message=message,
            error_code="UNAUTHORIZED_STATUS_UPDATE",
            **kwargs
        )


class ConfigurationError(MCPException):
    """Configuration-related exceptions."""

    def __init__(self, message: str = "Configuration error", **kwargs: Any) -> None:
        super().__init__(
            message=message,
            error_code="CONFIGURATION_ERROR",
            status_code=500,
            **kwargs
        )


class ExternalServiceError(MCPException):
    """External service exceptions."""

    def __init__(self, message: str = "External service error", **kwargs: Any) -> None:
        super().__init__(
            message=message,
            error_code="EXTERNAL_SERVICE_ERROR",
            status_code=503,
            **kwargs
        )


class QueueOperationError(MCPException):
    """Queue operation exceptions."""

    def __init__(self, message: str = "Queue operation failed", **kwargs: Any) -> None:
        super().__init__(
            message=message,
            error_code="QUEUE_OPERATION_FAILED",
            status_code=500,
            **kwargs
        )


class EndpointValidationError(ValidationError):
    """Endpoint validation exceptions."""

    def __init__(self, message: str = "Endpoint validation failed", **kwargs: Any) -> None:
        super().__init__(
            message=message,
            error_code="ENDPOINT_VALIDATION_FAILED",
            **kwargs
        )


class TokenExpiredError(AuthenticationError):
    """Token expired exceptions."""

    def __init__(self, message: str = "Token has expired", **kwargs: Any) -> None:
        super().__init__(
            message=message,
            error_code="TOKEN_EXPIRED",
            **kwargs
        )


class InvalidTokenError(AuthenticationError):
    """Invalid token exceptions."""

    def __init__(self, message: str = "Invalid token", **kwargs: Any) -> None:
        super().__init__(
            message=message,
            error_code="INVALID_TOKEN",
            **kwargs
        )


class DuplicateTaskError(ConflictError):
    """Duplicate task exceptions."""

    def __init__(self, task_id: str, **kwargs: Any) -> None:
        super().__init__(
            message=f"Task with ID '{task_id}' already exists",
            error_code="TASK_ALREADY_EXISTS",
            **kwargs
        )


class InsufficientPermissionsError(AuthorizationError):
    """Insufficient permissions exceptions."""

    def __init__(self, message: str = "Insufficient permissions", **kwargs: Any) -> None:
        super().__init__(
            message=message,
            error_code="INSUFFICIENT_PERMISSIONS",
            **kwargs
        )


class AgentCapabilityError(MCPException):
    """Agent capability exceptions."""

    def __init__(self, message: str = "Agent capability error", **kwargs: Any) -> None:
        super().__init__(
            message=message,
            error_code="AGENT_CAPABILITY_ERROR",
            status_code=400,
            **kwargs
        )


class TaskTimeoutError(MCPException):
    """Task timeout exceptions."""

    def __init__(self, message: str = "Task execution timeout", **kwargs: Any) -> None:
        super().__init__(
            message=message,
            error_code="TASK_TIMEOUT",
            status_code=408,
            **kwargs
        )


class CircuitBreakerOpenError(ServiceUnavailableError):
    """Circuit breaker open exceptions."""

    def __init__(self, message: str = "Circuit breaker is open", **kwargs: Any) -> None:
        super().__init__(
            message=message,
            error_code="CIRCUIT_BREAKER_OPEN",
            **kwargs
        )
