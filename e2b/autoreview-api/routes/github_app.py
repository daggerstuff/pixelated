"""
AutoReview AI — GitHub App Installation Routes.

Handles:
  - GET  /github/install — Redirect to GitHub App install
  - GET  /github/install/callback — Save installation
  - GET  /github/repos — List monitored repos
  - POST /github/repos — Update monitored repos
"""

import logging
import time

import httpx
import jwt as pyjwt
from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel

from config import get_settings
from db import get_user_by_id, get_user_installations, upsert_installation

logger = logging.getLogger("autoreview.github")
router = APIRouter()


@router.get("/install")
async def install_redirect():
    """Redirect user to GitHub App installation page."""
    settings = get_settings()
    install_url = f"https://github.com/apps/{settings.github_app_name}/installations/new"
    return {"install_url": install_url}


@router.get("/install/callback")
async def install_callback(
    installation_id: int,
    setup_action: str = "install",
):
    """Handle GitHub App installation callback.

    GitHub redirects here after the user installs or
    updates the app on their repos.
    """
    settings = get_settings()

    if setup_action == "install":
        logger.info("New installation: %d", installation_id)
    elif setup_action == "update":
        logger.info("Installation updated: %d", installation_id)

    # Redirect to frontend dashboard — the frontend
    # will call /github/repos to fetch installation
    # details using the authenticated user's JWT.
    return {
        "status": "ok",
        "installation_id": installation_id,
        "action": setup_action,
        "redirect": (f"{settings.frontend_url}/dashboard?installed=true"),
    }


@router.get("/repos")
async def list_repos(request: Request):
    """List all repos from the user's installations."""
    user_id = request.state.user_id
    installations = get_user_installations(user_id)

    all_repos = []
    for inst in installations:
        for repo in inst.get("repos", []):
            all_repos.append(
                {
                    "repo": repo,
                    "installation_id": inst["github_installation_id"],
                }
            )

    return {
        "repos": all_repos,
        "installation_count": len(installations),
    }


class SyncInstallationRequest(BaseModel):
    installation_id: int


@router.post("/sync")
async def sync_installation(body: SyncInstallationRequest, request: Request):
    """Fetch repos from a GitHub installation and sync.

    Calls the GitHub API to list repos accessible
    to the installation, then stores them.
    """
    settings = get_settings()
    user_id = request.state.user_id

    # Generate an installation access token
    # via the GitHub App JWT
    try:
        app_jwt = _create_github_app_jwt(settings)
    except Exception as exc:
        logger.error("Failed to create GitHub App JWT: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to authenticate with GitHub",
        ) from exc

    async with httpx.AsyncClient() as client:
        # Get installation access token
        token_resp = await client.post(
            f"https://api.github.com/app/installations/{body.installation_id}/access_tokens",
            headers={
                "Authorization": f"Bearer {app_jwt}",
                "Accept": ("application/vnd.github+json"),
            },
            timeout=10,
        )

        if token_resp.status_code != 201:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=("Could not get installation token"),
            )

        install_token = token_resp.json()["token"]

        # List repos accessible to installation
        repos_resp = await client.get(
            "https://api.github.com/installation/repositories",
            headers={
                "Authorization": (f"Bearer {install_token}"),
                "Accept": ("application/vnd.github+json"),
            },
            params={"per_page": 100},
            timeout=15,
        )

        if repos_resp.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Could not list repos",
            )

        repos_data = repos_resp.json()
        repo_names = [r["full_name"] for r in repos_data.get("repositories", [])]

    # Enforce repo limits
    tier_repo_limits = settings.tier_repo_limits

    user = get_user_by_id(user_id)
    user_tier = user.get("tier", "free") if user else "free"
    max_repos = tier_repo_limits.get(user_tier, 1)

    if len(repo_names) > max_repos:
        repo_names = repo_names[:max_repos]

    installation = upsert_installation(
        user_id=user_id,
        github_installation_id=body.installation_id,
        repos=repo_names,
    )

    logger.info(
        "Synced %d repos for installation %d (tier=%s)",
        len(repo_names),
        body.installation_id,
        user_tier,
    )

    return {
        "installation": installation,
        "repo_count": len(repo_names),
        "max_repos": max_repos,
    }


def _create_github_app_jwt(settings) -> str:
    """Create a short-lived JWT for GitHub App auth.

    GitHub Apps authenticate API calls using a JWT
    signed with the App's private key.
    """

    now = int(time.time())
    payload = {
        "iat": now - 60,
        "exp": now + (10 * 60),
        "iss": settings.github_app_id,
    }

    # The private key is stored as a file path or
    # PEM string in the env var
    private_key = settings.github_app_client_secret
    if private_key.startswith("-----BEGIN"):
        key = private_key
    else:
        with open(private_key) as f:
            key = f.read()

    return pyjwt.encode(payload, key, algorithm="RS256")
