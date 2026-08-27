"""Tests for release registry versioning, approval, and lookup."""

from __future__ import annotations

from pathlib import Path

import pytest

from scripts.data.designer.common import CONSTRUCTION_SPEC_VERSION, PROMPT_VERSION
from scripts.data.designer.release_manifest import ApprovalState, DVCPointer, build_manifest_from_records
from scripts.data.designer.release_registry import ReleaseRegistry, ReleaseRegistryEntry
from scripts.data.designer.schemas import (
    ChatMessage,
    ConstructionRecord,
    HumanReviewStatus,
    JudgeResult,
    TargetProduct,
)

BUILDER_HASH = "sha256:" + "a" * 64
REGISTRY_VERSION = "2026-08-20.1"


def _make_record(human_review_status: HumanReviewStatus = HumanReviewStatus.APPROVED) -> ConstructionRecord:
    return ConstructionRecord(
        product=TargetProduct.THERAPEUTIC_SFT,
        source_id="SRC-047",
        analysis_id="src047.mi-reflection",
        source_unit_refs=["annomi:dialogue-001:turn-04"],
        use_policies=["direct"],
        contribution_mode="direct_seed",
        construction_spec_version=CONSTRUCTION_SPEC_VERSION,
        model_alias="nvidia-text",
        prompt_version=PROMPT_VERSION,
        judge_results={"clinical_safety": JudgeResult(score=5, reason="Safe")},
        human_review_status=human_review_status,
        lineage_hashes=["sha256:source", "sha256:prompt"],
        messages=[
            ChatMessage(role="system", content="You are a therapist."),
            ChatMessage(role="user", content="I feel stuck."),
            ChatMessage(role="assistant", content="Tell me more."),
        ],
    )


def _make_dvc_pointer() -> DVCPointer:
    return DVCPointer(
        path="ai/data/curated/construction/releases/REL-001/construction_records.jsonl",
        md5="0123456789abcdef0123456789abcdef",
        size=4096,
        file_type="construction_records",
    )


def _make_manifest(
    release_id: str = "REL-001",
    release_version: str = "1.0.0",
) -> object:
    return build_manifest_from_records(
        release_id=release_id,
        release_version=release_version,
        product=TargetProduct.THERAPEUTIC_SFT,
        records=[_make_record()],
        source_registry_version=REGISTRY_VERSION,
        builder_config_hash=BUILDER_HASH,
        dvc_pointers=[_make_dvc_pointer()],
        created_at="2026-08-27T00:00:00Z",
        created_by="test-runner",
    )


class TestReleaseRegistry:
    def test_register_from_manifest(self) -> None:
        registry = ReleaseRegistry()
        manifest = _make_manifest()
        entry = registry.register(manifest, "releases/REL-001/manifest.json")
        assert entry.release_id == "REL-001"
        assert entry.approval_state == ApprovalState.PENDING.value

    def test_lookup(self) -> None:
        registry = ReleaseRegistry()
        manifest = _make_manifest()
        registry.register(manifest, "releases/REL-001/manifest.json")
        entry = registry.lookup("REL-001")
        assert entry.release_id == "REL-001"

    def test_lookup_not_found(self) -> None:
        registry = ReleaseRegistry()
        with pytest.raises(KeyError):
            registry.lookup("REL-999")

    def test_approve(self) -> None:
        registry = ReleaseRegistry()
        manifest = _make_manifest()
        registry.register(manifest, "releases/REL-001/manifest.json")
        entry = registry.approve("REL-001", approved_by="reviewer-001", approved_at="2026-08-28T00:00:00Z")
        assert entry.approval_state == ApprovalState.APPROVED.value
        assert entry.approved_by == "reviewer-001"

    def test_approve_already_approved(self) -> None:
        registry = ReleaseRegistry()
        manifest = _make_manifest()
        registry.register(manifest, "releases/REL-001/manifest.json")
        registry.approve("REL-001", approved_by="reviewer-001", approved_at="2026-08-28T00:00:00Z")
        with pytest.raises(ValueError, match="already approved"):
            registry.approve("REL-001", approved_by="reviewer-002", approved_at="2026-08-29T00:00:00Z")

    def test_reject(self) -> None:
        registry = ReleaseRegistry()
        manifest = _make_manifest()
        registry.register(manifest, "releases/REL-001/manifest.json")
        entry = registry.reject("REL-001", rejected_by="reviewer-002", rejected_at="2026-08-28T00:00:00Z")
        assert entry.approval_state == ApprovalState.REJECTED.value

    def test_latest(self) -> None:
        registry = ReleaseRegistry()
        registry.register(_make_manifest("REL-001", "1.0.0"), "a.json")
        registry.register(_make_manifest("REL-002", "2.0.0"), "b.json")
        latest = registry.latest()
        assert latest is not None
        assert latest.release_id == "REL-002"

    def test_latest_by_product(self) -> None:
        registry = ReleaseRegistry()
        registry.register(_make_manifest("REL-001", "1.0.0"), "a.json")
        registry.register(_make_manifest("REL-002", "2.0.0"), "b.json")
        latest = registry.latest(product="therapeutic_sft")
        assert latest is not None
        assert latest.release_id == "REL-002"
        assert registry.latest(product="dpo_preferences") is None

    def test_approved_releases(self) -> None:
        registry = ReleaseRegistry()
        registry.register(_make_manifest("REL-001", "1.0.0"), "a.json")
        registry.register(_make_manifest("REL-002", "2.0.0"), "b.json")
        registry.approve("REL-001", approved_by="r1", approved_at="2026-08-28T00:00:00Z")
        approved = registry.approved()
        assert len(approved) == 1
        assert approved[0].release_id == "REL-001"

    def test_duplicate_version_conflict(self) -> None:
        entry1 = ReleaseRegistryEntry(
            release_id="REL-001",
            release_version="1.0.0",
            product="therapeutic_sft",
            approval_state="pending",
            manifest_path="a.json",
            created_at="2026-08-27T00:00:00Z",
        )
        entry2 = ReleaseRegistryEntry(
            release_id="REL-001",
            release_version="2.0.0",
            product="therapeutic_sft",
            approval_state="pending",
            manifest_path="b.json",
            created_at="2026-08-27T00:00:00Z",
        )
        with pytest.raises(ValueError, match="already registered"):
            ReleaseRegistry([entry1, entry2])

    def test_jsonl_round_trip(self, tmp_path: Path) -> None:
        registry = ReleaseRegistry()
        registry.register(_make_manifest("REL-001", "1.0.0"), "a.json")
        registry.register(_make_manifest("REL-002", "2.0.0"), "b.json")
        path = tmp_path / "registry.jsonl"
        registry.write_jsonl(path)
        loaded = ReleaseRegistry.load_jsonl(path)
        assert len(loaded.entries) == 2
        assert loaded.lookup("REL-001").release_version == "1.0.0"
        assert loaded.lookup("REL-002").release_version == "2.0.0"

    def test_load_nonexistent_returns_empty(self, tmp_path: Path) -> None:
        registry = ReleaseRegistry.load_jsonl(tmp_path / "nonexistent.jsonl")
        assert registry.entries == []
        assert registry.latest() is None
