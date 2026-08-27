"""Versioned release registry with semantic versioning and approval tracking."""

from __future__ import annotations

from pathlib import Path

from pydantic import Field

from scripts.data.designer.release_manifest import ApprovalState, ReleaseManifest
from scripts.data.designer.schemas import StrictModel


class ReleaseRegistryEntry(StrictModel):
    """A single entry in the release registry."""

    release_id: str = Field(pattern=r"^REL-\d{3}$")
    release_version: str = Field(pattern=r"^\d+\.\d+\.\d+$")
    product: str = Field(min_length=1)
    approval_state: str = Field(min_length=1)
    manifest_path: str = Field(min_length=1)
    created_at: str = Field(min_length=1)
    approved_by: str | None = None
    approved_at: str | None = None
    superseded_by: str | None = None


class ReleaseRegistry:
    """Versioned registry of construction releases with approval tracking."""

    def __init__(self, entries: list[ReleaseRegistryEntry] | None = None) -> None:
        self._entries: dict[str, ReleaseRegistryEntry] = {}
        for entry in entries or []:
            self._register(entry)

    def _register(self, entry: ReleaseRegistryEntry) -> None:
        existing = self._entries.get(entry.release_id)
        if existing and existing.release_version != entry.release_version:
            raise ValueError(f"release {entry.release_id} already registered with version {existing.release_version}")
        self._entries[entry.release_id] = entry

    @property
    def entries(self) -> list[ReleaseRegistryEntry]:
        return sorted(self._entries.values(), key=lambda e: e.release_id)

    def register(self, manifest: ReleaseManifest, manifest_path: str) -> ReleaseRegistryEntry:
        """Register a new release from a manifest."""
        entry = ReleaseRegistryEntry(
            release_id=manifest.release_id,
            release_version=manifest.release_version,
            product=manifest.product.value,
            approval_state=manifest.approval_state.value,
            manifest_path=manifest_path,
            created_at=manifest.created_at,
            approved_by=manifest.approved_by,
            approved_at=manifest.approved_at,
        )
        self._register(entry)
        return entry

    def approve(self, release_id: str, *, approved_by: str, approved_at: str) -> ReleaseRegistryEntry:
        """Transition a release to approved state."""
        entry = self._entries.get(release_id)
        if entry is None:
            raise KeyError(f"release {release_id} not found in registry")
        if entry.approval_state == ApprovalState.APPROVED.value:
            raise ValueError(f"release {release_id} is already approved")
        entry = entry.model_copy(
            update={
                "approval_state": ApprovalState.APPROVED.value,
                "approved_by": approved_by,
                "approved_at": approved_at,
            }
        )
        self._entries[release_id] = entry
        return entry

    def reject(self, release_id: str, *, rejected_by: str, rejected_at: str) -> ReleaseRegistryEntry:
        """Transition a release to rejected state."""
        entry = self._entries.get(release_id)
        if entry is None:
            raise KeyError(f"release {release_id} not found in registry")
        entry = entry.model_copy(
            update={
                "approval_state": ApprovalState.REJECTED.value,
                "approved_by": rejected_by,
                "approved_at": rejected_at,
            }
        )
        self._entries[release_id] = entry
        return entry

    def lookup(self, release_id: str) -> ReleaseRegistryEntry:
        """Look up a release by ID."""
        if release_id not in self._entries:
            raise KeyError(f"release {release_id} not found in registry")
        return self._entries[release_id]

    def latest(self, product: str | None = None) -> ReleaseRegistryEntry | None:
        """Return the latest registered release, optionally filtered by product."""
        entries = list(self._entries.values())
        if product:
            entries = [e for e in entries if e.product == product]
        if not entries:
            return None
        return max(entries, key=lambda e: (e.release_version, e.created_at))

    def approved(self, product: str | None = None) -> list[ReleaseRegistryEntry]:
        """Return all approved releases, optionally filtered by product."""
        entries = list(self._entries.values())
        if product:
            entries = [e for e in entries if e.product == product]
        return [e for e in entries if e.approval_state == ApprovalState.APPROVED.value]

    def write_jsonl(self, path: str | Path) -> None:
        """Write the registry to a JSONL file."""
        destination = Path(path)
        destination.parent.mkdir(parents=True, exist_ok=True)
        with destination.open("w", encoding="utf-8") as output_file:
            for entry in self.entries:
                output_file.write(entry.model_dump_json() + "\n")

    @classmethod
    def load_jsonl(cls, path: str | Path) -> ReleaseRegistry:
        """Load a registry from a JSONL file."""
        p = Path(path)
        if not p.exists():
            return cls()
        entries: list[ReleaseRegistryEntry] = []
        with p.open(encoding="utf-8") as source_file:
            for line in source_file:
                if not line.strip():
                    continue
                entries.append(ReleaseRegistryEntry.model_validate_json(line))
        return cls(entries)
