"""API v1 router aggregation."""

from fastapi import APIRouter

from src.pe.api.v1.health import router as health_router

router = APIRouter(prefix="/api/v1")
router.include_router(health_router)