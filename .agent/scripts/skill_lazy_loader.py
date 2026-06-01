#!/usr/bin/env python3
"""Lazy loading system for agent skills.

This module keeps startup context light by loading only the compressed skills
index first, then resolving and caching individual `SKILL.md` files on demand.
"""

from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from threading import RLock
from typing import Any

logger = logging.getLogger(__name__)


def _discover_agent_root() -> Path:
    """Resolve the `.agent` root from the environment or repository layout."""

    env_root = os.environ.get("AGENT_ROOT")
    if env_root:
        candidate = Path(env_root).expanduser().resolve()
        if candidate.exists() and candidate.is_dir():
            return candidate

    script_root = Path(__file__).resolve().parents[1]
    if script_root.name == ".agent" and script_root.exists():
        return script_root

    cwd = Path.cwd().resolve()
    for candidate in [cwd, *cwd.parents]:
        probe = candidate / ".agent"
        if probe.exists() and probe.is_dir():
            return probe

    raise FileNotFoundError("Could not resolve .agent root. Set AGENT_ROOT or run from the repo root.")


AGENT_ROOT = _discover_agent_root()
REPO_ROOT = AGENT_ROOT.parent

COMPRESSED_INDEX = AGENT_ROOT / "skills-index-compressed.json"
TOOL_CATEGORIES = AGENT_ROOT / "tool-categories.json"
SKILLS_DIR = AGENT_ROOT / "skills"


def _is_within(path: Path, base: Path) -> bool:
    try:
        path.relative_to(base)
        return True
    except ValueError:
        return False


@dataclass(frozen=True, slots=True)
class SkillDocument:
    """Resolved skill file plus the metadata that pointed to it."""

    name: str
    path: Path
    metadata: dict[str, Any]
    content: str


class SkillHandle:
    """Lazy proxy for a single skill entry."""

    __slots__ = ("_loader", "name")

    def __init__(self, loader: SkillLazyLoader, name: str) -> None:
        self._loader = loader
        self.name = name

    @property
    def metadata(self) -> dict[str, Any] | None:
        return self._loader.get_skill_metadata(self.name)

    @property
    def path(self) -> Path | None:
        return self._loader.get_skill_path(self.name)

    @property
    def exists(self) -> bool:
        return self._loader.get_skill_path(self.name) is not None

    def load(self) -> SkillDocument:
        document = self._loader.load_skill_document(self.name)
        if document is None:
            raise FileNotFoundError(f"Skill not found: {self.name}")
        return document

    @property
    def content(self) -> str:
        return self.load().content

    def __bool__(self) -> bool:
        return self.exists

    def __str__(self) -> str:
        return self.content

    def __repr__(self) -> str:
        if self.name in self._loader._loaded_documents:
            state = "loaded"
        elif self.exists:
            state = "pending"
        else:
            state = "missing"
        return f"SkillHandle(name={self.name!r}, state={state!r})"


class SkillLazyLoader:
    """Lazy loader for skills metadata and full SKILL.md documents."""

    def __init__(self) -> None:
        self._lock = RLock()
        self._index_cache: dict[str, Any] | None = None
        self._categories_cache: dict[str, Any] | None = None
        self._skill_handles: dict[str, SkillHandle] = {}
        self._loaded_documents: dict[str, SkillDocument] = {}

    def clear_cache(self) -> None:
        """Clear all cached index, categories, and skill documents."""

        with self._lock:
            self._index_cache = None
            self._categories_cache = None
            self._skill_handles.clear()
            self._loaded_documents.clear()

    def _validate_index(self, payload: Any) -> dict[str, Any]:
        if not isinstance(payload, dict):
            raise ValueError(f"Invalid index schema in {COMPRESSED_INDEX}: expected object")

        payload.setdefault("skills", {})
        payload.setdefault("stats", {"total": 0, "populated": 0, "missing": 0, "errors": 0})

        if not isinstance(payload["skills"], dict):
            raise ValueError(f"Invalid index schema in {COMPRESSED_INDEX}: skills must be an object")
        if not isinstance(payload["stats"], dict):
            raise ValueError(f"Invalid index schema in {COMPRESSED_INDEX}: stats must be an object")

        return payload

    def _load_index(self) -> dict[str, Any]:
        with self._lock:
            if self._index_cache is not None:
                return self._index_cache

            if not COMPRESSED_INDEX.exists():
                self._index_cache = {
                    "version": "fallback",
                    "stats": {"total": 0, "populated": 0, "missing": 0, "errors": 0},
                    "skills": {},
                    "warning": f"Missing index file: {COMPRESSED_INDEX}",
                }
                return self._index_cache

            with COMPRESSED_INDEX.open(encoding="utf-8") as handle:
                data = json.load(handle)

            self._index_cache = self._validate_index(data)
            return self._index_cache

    def _load_categories(self) -> dict[str, Any]:
        with self._lock:
            if self._categories_cache is not None:
                return self._categories_cache

            if TOOL_CATEGORIES.exists():
                with TOOL_CATEGORIES.open(encoding="utf-8") as handle:
                    data = json.load(handle)
                self._categories_cache = data if isinstance(data, dict) else {}
                return self._categories_cache

            self._categories_cache = {
                "version": "fallback",
                "categories": {},
                "warning": f"Optional file missing: {TOOL_CATEGORIES.name}",
            }
            return self._categories_cache

    @property
    def index(self) -> dict[str, Any]:
        return self._load_index()

    @property
    def categories(self) -> dict[str, Any]:
        return self._load_categories()

    def list_available_skills(self) -> list[str]:
        """Return all skill names known to the compressed index."""

        return sorted(self.index.get("skills", {}).keys())

    def has_skill(self, skill_name: str) -> bool:
        """Check whether a skill exists in the compressed index."""

        return skill_name in self.index.get("skills", {})

    def get_skill_metadata(self, skill_name: str) -> dict[str, Any] | None:
        """Return lightweight metadata without loading the full file."""

        metadata = self.index.get("skills", {}).get(skill_name)
        if not isinstance(metadata, dict):
            return None
        return dict(metadata)

    def get_skill_path(self, skill_name: str) -> Path | None:
        """Resolve the file path for a skill without reading the file."""

        metadata = self.get_skill_metadata(skill_name)
        return self._resolve_skill_file_path(skill_name, metadata)

    def get_skill_category(self, skill_name: str) -> str:
        """Return the category for a skill, defaulting to `other`."""

        metadata = self.get_skill_metadata(skill_name)
        if isinstance(metadata, dict):
            return str(metadata.get("category", "other"))
        return "other"

    def get_skills_by_category(self, category: str) -> list[str]:
        """Return all skills in a given category."""

        matches: list[str] = []
        for name, metadata in self.index.get("skills", {}).items():
            if isinstance(metadata, dict) and metadata.get("category") == category:
                matches.append(name)
        return sorted(matches)

    def get_skill_handle(self, skill_name: str) -> SkillHandle:
        """Return a cached lazy handle for a skill."""

        with self._lock:
            handle = self._skill_handles.get(skill_name)
            if handle is None:
                handle = SkillHandle(self, skill_name)
                self._skill_handles[skill_name] = handle
            return handle

    def _resolve_skill_file_path(self, skill_name: str, metadata: dict[str, Any] | None) -> Path | None:
        """Resolve `SKILL.md` with repo-safe fallbacks."""

        candidates: list[Path] = []

        if isinstance(metadata, dict):
            raw_path = metadata.get("path")
            if isinstance(raw_path, str) and raw_path.strip():
                candidate = Path(raw_path.strip())
                if candidate.is_absolute():
                    candidates.append(candidate.resolve())
                else:
                    candidates.append((REPO_ROOT / candidate).resolve())
                    candidates.append((AGENT_ROOT / candidate).resolve())

        candidates.append((SKILLS_DIR / skill_name / "SKILL.md").resolve())

        for candidate in candidates:
            if (
                candidate.exists()
                and candidate.is_file()
                and (_is_within(candidate, AGENT_ROOT) or _is_within(candidate, REPO_ROOT))
            ):
                return candidate

        return None

    def _load_document(self, skill_name: str) -> SkillDocument | None:
        metadata = self.get_skill_metadata(skill_name)
        if metadata is None:
            logger.debug("Skill not found in compressed index: %s", skill_name)
            return None

        skill_file = self._resolve_skill_file_path(skill_name, metadata)
        if skill_file is None:
            logger.warning("Unable to resolve skill file for %s", skill_name)
            return None

        content = skill_file.read_text(encoding="utf-8")
        return SkillDocument(name=skill_name, path=skill_file, metadata=metadata, content=content)

    def load_skill_document(self, skill_name: str) -> SkillDocument | None:
        """Load and cache a full skill document."""

        with self._lock:
            cached = self._loaded_documents.get(skill_name)
            if cached is not None:
                return cached

            document = self._load_document(skill_name)
            if document is None:
                return None

            self._loaded_documents[skill_name] = document
            return document

    def get_skill_document(self, skill_name: str) -> SkillDocument | None:
        """Return a cached or newly loaded skill document."""

        return self.load_skill_document(skill_name)

    def load_skill(self, skill_name: str) -> str | None:
        """Load a skill's raw content on demand."""

        document = self.load_skill_document(skill_name)
        return document.content if document is not None else None

    def get_startup_context(self) -> dict[str, Any]:
        """Return compact startup context without loading full skill files."""

        return {
            "skills_index": self.index,
            "categories": self.categories,
            "stats": self.index.get("stats", {}),
            "agent_root": str(AGENT_ROOT),
            "loader": {
                "mode": "lazy",
                "compressed_index": str(COMPRESSED_INDEX),
                "skills_directory": str(SKILLS_DIR),
            },
        }

    @staticmethod
    def estimate_tokens(text: str) -> int:
        """Rough token estimate: approximately one token per four characters."""

        return len(text) // 4

    def get_token_budget_report(self) -> dict[str, Any]:
        """Report the current token footprint of the lazy loader."""

        index_tokens = self.estimate_tokens(json.dumps(self.index, ensure_ascii=False, sort_keys=True))
        loaded_tokens = sum(self.estimate_tokens(document.content) for document in self._loaded_documents.values())
        total = index_tokens + loaded_tokens
        target = 20000
        return {
            "index_tokens": index_tokens,
            "loaded_skills_count": len(self._loaded_documents),
            "loaded_tokens": loaded_tokens,
            "total_tokens": total,
            "target_startup_tokens": target,
            "within_budget": total < target,
        }


@lru_cache(maxsize=1)
def get_loader() -> SkillLazyLoader:
    """Return the singleton lazy loader."""

    return SkillLazyLoader()


def get_skill_content(skill_name: str) -> str | None:
    """Load one skill by name and return its raw text."""

    return get_loader().load_skill(skill_name)


def get_skill_handle(skill_name: str) -> SkillHandle:
    """Return a lazy handle for a skill."""

    return get_loader().get_skill_handle(skill_name)


def get_skill_document(skill_name: str) -> SkillDocument | None:
    """Load a skill document as a structured object."""

    return get_loader().get_skill_document(skill_name)


def get_startup_context() -> dict[str, Any]:
    """Return the minimal startup context for the agent runtime."""

    return get_loader().get_startup_context()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    loader = SkillLazyLoader()
    logger.info("Agent root: %s", AGENT_ROOT)
    logger.info("Repo root: %s", REPO_ROOT)
    logger.info("Token budget report: %s", loader.get_token_budget_report())
