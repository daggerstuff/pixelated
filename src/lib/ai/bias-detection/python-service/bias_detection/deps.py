"""
Shared service instances and FastAPI dependency getters.
Set in create_app() before including routers.
"""

from typing import cast

from fastapi import Depends, HTTPException, status

from .services import BiasDetectionService, DatabaseService, database_service
from .services.analysis_orchestrator import AnalysisOrchestrator

# Populated in create_app()
bias_detection_service: BiasDetectionService = BiasDetectionService()
database_service_instance: DatabaseService = cast(DatabaseService, database_service)
analysis_orchestrator: AnalysisOrchestrator = AnalysisOrchestrator(bias_detection_service, database_service_instance)


def get_bias_service() -> BiasDetectionService:
    return bias_detection_service


def get_database_service() -> DatabaseService:
    return database_service_instance


def get_analysis_orchestrator() -> AnalysisOrchestrator:
    return analysis_orchestrator


async def get_current_user() -> dict | None:
    """
    Extract current user from request context.
    Returns user dict if authenticated, None otherwise.
    For use with Depends() in route handlers.
    """
    # Placeholder - in production this would extract from JWT/session
    # For now, returns None to indicate no authenticated user
    return None


async def require_authenticated_user(user: dict = Depends(get_current_user)) -> dict:
    """
    FastAPI dependency: require authentication.
    Raises 401 if user is not authenticated.
    Returns user dict if authenticated.
    """
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")

    user_id = user.get("user_id")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid user credentials")

    return user


async def require_rate_limit() -> None:
    """
    Placeholder rate-limit dependency.

    This keeps API route dependency wiring intact while rate limiting is handled
    by upstream infrastructure in current deployments.
    """
    return


# Type alias for authenticated user payload
AuthenticatedUser = dict
