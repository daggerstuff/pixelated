from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

TOOL_DIR = Path(__file__).resolve().parents[2]
REPO_ROOT = TOOL_DIR.parents[1]

DEFAULT_DSN = "postgresql://drive_index:drive_index@127.0.0.1:5433/drive_index"


def _load_env_files() -> None:
    for candidate in (TOOL_DIR / ".env", REPO_ROOT / ".env"):
        if candidate.exists():
            load_dotenv(candidate, override=False)


@dataclass(frozen=True)
class Config:
    dsn: str
    client_secrets_dir: Path
    state_dir: Path
    seed_token_path: Path | None
    tmpdir: Path
    max_download_bytes: int
    sync_workers: int
    whisper_model: str
    embedding_model: str


def load_config() -> Config:
    _load_env_files()
    seed_token = os.environ.get("DRIVE_STATE_SEED_TOKEN_PATH") or os.environ.get("DRIVE_SEED_TOKEN_PATH")
    seed_path = Path(seed_token).expanduser() if seed_token else None
    if seed_path is None:
        repo_seed = REPO_ROOT / "hackathon" / "injectors" / "token.json"
        if repo_seed.exists():
            seed_path = repo_seed
    return Config(
        dsn=os.environ.get("DRIVE_INDEX_DSN", DEFAULT_DSN),
        client_secrets_dir=Path(os.environ.get("DRIVE_CLIENT_SECRETS_DIR", "~")).expanduser(),
        state_dir=Path(os.environ.get("DRIVE_STATE_DIR", "~/.gdrive-index")).expanduser(),
        seed_token_path=seed_path,
        tmpdir=Path(os.environ.get("DRIVE_INDEX_TMPDIR", "/data/tmp/drive-index")),
        max_download_bytes=int(os.environ.get("DRIVE_INDEX_MAX_DOWNLOAD_BYTES", str(512 * 1024 * 1024))),
        sync_workers=int(os.environ.get("DRIVE_INDEX_SYNC_WORKERS", "4")),
        whisper_model=os.environ.get("WHISPER_MODEL", "small"),
        embedding_model=os.environ.get("EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2"),
    )
