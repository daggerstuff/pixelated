"""
AutoReview AI — Usage Tracking Routes.

Handles:
  - GET  /usage — Current usage stats + limits
  - GET  /usage/history — Recent PR review history
  - POST /usage/check — Pre-flight check before review
"""

import logging

from fastapi import APIRouter, HTTPException, Request, status

from config import get_settings
from db import (
    get_monthly_usage_count,
    get_usage_history,
    get_user_by_id,
)

logger = logging.getLogger("autoreview.usage")
router = APIRouter()


@router.get("/")
async def get_usage(request: Request):
    """Get current month's usage statistics and limits."""
    settings = get_settings()
    user_id = request.state.user_id

    user = get_user_by_id(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    tier = user.get("tier", "free")
    used = get_monthly_usage_count(user_id)
    limit = settings.tier_limits.get(tier, 5)

    return {
        "tier": tier,
        "used": used,
        "limit": limit,
        "remaining": max(0, limit - used),
        "percentage": round(
            (used / limit * 100) if limit > 0 else 100,
            1,
        ),
    }


@router.get("/history")
async def usage_history(request: Request, limit: int = 50):
    """Get recent PR review usage history."""
    user_id = request.state.user_id
    capped_limit = min(limit, 100)
    history = get_usage_history(user_id, capped_limit)

    return {
        "history": history,
        "count": len(history),
    }


@router.post("/check")
async def preflight_check(request: Request):
    """Pre-flight check before starting a PR review.

    Returns whether the user has remaining quota.
    Called by the PR Churner before processing.
    """
    settings = get_settings()
    user_id = request.state.user_id

    user = get_user_by_id(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    tier = user.get("tier", "free")
    used = get_monthly_usage_count(user_id)
    limit = settings.tier_limits.get(tier, 5)
    remaining = max(0, limit - used)

    if remaining <= 0:
        return {
            "allowed": False,
            "reason": "Monthly quota exceeded",
            "tier": tier,
            "used": used,
            "limit": limit,
            "upgrade_url": (f"{settings.frontend_url}/pricing"),
        }

    return {
        "allowed": True,
        "tier": tier,
        "used": used,
        "limit": limit,
        "remaining": remaining,
    }
