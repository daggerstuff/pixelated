from __future__ import annotations

import json
import logging
import os
from pathlib import Path

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

from .config import Config

logger = logging.getLogger(__name__)

SCOPES = ["https://www.googleapis.com/auth/drive.readonly"]
TOKEN_FILE_NAME = "token.json"
OAUTH_CALLBACK_PORT = 8080


class AuthError(RuntimeError):
    pass


def read_client_id(token_path: Path) -> str | None:
    try:
        data = json.loads(token_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    client_id = data.get("client_id")
    return client_id if isinstance(client_id, str) else None


def match_client_secret(client_id: str, secrets_dir: Path) -> Path | None:
    """Find client_secret_<client_id>...json in the secrets directory."""
    for candidate in sorted(secrets_dir.glob("client_secret_*.json")):
        if candidate.name.startswith(f"client_secret_{client_id}"):
            return candidate
    return None


def _load_token(path: Path) -> Credentials | None:
    """Load a token file; return None if unusable or missing drive.readonly scope."""
    if not path.exists():
        return None
    creds = Credentials.from_authorized_user_file(str(path), SCOPES)
    if creds.valid and _has_scope(creds):
        return creds
    if creds.expired and creds.refresh_token and _has_scope(creds):
        creds.refresh(Request())
        return creds
    return None


def _has_scope(creds: Credentials) -> bool:
    return bool(creds.scopes) and set(SCOPES).issubset(creds.scopes)


def _run_flow(client_secrets: Path, cfg: Config) -> Credentials:
    flow = InstalledAppFlow.from_client_secrets_file(str(client_secrets), SCOPES)
    logger.info("=" * 64)
    logger.info("BROWSER AUTH REQUIRED (drive.readonly)")
    logger.info(
        "If you are SSH'd into this machine, forward the callback port first: ssh -L %d:localhost:%d <user>@<host>",
        OAUTH_CALLBACK_PORT,
        OAUTH_CALLBACK_PORT,
    )
    logger.info("Then open the printed URL in your browser.")
    logger.info("=" * 64)
    creds = flow.run_local_server(port=OAUTH_CALLBACK_PORT, open_browser=False)
    cfg.state_dir.mkdir(parents=True, exist_ok=True)
    token_path = cfg.state_dir / TOKEN_FILE_NAME
    token_path.write_text(creds.to_json(), encoding="utf-8")
    os.chmod(token_path, 0o600)
    logger.info("Stored drive.readonly token at %s", token_path)
    return creds


def load_credentials(cfg: Config) -> Credentials:
    creds = _load_token(cfg.state_dir / TOKEN_FILE_NAME)
    if creds is not None:
        return creds

    secret_path: Path | None = None
    if cfg.seed_token_path and cfg.seed_token_path.exists():
        client_id = read_client_id(cfg.seed_token_path)
        if client_id:
            secret_path = match_client_secret(client_id, cfg.client_secrets_dir)
            if secret_path is None:
                raise AuthError(f"No client secret matching client_id {client_id!r} in {cfg.client_secrets_dir}")
    if secret_path is None:
        candidates = sorted(cfg.client_secrets_dir.glob("client_secret_*.json"))
        if len(candidates) == 1:
            secret_path = candidates[0]
        elif not candidates:
            raise AuthError(f"No client_secret_*.json files found in {cfg.client_secrets_dir}")
        else:
            raise AuthError(
                f"Multiple client secrets in {cfg.client_secrets_dir} and no seed token to disambiguate; "
                "set DRIVE_SEED_TOKEN_PATH or leave exactly one client_secret_*.json"
            )

    return _run_flow(secret_path, cfg)


def build_drive_service(cfg: Config):
    creds = load_credentials(cfg)
    return build("drive", "v3", credentials=creds, cache_discovery=False)
