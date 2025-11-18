"""
Cache service for Redis configuration and management
"""

import json
import time
from typing import Any, Dict, Optional

import redis.asyncio as redis
import structlog
from redis.asyncio.exceptions import (
    ConnectionError as RedisConnectionError,
    RedisError,
    TimeoutError as RedisTimeoutError,
)

from ..config import settings

logger = structlog.get_logger(__name__)


class CacheService:
    """Redis cache service for bias detection service"""

    def __init__(self):
        self.redis_client: Optional[redis.Redis] = None
        self.is_connected = False
        self.connection_retry_count = 0
        self.max_retries = 3

    async def connect(self) -> bool:
        """Connect to Redis"""
        try:
            logger.info("Connecting to Redis", redis_url=settings.redis_url)

            self.redis_client = redis.Redis(
                host=settings.redis_url.host or "localhost",
                port=settings.redis_url.port or 6379,
                db=int(settings.redis_url.path[1:]) if settings.redis_url.path else 0,
                password=settings.redis_url.password,
                decode_responses=True,
                socket_connect_timeout=5,
                socket_timeout=5,
                retry_on_timeout=True,
                retry_on_error=[RedisConnectionError, RedisTimeoutError],
                max_connections=50,
            )

            # Test connection
            await self.redis_client.ping()
            self.is_connected = True

            logger.info("Redis connection established successfully")
            return True

        except Exception as e:
            logger.error(
                f"Failed to connect to Redis: {str(e)}",
                redis_url=str(settings.redis_url),
                error=str(e),
            )
            self.is_connected = False
            return False

    async def disconnect(self) -> None:
        """Disconnect from Redis"""
        if self.redis_client:
            try:
                await self.redis_client.aclose()
                self.is_connected = False
                logger.info("Redis connection closed")
            except Exception as e:
                logger.warning(f"Error closing Redis connection: {str(e)}")
            finally:
                self.redis_client = None

    async def get(self, key: str) -> Optional[Any]:
        """Get value from cache"""
        if (
            not self.is_connected
            or not settings.enable_caching
            or self.redis_client is None
        ):
            return None

        try:
            value = await self.redis_client.get(key)
            if value:
                # Try to deserialize JSON
                try:
                    return json.loads(value)
                except json.JSONDecodeError:
                    return value

            return None

        except RedisError as e:
            logger.warning(f"Redis get error for key {key}: {str(e)}")
            return None

    async def set(
        self, key: str, value: Any, ttl: Optional[int] = None, serialize: bool = True
    ) -> bool:
        """Set value in cache"""
        if (
            not self.is_connected
            or not settings.enable_caching
            or self.redis_client is None
        ):
            return False

        try:
            # Serialize value if needed
            if serialize and not isinstance(value, (str, int, float, bool)):
                value = json.dumps(value)

            # Set with TTL
            if ttl:
                await self.redis_client.setex(key, ttl, value)
            else:
                await self.redis_client.set(key, value)

            return True

        except RedisError as e:
            logger.warning(f"Redis set error for key {key}: {str(e)}")
            return False

    async def delete(self, key: str) -> bool:
        """Delete key from cache"""
        if not self.is_connected or self.redis_client is None:
            return False

        try:
            result = await self.redis_client.delete(key)
            return result > 0

        except RedisError as e:
            logger.warning(f"Redis delete error for key {key}: {str(e)}")
            return False

    async def exists(self, key: str) -> bool:
        """Check if key exists in cache"""
        if not self.is_connected or self.redis_client is None:
            return False

        try:
            return bool(await self.redis_client.exists(key))

        except RedisError as e:
            logger.warning(f"Redis exists error for key {key}: {str(e)}")
            return False

    async def cache_analysis_result(
        self, content_hash: str, result: Dict[str, Any], ttl: Optional[int] = None
    ) -> bool:
        """Cache bias analysis result"""
        key = f"bias:analysis:{content_hash}"
        ttl = ttl or settings.cache_ttl_seconds

        return await self.set(key, result, ttl)

    async def get_analysis_result(self, content_hash: str) -> Optional[Dict[str, Any]]:
        """Get cached bias analysis result"""
        key = f"bias:analysis:{content_hash}"
        return await self.get(key)

    async def cache_model_prediction(
        self,
        model_name: str,
        text_hash: str,
        prediction: Dict[str, Any],
        ttl: Optional[int] = None,
    ) -> bool:
        """Cache model prediction"""
        key = f"model:{model_name}:prediction:{text_hash}"
        ttl = ttl or settings.cache_ttl_seconds

        return await self.set(key, prediction, ttl)

    async def get_model_prediction(
        self, model_name: str, text_hash: str
    ) -> Optional[Dict[str, Any]]:
        """Get cached model prediction"""
        key = f"model:{model_name}:prediction:{text_hash}"
        return await self.get(key)

    async def cache_user_session(
        self, user_id: str, session_data: Dict[str, Any], ttl: Optional[int] = None
    ) -> bool:
        """Cache user session data"""
        key = f"user:session:{user_id}"
        ttl = ttl or 3600  # 1 hour default for sessions

        return await self.set(key, session_data, ttl)

    async def get_user_session(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get cached user session data"""
        key = f"user:session:{user_id}"
        return await self.get(key)

    async def increment_rate_limit_counter(
        self, identifier: str, window_seconds: int = 60
    ) -> int:
        """Increment rate limit counter"""
        if not self.is_connected or self.redis_client is None:
            return 0

        try:
            key = f"rate_limit:{identifier}"
            current_count = await self.redis_client.incr(key)

            # Set TTL on first increment
            if current_count == 1:
                await self.redis_client.expire(key, window_seconds)

            return current_count

        except RedisError as e:
            logger.warning(f"Redis rate limit error: {str(e)}")
            return 0

    async def get_rate_limit_counter(self, identifier: str) -> int:
        """Get current rate limit counter"""
        if not self.is_connected or self.redis_client is None:
            return 0

        try:
            key = f"rate_limit:{identifier}"
            count = await self.redis_client.get(key)
            return int(count) if count else 0

        except RedisError as e:
            logger.warning(f"Redis rate limit get error: {str(e)}")
            return 0

    async def cache_dashboard_metrics(
        self, metrics: Dict[str, Any], ttl: Optional[int] = None
    ) -> bool:
        """Cache dashboard metrics"""
        key = "dashboard:metrics"
        ttl = ttl or 300  # 5 minutes default for metrics

        return await self.set(key, metrics, ttl)

    async def get_dashboard_metrics(self) -> Optional[Dict[str, Any]]:
        """Get cached dashboard metrics"""
        key = "dashboard:metrics"
        return await self.get(key)

    async def cache_model_info(
        self, model_name: str, model_info: Dict[str, Any], ttl: Optional[int] = None
    ) -> bool:
        """Cache model information"""
        key = f"model:info:{model_name}"
        ttl = ttl or 3600  # 1 hour default for model info

        return await self.set(key, model_info, ttl)

    async def get_model_info(self, model_name: str) -> Optional[Dict[str, Any]]:
        """Get cached model information"""
        key = f"model:info:{model_name}"
        return await self.get(key)

    async def clear_pattern(self, pattern: str) -> int:
        """Clear keys matching a pattern"""
        if not self.is_connected or self.redis_client is None:
            return 0

        try:
            # Use SCAN to find keys matching pattern
            keys = []
            cursor = 0

            while True:
                cursor, batch_keys = await self.redis_client.scan(
                    cursor, match=pattern, count=100
                )
                keys.extend(batch_keys)

                if cursor == 0:
                    break

            # Delete keys
            return await self.redis_client.delete(*keys) if keys else 0
        except RedisError as e:
            logger.warning(f"Redis clear pattern error: {str(e)}")
            return 0

    async def get_health_status(self) -> Dict[str, Any]:
        """Get cache service health status"""
        if not self.is_connected or self.redis_client is None:
            return {
                "status": "unhealthy",
                "connected": False,
                "error": "Not connected to Redis",
            }

        try:
            # Test basic operations
            test_key = f"health:test:{int(time.time())}"
            test_value = "test"

            await self.redis_client.set(test_key, test_value, ex=1)
            retrieved_value = await self.redis_client.get(test_key)

            if retrieved_value == test_value:
                return {
                    "status": "healthy",
                    "connected": True,
                    "memory_usage": await self.redis_client.info("memory"),
                    "stats": await self.redis_client.info("stats"),
                }
            else:
                return {
                    "status": "degraded",
                    "connected": True,
                    "error": "Test operation failed",
                }

        except Exception as e:
            return {"status": "unhealthy", "connected": True, "error": str(e)}


# Global cache service instance
cache_service = CacheService()


async def initialize_cache() -> bool:
    """Initialize cache service"""
    return await cache_service.connect()


async def shutdown_cache() -> None:
    """Shutdown cache service"""
    await cache_service.disconnect()
