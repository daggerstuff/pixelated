"""API v1 router aggregation."""

from fastapi import APIRouter

from src.pe.api.v1.health import router as health_router
from src.pe.api.v1.routes.auth import router as auth_router

router = APIRouter(prefix="/api/v1")
router.include_router(health_router)
router.include_router(auth_router)
