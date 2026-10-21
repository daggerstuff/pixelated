#!/usr/bin/env python3
"""Build a hash-only source row join for the frozen v4 counseling family."""

from __future__ import annotations

import hashlib
import json
import os
import sys
import tempfile
import unicodedata
from collections import Counter, defaultdict
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from ai.sourcing.dataset_adapters.counseling_conversations_adapter import (
    CounselingConversationsAdapter,
)

DATA_ROOT = ROOT / "ai/data/curated/recovery/gold-20261017"
PRIVATE_ROOT = DATA_ROOT / "private-source-origin-binding-20261019"
SOURCE_ROOT = PRIVATE_ROOT / "counseling-conversations-upstream"
SIDECAR = PRIVATE_ROOT / "bindings/counseling-conversations-v4-upstream-rowrefs-v2.jsonl"
REPORT = PRIVATE_ROOT / "bindings/counseling-conversations-v4-upstream-rowrefs-v2-report.json"
MANIFEST = DATA_ROOT / "wandb-full-corpus-current-master-20261019-v4/manifest_internal.jsonl"
CANDIDATE = ROOT / "ai/data/curated/sft_chatml/train_master_gold.jsonl"
SOURCE_REMOTE = "r2:pixel-archive/whitebat/training/raw/counseling_conversations/"
UPSTREAM_REVISION = "d7e86f0813c5690181b41f97403c3674aa55dcef"
UPSTREAM_FILE = "combined_dataset.json"
UPSTREAM_GIT_BLOB_SHA1 = "c007b48f6350f2d1493109db168440bfc6d8450f"


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def git_blob_sha1(data: bytes) -> str:
    header = b"blob " + str(len(data)).encode("ascii") + b"\0"
    return hashlib.sha1(header + data).hexdigest()


def canonical_sha256(value: Any) -> str:
    payload = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()
    return sha256_bytes(payload)


def turns(messages: list[dict[str, Any]]) -> tuple[tuple[str, str], ...]:
    return tuple((m["role"], m["content"]) for m in messages if m.get("role") != "system")


def normalized(messages: list[dict[str, Any]]) -> tuple[tuple[str, str], ...]:
    return tuple(
        (role, " ".join(unicodedata.normalize("NFKC", text).casefold().split())) for role, text in turns(messages)
    )


def read_records(path: Path) -> list[dict[str, Any]]:
    text = path.read_text(encoding="utf-8")
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        parsed = [json.loads(line) for line in text.splitlines() if line.strip()]
    if isinstance(parsed, list):
        return [row for row in parsed if isinstance(row, dict)]
    if isinstance(parsed, dict):
        return [parsed]
    raise ValueError("source file does not contain JSON objects")


def validate_inputs() -> list[Path]:
    if PRIVATE_ROOT.stat().st_mode & 0o777 != 0o700:
        raise SystemExit("private provenance root must be mode 0700")
    if SOURCE_ROOT.stat().st_mode & 0o777 != 0o700:
        raise SystemExit("private raw source root must be mode 0700")
    source_files = sorted(path for path in SOURCE_ROOT.rglob("*") if path.is_file())
    if len(source_files) != 3:
        raise SystemExit(f"expected 3 private snapshot objects, found {len(source_files)}")
    return source_files


def build_source_indexes(
    source_files: list[Path],
) -> tuple[dict[Any, list[dict[str, Any]]], dict[Any, list[dict[str, Any]]], list[dict[str, Any]], int, int, int, str]:
    exact: dict[Any, list[dict[str, Any]]] = defaultdict(list)
    norm: dict[Any, list[dict[str, Any]]] = defaultdict(list)
    source_manifest: list[dict[str, Any]] = []
    input_rows = output_rows = snapshot_file_count = 0
    indexed_source_file_sha256 = ""
    with tempfile.TemporaryDirectory(prefix="counseling-origin-") as temp:
        os.chmod(temp, 0o700)
        adapter = CounselingConversationsAdapter("counseling_conversations", temp)
        raw_sources: list[tuple[Path, bytes, list[dict[str, Any]], list[str]]] = []
        for path in source_files:
            raw_bytes = path.read_bytes()
            file_hash = sha256_bytes(raw_bytes)
            relative = path.relative_to(SOURCE_ROOT).as_posix()
            relative_hash = sha256_bytes(relative.encode())
            snapshot_file_count += 1
            source_rows = read_records(path)
            if not source_rows or not {"Context", "Response"}.issubset(source_rows[0]):
                continue
            source_manifest.append(
                {"bytes": len(raw_bytes), "relative_path_sha256": relative_hash, "sha256": file_hash}
            )
            raw_sources.append((path, raw_bytes, source_rows, [canonical_sha256(row) for row in source_rows]))

        canonical_sources = [entry for entry in raw_sources if entry[0].name == UPSTREAM_FILE]
        if len(canonical_sources) != 1:
            raise SystemExit("pinned upstream source file is missing or ambiguous")
        canonical_path, canonical_bytes, canonical_rows, canonical_row_hashes = canonical_sources[0]
        if git_blob_sha1(canonical_bytes) != UPSTREAM_GIT_BLOB_SHA1:
            raise SystemExit("canonical source file does not match the pinned upstream Git blob")
        for path, _raw_bytes, _source_rows, row_hashes in raw_sources:
            if path == canonical_path:
                continue
            if row_hashes != canonical_row_hashes:
                raise SystemExit("duplicate source serialization differs from the pinned JSON records")

        relative = canonical_path.relative_to(SOURCE_ROOT).as_posix()
        relative_hash = sha256_bytes(relative.encode())
        indexed_source_file_sha256 = sha256_bytes(canonical_bytes)
        for row_number, raw in enumerate(canonical_rows, start=1):
            input_rows += 1
            projected = adapter.convert_to_chatml([raw])
            for record in projected:
                output_rows += 1
                locator = {
                    "relative_path_sha256": relative_hash,
                    "source_file_sha256": indexed_source_file_sha256,
                    "source_row_1based": row_number,
                }
                exact[turns(record["messages"])].append(locator)
                norm[normalized(record["messages"])].append(locator)
    return exact, norm, source_manifest, input_rows, output_rows, snapshot_file_count, indexed_source_file_sha256


def load_split_map() -> tuple[dict[int, str], int]:
    splits: dict[int, str] = {}
    manifest_rows = 0
    with MANIFEST.open(encoding="utf-8") as stream:
        for line in stream:
            row = json.loads(line)
            manifest_rows += 1
            if row.get("source_label") == "counseling_conversations":
                splits[row["candidate_row_number_1based"]] = row["split"]
    return splits, manifest_rows


def build_candidate_sidecar(
    exact: dict[Any, list[dict[str, Any]]],
    norm: dict[Any, list[dict[str, Any]]],
    splits: dict[int, str],
) -> tuple[
    Counter[str],
    Counter[str],
    Counter[str],
    dict[tuple[str, str, int], set[str]],
    dict[tuple[str, str, int], set[str]],
    int,
]:
    statuses: Counter[str] = Counter()
    norm_statuses: Counter[str] = Counter()
    split_counts: Counter[str] = Counter()
    locator_splits: dict[tuple[str, str, int], set[str]] = defaultdict(set)
    normalized_locator_splits: dict[tuple[str, str, int], set[str]] = defaultdict(set)
    rows = 0
    with SIDECAR.open("w", encoding="utf-8") as sidecar, CANDIDATE.open(encoding="utf-8") as candidate:
        os.chmod(SIDECAR, 0o600)
        for row_number, line in enumerate(candidate, start=1):
            split = splits.get(row_number)
            if split is None:
                continue
            row = json.loads(line)
            if row.get("source") != "counseling_conversations":
                raise SystemExit("manifest source label differs from candidate source")
            matches = exact.get(turns(row["messages"]), [])
            norm_matches = norm.get(normalized(row["messages"]), [])
            exact_status = "unmatched" if not matches else "unique" if len(matches) == 1 else "ambiguous"
            norm_status = "unmatched" if not norm_matches else "unique" if len(norm_matches) == 1 else "ambiguous"
            statuses[exact_status] += 1
            norm_statuses[norm_status] += 1
            split_counts[split] += 1
            for locator in matches:
                locator_splits[
                    (locator["source_file_sha256"], locator["relative_path_sha256"], locator["source_row_1based"])
                ].add(split)
            for locator in norm_matches:
                normalized_locator_splits[
                    (locator["source_file_sha256"], locator["relative_path_sha256"], locator["source_row_1based"])
                ].add(split)
            result = {
                "candidate_line_sha256": sha256_bytes(line.rstrip("\r\n").encode()),
                "candidate_row_number_1based": row_number,
                "exact_match_status": exact_status,
                "exact_upstream_matches": matches,
                "normalized_match_status": norm_status,
                "normalized_upstream_matches": norm_matches,
                "split": split,
            }
            sidecar.write(json.dumps(result, ensure_ascii=True, sort_keys=True) + "\n")
            rows += 1
    return statuses, norm_statuses, split_counts, locator_splits, normalized_locator_splits, rows


def main() -> int:
    source_files = validate_inputs()
    exact, norm, source_manifest, input_rows, output_rows, snapshot_file_count, indexed_source_file_sha256 = (
        build_source_indexes(source_files)
    )
    splits, manifest_rows = load_split_map()
    statuses, norm_statuses, split_counts, locator_splits, normalized_locator_splits, rows = build_candidate_sidecar(
        exact, norm, splits
    )
    if (
        manifest_rows != 190244
        or rows != 1415
        or input_rows != 3512
        or output_rows != 3508
        or len(source_manifest) != 2
    ):
        raise SystemExit("v4 manifest, family, or source input count differs from the audited snapshot")
    if sum(len(value) > 1 for value in locator_splits.values()) != 0:
        raise SystemExit("exact source locator crosses v4 splits")
    result = {
        "adapter_sha256": sha256_bytes(
            (ROOT / "ai/sourcing/dataset_adapters/counseling_conversations_adapter.py").read_bytes()
        ),
        "candidate_sha256": sha256_bytes(CANDIDATE.read_bytes()),
        "family_rows": rows,
        "family_split_counts": dict(sorted(split_counts.items())),
        "manifest_rows": manifest_rows,
        "normalization": "Unicode NFKC, case-fold, collapse whitespace",
        "upstream_revision": UPSTREAM_REVISION,
        "upstream_file": UPSTREAM_FILE,
        "upstream_git_blob_sha1": UPSTREAM_GIT_BLOB_SHA1,
        "indexed_source_file_sha256": indexed_source_file_sha256,
        "duplicate_serialization_policy": "combined_dataset.jsonl was verified as the same ordered record sequence and was excluded as a redundant source locator view",
        "normalized_status_counts": dict(sorted(norm_statuses.items())),
        "raw_source_remote": SOURCE_REMOTE,
        "audit_recomputed_at_utc": datetime.now(UTC).isoformat(),
        "results": {
            "adapter_output_records": output_rows,
            "exact_status_counts": dict(sorted(statuses.items())),
            "exact_source_locator_cross_split_count": sum(len(value) > 1 for value in locator_splits.values()),
            "normalized_source_locator_cross_split_count": sum(
                len(value) > 1 for value in normalized_locator_splits.values()
            ),
            "input_source_rows": input_rows,
            "snapshot_object_count": snapshot_file_count,
            "raw_source_file_count": len(source_manifest),
            "source_file_bytes": sum(row["bytes"] for row in source_manifest),
            "source_files_manifest_sha256": sha256_bytes(
                json.dumps(source_manifest, sort_keys=True, separators=(",", ":")).encode()
            ),
        },
        "sidecar": {"path": str(SIDECAR.relative_to(ROOT)), "rows": rows, "sha256": sha256_bytes(SIDECAR.read_bytes())},
        "status": "hash_only_exact_and_normalized_adapter_turn_binding",
        "warnings": [
            "The R2 objects lack an acquisition receipt, but combined_dataset.json bytes match the pinned upstream Git blob.",
            "Content correspondence does not establish rights, consent, clinical suitability, or provider-transfer authorization.",
        ],
    }
    with REPORT.open("w", encoding="utf-8") as stream:
        os.chmod(REPORT, 0o600)
        json.dump(result, stream, indent=2, sort_keys=True)
        stream.write("\n")
    print(json.dumps(result, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
