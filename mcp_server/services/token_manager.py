"""
Token management service for MCP server.

This module provides token blacklisting and revocation functionality
for the MCP server following security best practices.
"""

import time

import jwt
import structlog
from redis.asyncio import Redis

from mcp_server.config import settings
from mcp_server.exceptions import AuthenticationError

logger = structlog.get_logger(__name__)


class TokenManager:
    """Service for managing JWT token lifecycle including revocation."""

    def __init__(self, redis: Redis):
        """
        Initialize token manager.

        Args:
            redis: Redis client instance
        """
        self.redis = redis
        self.token_blacklist_prefix = "token_blacklist:"
        self.agent_token_prefix = "agent_tokens:"
        logger.info("TokenManager initialized")

    async def blacklist_token(self, token: str, agent_id: str, expiration: int | None = None) -> None:
        """
        Add a token to the blacklist.

        Args:
            token: JWT token to blacklist
            agent_id: Agent ID associated with the token
            expiration: Optional expiration time in seconds (defaults to token expiration)
        """
        try:
            # Decode token to get expiration time if not provided
            if expiration is None:
                decoded = jwt.decode(
                    token,
                    settings.auth.jwt_secret,
                    algorithms=["HS256"],
                    options={"verify_signature": False}
                )
                exp = decoded.get("exp")
                if exp:
                    # Calculate remaining time until expiration
                    remaining_time = exp - int(time.time())
                    expiration = max(remaining_time, 3600)  # At least 1 hour if calculated time is negative
                else:
                    # Default to 24 hours if no exp claim found
                    expiration = 86400

            # Blacklist the token
            token_key = f"{self.token_blacklist_prefix}{token}"
            await self.redis.setex(token_key, expiration, "blacklisted")

            # Also track tokens by agent for bulk revocation
            agent_token_key = f"{self.agent_token_prefix}{agent_id}"
            await self.redis.sadd(agent_token_key, token)
            await self.redis.expire(agent_token_key, expiration)

            logger.info("Token blacklisted", agent_id=agent_id, token_jti=token[:16] + "...")

        except jwt.InvalidTokenError:
            logger.warning("Invalid token provided for blacklisting", agent_id=agent_id)
            raise AuthenticationError("Invalid token")
        except Exception as e:
            logger.error("Failed to blacklist token", agent_id=agent_id, error=str(e))
            raise

    async def is_token_blacklisted(self, token: str) -> bool:
        """
        Check if a token is blacklisted.

        Args:
            token: JWT token to check

        Returns:
            True if token is blacklisted, False otherwise
        """
        token_key = f"{self.token_blacklist_prefix}{token}"
        return await self.redis.exists(token_key) > 0

    async def revoke_all_agent_tokens(self, agent_id: str) -> None:
        """
        Revoke all tokens for a specific agent.

        Args:
            agent_id: Agent ID whose tokens should be revoked
        """
        agent_token_key = f"{self.agent_token_prefix}{agent_id}"

        # Get all tokens associated with this agent
        tokens = await self.redis.smembers(agent_token_key)

        if tokens:
            # Blacklist each token with a 24-hour expiration
            for token in tokens:
                token = token.decode("utf-8")  # Redis returns bytes
                token_key = f"{self.token_blacklist_prefix}{token}"
                await self.redis.setex(token_key, 86400, "blacklisted")  # 24 hours

            # Clear the agent's token set
            await self.redis.delete(agent_token_key)

            logger.info("All tokens revoked for agent", agent_id=agent_id, token_count=len(tokens))

    async def revoke_token_by_jti(self, jti: str, expiration: int = 86400) -> None:
        """
        Revoke a specific token by its JWT ID (jti).

        Args:
            jti: JWT ID of the token to revoke
            expiration: How long to keep the token revoked (in seconds)
        """
        token_key = f"{self.token_blacklist_prefix}{jti}"
        await self.redis.setex(token_key, expiration, "blacklisted")
        logger.info("Token revoked by JTI", jti=jti)

    async def cleanup_expired_tokens(self) -> None:
        """
        Clean up any expired tokens from the blacklist.
        Note: This is handled automatically by Redis TTL, but this method
        can be used for manual cleanup if needed.
        """
        # This is mainly a placeholder - Redis handles TTL automatically
        # In a real implementation, you might want to scan and clean up
        # tokens that are no longer valid but still in the set
        logger.info("Token cleanup completed")

    async def get_revoked_tokens_count(self, agent_id: str) -> int:
        """
        Get the count of revoked tokens for an agent.

        Args:
            agent_id: Agent ID to check

        Returns:
            Number of revoked tokens for the agent
        """
        agent_token_key = f"{self.agent_token_prefix}{agent_id}"
        return await self.redis.scard(agent_token_key)


# Global token manager instance
_token_manager: TokenManager | None = None


async def get_token_manager() -> TokenManager:
    """
    Get the global token manager instance.

    Returns:
        TokenManager instance

    Raises:
        RuntimeError: If service not initialized
    """
    if _token_manager is None:
        raise RuntimeError("TokenManager not initialized")
    return _token_manager


def init_token_manager(redis: Redis) -> TokenManager:
    """
    Initialize the global token manager.

    Args:
        redis: Redis client instance

    Returns:
        TokenManager instance
    """
    global _token_manager
    _token_manager = TokenManager(redis)
    return _token_manager
