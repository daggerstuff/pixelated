"""
Test error endpoints for debugging.
"""

from fastapi import APIRouter, HTTPException, status

router = APIRouter(prefix="/api/errors", tags=["errors"])


@router.get("/400")
async def test_400_error():
    """Test 400 error."""
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST, detail="Bad request test"
    )


@router.get("/404")
async def test_404_error():
    """Test 404 error."""
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND, detail="Not found test"
    )


@router.get("/500")
async def test_500_error():
    """Test 500 error."""
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Internal server error test",
    )
