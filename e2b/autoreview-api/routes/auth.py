"""
AutoReview AI — GitHub OAuth Authentication.

Handles the GitHub App OAuth flow:
  1. /auth/github — Redirect user to GitHub consent screen
  2. /auth/github/callback — Exchange code for token,
     upsert user, return JWT
"""

import logging

import httpx
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import RedirectResponse

from config import get_settings
from db import upsert_user
from middleware import create_token

logger = logging.getLogger("autoreview.auth")
router = APIRouter()


@router.get("/github")
async def github_login():
    """Redirect user to GitHub OAuth consent page."""
    settings = get_settings()
    github_auth_url = (
        "https://github.com/login/oauth/authorize"
        f"?client_id={settings.github_app_client_id}"
        f"&redirect_uri={settings.frontend_url}"
        "/auth/callback"
        "&scope=read:user,user:email"
    )
    return RedirectResponse(url=github_auth_url)


@router.get("/github/callback")
async def github_callback(code: str):
    """Exchange OAuth code for access token, then upsert user.

    Returns a JWT session token and user profile.
    """
    settings = get_settings()

    # ── 1. Exchange code for access token ────────
    async with httpx.AsyncClient() as client:
        token_response = await client.post(
            "https://github.com/login/oauth/access_token",
            json={
                "client_id": settings.github_app_client_id,
                "client_secret": (settings.github_app_client_secret),
                "code": code,
            },
            headers={"Accept": "application/json"},
            timeout=10,
        )

    if token_response.status_code != 200:
        logger.error(
            "GitHub token exchange failed: %s",
            token_response.text,
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="GitHub token exchange failed",
        )

    token_data = token_response.json()
    access_token = token_data.get("access_token")
    if not access_token:
        error = token_data.get("error_description", "Unknown error")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"GitHub OAuth error: {error}",
        )

    # ── 2. Fetch GitHub user profile ─────────────
    async with httpx.AsyncClient() as client:
        user_response = await client.get(
            "https://api.github.com/user",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/vnd.github+json",
            },
            timeout=10,
        )

    if user_response.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to fetch GitHub profile",
        )

    github_user = user_response.json()

    # ── 3. Fetch primary email if not public ─────
    email = github_user.get("email")
    if not email:
        async with httpx.AsyncClient() as client:
            email_response = await client.get(
                "https://api.github.com/user/emails",
                headers={
                    "Authorization": (f"Bearer {access_token}"),
                    "Accept": ("application/vnd.github+json"),
                },
                timeout=10,
            )
        if email_response.status_code == 200:
            emails = email_response.json()
            primary = next(
                (e for e in emails if e.get("primary") and e.get("verified")),
                None,
            )
            if primary:
                email = primary["email"]

    # ── 4. Upsert user in Supabase ───────────────
    user = upsert_user(
        github_id=github_user["id"],
        github_login=github_user["login"],
        email=email,
        avatar_url=github_user.get("avatar_url"),
    )

    # ── 5. Create JWT session ────────────────────
    token = create_token(
        user_id=user["id"],
        github_login=user["github_login"],
    )

    logger.info(
        "User authenticated: %s (%s)",
        user["github_login"],
        user["tier"],
    )

    return {
        "token": token,
        "user": {
            "id": user["id"],
            "github_login": user["github_login"],
            "email": user.get("email"),
            "avatar_url": user.get("avatar_url"),
            "tier": user["tier"],
        },
    }
