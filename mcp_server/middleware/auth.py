"""
Authentication middleware for MCP server.

This middleware handles JWT token validation and agent authentication
following the Pixelated platform's security standards.
"""

from typing import Optional, Dict, Any
from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import structlog

from mcp_server.services.auth import AuthService, get_auth_service
from mcp_server.models.agent import Agent
from mcp_server.exceptions import AuthenticationError, AuthorizationError


logger = structlog.get_logger(__name__)


# Security scheme for JWT tokens
security = HTTPBearer()


async def get_current_agent(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    auth_service: AuthService = Depends(get_auth_service)
) -> Agent:
    """
    Get the currently authenticated agent from JWT token.

    Args:
        credentials: HTTP authorization credentials
        auth_service: Authentication service

    Returns:
        Authenticated agent

    Raises:
        HTTPException: If authentication fails
    """
    logger.debug("Validating authentication token")

    if not credentials or not credentials.credentials:
        logger.warning("Missing authentication token")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials

    try:
        # Validate the JWT token
        token_data = await auth_service.validate_token(token)
        agent_id = token_data.get("sub")

        if not agent_id:
            logger.warning("Invalid token - missing subject")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Get agent details
        agent = await auth_service.get_agent_by_id(agent_id)
        if not agent:
            logger.warning("Agent not found for token", agent_id=agent_id)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Agent not found",
                headers={"WWW-Authenticate": "Bearer"},
            )

        logger.debug("Agent authenticated successfully", agent_id=agent_id)
        return agent

    except AuthenticationError as e:
        logger.warning("Authentication failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as e:
        logger.error("Unexpected authentication error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication service error",
            headers={"WWW-Authenticate": "Bearer"},
        ) from e


async def get_optional_current_agent(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    auth_service: AuthService = Depends(get_auth_service)
) -> Optional[Agent]:
    """
    Get the currently authenticated agent from JWT token (optional).

    Args:
        credentials: HTTP authorization credentials (optional)
        auth_service: Authentication service

    Returns:
        Authenticated agent or None if not authenticated
    """
    if not credentials or not credentials.credentials:
        return None

    try:
        return await get_current_agent(credentials, auth_service)
    except HTTPException:
        return None


async def require_active_agent(current_agent: Agent = Depends(get_current_agent)) -> Agent:
    """
    Require an active agent for the operation.

    Args:
        current_agent: Currently authenticated agent

    Returns:
        Active agent

    Raises:
        HTTPException: If agent is not active
    """
    from ..models.agent import AgentStatus

    if current_agent.status != AgentStatus.ACTIVE:
        logger.warning("Inactive agent attempted operation", agent_id=current_agent.id, status=current_agent.status)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Agent is not active"
        )

    return current_agent


async def require_admin_agent(current_agent: Agent = Depends(get_current_agent)) -> Agent:
    """
    Require an admin agent for the operation.

    Args:
        current_agent: Currently authenticated agent

    Returns:
        Admin agent

    Raises:
        HTTPException: If agent is not an admin
    """
    # For now, we'll implement a simple admin check
    # In a production system, you might have a more sophisticated role-based system

    # Check if agent has admin capabilities or special flag
    if not (hasattr(current_agent, 'is_admin') and current_agent.is_admin):
        logger.warning("Non-admin agent attempted admin operation", agent_id=current_agent.id)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required"
        )

    return current_agent


async def get_current_user(current_agent: Optional[Agent] = Depends(get_optional_current_agent)) -> Dict[str, Any]:
    """
    Backwards-compatible dependency used by routers that expect a simple
    user dictionary rather than the full Agent model.

    Returns a dict with keys: user_id, role, agent_id. Raises 401 if no
    authenticated agent is available.
    """
    if not current_agent:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return {
        "user_id": getattr(current_agent, "id", None),
        "agent_id": getattr(current_agent, "id", None),
        "role": "admin" if getattr(current_agent, "is_admin", False) else "user",
    }


class AuthMiddleware:
    """
    Authentication middleware for validating JWT tokens.
    """

    def __init__(self, auth_service: AuthService):
        """
        Initialize authentication middleware.

        Args:
            auth_service: Authentication service instance
        """
        self.auth_service = auth_service

    async def __call__(self, request) -> Optional[Agent]:
        """
        Validate authentication for incoming request.

        Args:
            request: FastAPI request object

        Returns:
            Authenticated agent or None
        """
        # Extract authorization header
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return None

        token = auth_header.replace("Bearer ", "")

        try:
            # Validate token
            token_data = await self.auth_service.validate_token(token)
            if agent_id := token_data.get("sub"):
                # Get agent details
                return await self.auth_service.get_agent_by_id(agent_id)

            else:
                return None

        except AuthenticationError:
            return None
        except Exception as e:
            logger.error("Authentication middleware error", error=str(e))
            return None


def create_auth_dependency(require_active: bool = False, require_admin: bool = False):
    """
    Create a custom authentication dependency with specific requirements.

    Args:
        require_active: Whether to require active agent status
        require_admin: Whether to require admin privileges

    Returns:
        Authentication dependency function
    """
    async def auth_dependency(
        current_agent: Agent = Depends(get_current_agent)
    ) -> Agent:
        """
        Custom authentication dependency.

        Args:
            current_agent: Currently authenticated agent

        Returns:
            Agent meeting requirements

        Raises:
            HTTPException: If requirements not met
        """
        if require_active:
            current_agent = await require_active_agent(current_agent)

        if require_admin:
            current_agent = await require_admin_agent(current_agent)

        return current_agent

    return auth_dependency


# Pre-configured auth dependencies
require_auth = create_auth_dependency()
require_active_auth = create_auth_dependency(require_active=True)


# Backwards-compatible alias expected by some modules
AuthenticationMiddleware = AuthMiddleware
require_admin_auth = create_auth_dependency(require_admin=True)
require_active_admin_auth = create_auth_dependency(require_active=True, require_admin=True)


async def validate_api_key(
    api_key: str,
    agent_id: str,
    auth_service: AuthService
) -> bool:
    """
    Validate API key for an agent.

    Args:
        api_key: API key to validate
        agent_id: Agent ID
        auth_service: Authentication service

    Returns:
        True if API key is valid, False otherwise
    """
    try:
        # This would typically involve checking against stored hash
        # For now, we'll use the auth service method and return whether
        # the agent exists. Real API key verification should check a hash.
        return bool(await auth_service.get_agent_by_id(agent_id))
    except Exception as e:
        logger.error("API key validation error", error=str(e))
        return False


class RateLimitMiddleware:
    """
    Rate limiting middleware for API endpoints.
    """

    def __init__(self, redis_client, limit: int = 100, window: int = 60):
        """
        Initialize rate limiting middleware.

        Args:
            redis_client: Redis client for rate limit storage
            limit: Maximum number of requests per window
            window: Time window in seconds
        """
        self.redis = redis_client
        self.limit = limit
        self.window = window

    async def is_rate_limited(self, identifier: str) -> bool:
        """
        Check if identifier is rate limited.

        Args:
            identifier: Unique identifier (e.g., IP address, agent ID)

        Returns:
            True if rate limited, False otherwise
        """
        key = f"rate_limit:{identifier}"

        try:
            current = await self.redis.incr(key)
            if current == 1:
                # Set expiration on first request
                await self.redis.expire(key, self.window)

            return current > self.limit

        except Exception as e:
            logger.error("Rate limiting check failed", error=str(e))
            # Fail open - don't block requests if Redis is down
            return False

    async def get_remaining_requests(self, identifier: str) -> int:
        """
        Get remaining requests for identifier.

        Args:
            identifier: Unique identifier

        Returns:
            Number of remaining requests
        """
        key = f"rate_limit:{identifier}"

        try:
            current = await self.redis.get(key)
            if current is None:
                return self.limit

            current_int = int(current)
            return max(0, self.limit - current_int)

        except Exception as e:
            logger.error("Failed to get remaining requests", error=str(e))
            return self.limit


# Export commonly used dependencies
__all__ = [
    "get_current_agent",
    "get_optional_current_agent",
    "require_active_agent",
    "require_admin_agent",
    "require_auth",
    "require_active_auth",
    "require_admin_auth",
    "require_active_admin_auth",
    "AuthMiddleware",
    "RateLimitMiddleware",
    "validate_api_key",
    "create_auth_dependency"
]
