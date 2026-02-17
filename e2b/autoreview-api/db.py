"""
AutoReview AI — Supabase Database Client.

Provides a singleton Supabase client and typed helper
functions for all database operations.
"""

from datetime import datetime, timezone
from typing import Any

from supabase import Client, create_client

from config import get_settings


def get_supabase() -> Client:
    """Return a Supabase client using service role key."""
    settings = get_settings()
    return create_client(
        settings.supabase_url,
        settings.supabase_service_key,
    )


# ── User Operations ─────────────────────────────────


def upsert_user(
    github_id: int,
    github_login: str,
    email: str | None,
    avatar_url: str | None,
) -> dict[str, Any]:
    """Create or update a user from GitHub profile data."""
    client = get_supabase()
    result = (
        client.table("users")
        .upsert(
            {
                "github_id": github_id,
                "github_login": github_login,
                "email": email,
                "avatar_url": avatar_url,
            },
            on_conflict="github_id",
        )
        .execute()
    )
    return result.data[0]


def get_user_by_id(user_id: str) -> dict[str, Any] | None:
    """Fetch a user by their UUID."""
    client = get_supabase()
    result = client.table("users").select("*").eq("id", user_id).maybe_single().execute()
    return result.data


def get_user_by_github_id(
    github_id: int,
) -> dict[str, Any] | None:
    """Fetch a user by their GitHub numeric ID."""
    client = get_supabase()
    result = client.table("users").select("*").eq("github_id", github_id).maybe_single().execute()
    return result.data


def update_user_stripe_customer(user_id: str, stripe_customer_id: str) -> None:
    """Link a Stripe customer to a user."""
    client = get_supabase()
    (
        client.table("users")
        .update({"stripe_customer_id": stripe_customer_id})
        .eq("id", user_id)
        .execute()
    )


def update_user_tier(user_id: str, tier: str) -> None:
    """Update a user's subscription tier."""
    client = get_supabase()
    (client.table("users").update({"tier": tier}).eq("id", user_id).execute())


# ── Subscription Operations ─────────────────────────


def upsert_subscription(
    user_id: str,
    stripe_sub_id: str,
    tier: str,
    status: str,
    **kwargs: Any,
) -> dict[str, Any]:
    """Create or update a subscription record.

    Keyword Args:
        current_period_end: Optional end-of-period datetime.
        cancel_at_period_end: Whether sub cancels at period end.
    """
    current_period_end: datetime | None = kwargs.get("current_period_end")
    cancel_at_period_end: bool = kwargs.get("cancel_at_period_end", False)

    client = get_supabase()
    data: dict[str, Any] = {
        "user_id": user_id,
        "stripe_sub_id": stripe_sub_id,
        "tier": tier,
        "status": status,
        "cancel_at_period_end": cancel_at_period_end,
    }
    if current_period_end:
        data["current_period_end"] = current_period_end.isoformat()

    result = client.table("subscriptions").upsert(data, on_conflict="stripe_sub_id").execute()
    return result.data[0]


def get_active_subscription(
    user_id: str,
) -> dict[str, Any] | None:
    """Get the active subscription for a user."""
    client = get_supabase()
    result = (
        client.table("subscriptions")
        .select("*")
        .eq("user_id", user_id)
        .eq("status", "active")
        .order("created_at", desc=True)
        .limit(1)
        .maybe_single()
        .execute()
    )
    return result.data


def delete_subscription(stripe_sub_id: str) -> None:
    """Mark a subscription as canceled."""
    client = get_supabase()
    (
        client.table("subscriptions")
        .update({"status": "canceled"})
        .eq("stripe_sub_id", stripe_sub_id)
        .execute()
    )


# ── Installation Operations ─────────────────────────


def upsert_installation(
    user_id: str,
    github_installation_id: int,
    repos: list[str],
) -> dict[str, Any]:
    """Store or update a GitHub App installation."""
    client = get_supabase()
    result = (
        client.table("installations")
        .upsert(
            {
                "user_id": user_id,
                "github_installation_id": github_installation_id,
                "repos": repos,
                "active": True,
            },
            on_conflict="github_installation_id",
        )
        .execute()
    )
    return result.data[0]


def get_user_installations(
    user_id: str,
) -> list[dict[str, Any]]:
    """Get all active installations for a user."""
    client = get_supabase()
    result = (
        client.table("installations")
        .select("*")
        .eq("user_id", user_id)
        .eq("active", True)
        .execute()
    )
    return result.data


def remove_repo_from_installation(installation_id: str, repo: str) -> None:
    """Remove a repo from an installation's monitored list."""
    client = get_supabase()
    current = (
        client.table("installations").select("repos").eq("id", installation_id).single().execute()
    )
    repos = [r for r in current.data["repos"] if r != repo]
    (client.table("installations").update({"repos": repos}).eq("id", installation_id).execute())


# ── Usage Operations ────────────────────────────────


def record_usage(
    user_id: str,
    pr_number: int,
    repo: str,
    tokens_used: int,
    status: str,
    **kwargs: Any,
) -> dict[str, Any]:
    """Record a PR review usage event.

    Keyword Args:
        error: Optional error message if the review failed.
    """
    error: str | None = kwargs.get("error")

    client = get_supabase()
    result = (
        client.table("usage")
        .insert(
            {
                "user_id": user_id,
                "pr_number": pr_number,
                "repo": repo,
                "tokens_used": tokens_used,
                "status": status,
                "error": error,
            }
        )
        .execute()
    )
    return result.data[0]


def get_monthly_usage_count(user_id: str) -> int:
    """Count PR reviews for the current billing month."""
    client = get_supabase()
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    result = (
        client.table("usage")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .in_("status", ["success", "partial"])
        .gte("created_at", month_start.isoformat())
        .execute()
    )
    return result.count or 0


def get_usage_history(user_id: str, limit: int = 50) -> list[dict[str, Any]]:
    """Get recent usage history for a user."""
    client = get_supabase()
    result = (
        client.table("usage")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return result.data
