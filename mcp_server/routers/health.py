from fastapi import APIRouter

router = APIRouter(prefix="/health", tags=["health"])


@router.get("/alive")
async def alive():
    """Simple health check endpoint used by tests and collection."""
    return {"status": "ok"}
