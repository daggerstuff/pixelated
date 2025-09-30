"""
Minimal Agent service shim for tests and router dependencies.

Provides a lightweight AgentService with the methods used by routers/tests
and simple init/get helpers so tests can Depend(get_agent_service).
This intentionally keeps behavior minimal and safe when no database is
configured (returns empty lists / None) to avoid import-time/runtime
failures during pytest collection.
"""

from typing import Optional, List

import structlog

try:
    from motor.motor_asyncio import AsyncIOMotorDatabase
except Exception:  # pragma: no cover - motor may not be installed in minimal test runs
    AsyncIOMotorDatabase = None  # type: ignore

try:
    from redis.asyncio import Redis
except Exception:  # pragma: no cover - redis lib may be missing in some test runs
    Redis = None  # type: ignore

from mcp_server.models.agent import Agent


logger = structlog.get_logger(__name__)


class AgentService:
    """Minimal agent service used by routers and tests."""

    def __init__(self, db: Optional[AsyncIOMotorDatabase] = None, redis_client: Optional[Redis] = None):
        self.db = db
        self.redis = redis_client
        # Mongo collection if provided
        self.agents_collection = getattr(db, "agents", None) if db is not None else None

    async def list_agents(self, status: Optional[str] = None) -> List[Agent]:
        """Return a list of agents. If no DB is configured, return empty list."""
        if not self.agents_collection:
            return []

        try:
            query = {"status": status} if status else {}
            cursor = self.agents_collection.find(query)
            docs = await cursor.to_list(length=100)
            agents = [Agent(**{k: v for k, v in d.items() if k != "api_key_hash"}) for d in docs]
            return agents
        except Exception as e:
            logger.debug("AgentService.list_agents failed, returning empty list", error=str(e))
            return []

    async def get_agent_by_id(self, agent_id: str) -> Optional[Agent]:
        """Return an Agent by ID or None when not found / DB not configured."""
        if not self.agents_collection:
            return None

        try:
            doc = await self.agents_collection.find_one({"id": agent_id})
            if not doc:
                return None
            return Agent(**{k: v for k, v in doc.items() if k != "api_key_hash"})
        except Exception as e:
            logger.debug("AgentService.get_agent_by_id failed", agent_id=agent_id, error=str(e))
            return None


# Global agent service instance used by dependency injection
_agent_service: Optional[AgentService] = None


def init_agent_service(db: Optional[AsyncIOMotorDatabase] = None, redis_client: Optional[Redis] = None) -> AgentService:
    """Initialize and return the global AgentService instance."""
    global _agent_service
    _agent_service = AgentService(db=db, redis_client=redis_client)
    return _agent_service


async def get_agent_service() -> AgentService:
    """Dependency provider for FastAPI. Raises RuntimeError if not initialized."""
    if _agent_service is None:
        raise RuntimeError("AgentService not initialized")
    return _agent_service
