"""Minimal pipelines router shim for test collection.

Some tests import package-level routers which expect a `pipelines` router
to exist. Provide a no-op APIRouter here so imports succeed.
"""

from fastapi import APIRouter

router = APIRouter(prefix="/pipelines", tags=["pipelines"])

@router.get("/health")
async def pipelines_health():
    return {"status": "ok"}
