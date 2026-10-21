#!/usr/bin/env python3
"""Hash-only exact-turn binding for the frozen v4 PsychEval source family.

The raw Chinese source text is read locally and never printed or copied into
the report. Row locators and source file hashes are stored under the private
mode-0700 provenance directory.
"""

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
from ai.sourcing.dataset_adapters.psycheval_adapter import PsychEvalAdapter

DATA_ROOT = ROOT / "ai/data/curated/recovery/gold-20261017"
SOURCE_ROOT = DATA_ROOT / "private-source-origin-binding-20261019/psycheval-upstream"
PRIVATE_ROOT = DATA_ROOT / "private-source-origin-binding-20261019"
SIDECAR = PRIVATE_ROOT / "bindings/psycheval-v4-upstream-rowrefs.jsonl"
REPORT = PRIVATE_ROOT / "bindings/psycheval-v4-upstream-rowrefs-report.json"
MANIFEST = DATA_ROOT / "wandb-full-corpus-current-master-20261019-v4/manifest_internal.jsonl"
CANDIDATE = ROOT / "ai/data/curated/sft_chatml/train_master_gold.jsonl"
SOURCE_REMOTE = "r2:pixel-archive/whitebat/training/pixelated-empathy/output/psycheval/raw/PsychEval/data/"


def digest_file(path: Path) -> tuple[int, str]:
    h = hashlib.sha256()
    size = 0
    with path.open("rb") as stream:
        while chunk := stream.read(1024 * 1024):
            size += len(chunk)
            h.update(chunk)
    return size, h.hexdigest()


def turns(messages: list[dict[str, Any]]) -> tuple[tuple[str, str], ...]:
    return tuple((m["role"], m["content"]) for m in messages if m.get("role") != "system")


def normalized(messages: list[dict[str, Any]]) -> tuple[tuple[str, str], ...]:
    return tuple(
        (role, " ".join(unicodedata.normalize("NFKC", text).casefold().split())) for role, text in turns(messages)
    )


def validate_inputs() -> list[Path]:
    if PRIVATE_ROOT.stat().st_mode & 0o777 != 0o700:
        raise SystemExit("private provenance root must be mode 0700")
    if SOURCE_ROOT.stat().st_mode & 0o777 != 0o700:
        raise SystemExit("private raw source root must be mode 0700")
    source_files = sorted(
        file_path
        for modality_dir in SOURCE_ROOT.iterdir()
        if modality_dir.is_dir()
        for file_path in modality_dir.glob("*.json")
    )
    if len(source_files) != 369:
        raise SystemExit(f"expected 369 modality JSON files, found {len(source_files)}")
    return source_files


def build_source_indexes(
    source_files: list[Path],
) -> tuple[dict[Any, list[dict[str, Any]]], dict[Any, list[dict[str, Any]]], list[dict[str, Any]], int]:
    exact: dict[tuple[tuple[str, str], ...], list[dict[str, Any]]] = defaultdict(list)
    norm: dict[tuple[tuple[str, str], ...], list[dict[str, Any]]] = defaultdict(list)
    source_file_manifest: list[dict[str, Any]] = []
    adapter_records = 0

    with tempfile.TemporaryDirectory(prefix="psycheval-origin-") as temp_name:
        temp = Path(temp_name)
        os.chmod(temp, 0o700)
        adapter = PsychEvalAdapter("psycheval", temp)
        source_link = adapter._raw_dir / "PsychEval" / "data"
        source_link.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        source_link.symlink_to(SOURCE_ROOT, target_is_directory=True)
        for path in source_files:
            size, source_hash = digest_file(path)
            relative = path.relative_to(SOURCE_ROOT).as_posix()
            relative_hash = hashlib.sha256(relative.encode()).hexdigest()
            source_file_manifest.append(
                {
                    "bytes": size,
                    "relative_path_sha256": relative_hash,
                    "sha256": source_hash,
                }
            )
            entry = json.loads(path.read_text(encoding="utf-8"))
            entry["_source_file"] = relative
            entry["_modality"] = path.parent.name
            projected = adapter.convert_to_chatml([entry])
            for output_index, record in enumerate(projected, start=1):
                sequence = turns(record["messages"])
                locator = {
                    "adapter_output_record_1based": output_index,
                    "modality": path.parent.name,
                    "relative_path_sha256": relative_hash,
                    "source_file_sha256": source_hash,
                }
                exact[sequence].append(locator)
                norm[normalized(record["messages"])].append(locator)
                adapter_records += 1
    return exact, norm, source_file_manifest, adapter_records


def load_split_map() -> tuple[dict[int, str], int]:
    split_by_row: dict[int, str] = {}
    manifest_count = 0
    with MANIFEST.open(encoding="utf-8") as stream:
        for line in stream:
            row = json.loads(line)
            manifest_count += 1
            if row.get("source_label") == "psycheval":
                split_by_row[row["candidate_row_number_1based"]] = row["split"]
    return split_by_row, manifest_count


def build_candidate_sidecar(
    exact: dict[Any, list[dict[str, Any]]],
    norm: dict[Any, list[dict[str, Any]]],
    split_by_row: dict[int, str],
) -> tuple[Counter[str], Counter[str], Counter[str], dict[tuple[str, str, int], set[str]], int]:
    status_counts: Counter[str] = Counter()
    norm_status_counts: Counter[str] = Counter()
    sidecar_rows = 0
    locator_splits: dict[tuple[str, str, int], set[str]] = defaultdict(set)
    split_candidates: Counter[str] = Counter()
    with SIDECAR.open("w", encoding="utf-8") as sidecar, CANDIDATE.open(encoding="utf-8") as candidate:
        os.chmod(SIDECAR, 0o600)
        for row_number, line in enumerate(candidate, start=1):
            line_bytes = line.rstrip("\r\n").encode("utf-8")
            if row_number not in split_by_row:
                continue
            row = json.loads(line)
            if row.get("source") != "psycheval":
                raise SystemExit("manifest source label and candidate source disagree")
            seq = turns(row.get("messages", []))
            matches = exact.get(seq, [])
            norm_matches = norm.get(normalized(row.get("messages", [])), [])
            exact_status = "unmatched" if not matches else "unique" if len(matches) == 1 else "ambiguous"
            norm_status = "unmatched" if not norm_matches else "unique" if len(norm_matches) == 1 else "ambiguous"
            status_counts[exact_status] += 1
            norm_status_counts[norm_status] += 1
            split_candidates[split_by_row[row_number]] += 1
            for match in matches:
                locator_splits[
                    (match["source_file_sha256"], match["relative_path_sha256"], match["adapter_output_record_1based"])
                ].add(split_by_row[row_number])
            record = {
                "candidate_line_sha256": hashlib.sha256(line_bytes).hexdigest(),
                "candidate_row_number_1based": row_number,
                "exact_match_status": exact_status,
                "exact_upstream_matches": matches,
                "normalized_match_status": norm_status,
                "normalized_upstream_matches": norm_matches,
                "split": split_by_row[row_number],
            }
            sidecar.write(json.dumps(record, ensure_ascii=True, sort_keys=True) + "\n")
            sidecar_rows += 1
    return status_counts, norm_status_counts, split_candidates, locator_splits, sidecar_rows


def validate_binding(
    manifest_count: int,
    sidecar_rows: int,
    status_counts: Counter[str],
    norm_status_counts: Counter[str],
    locator_splits: dict[tuple[str, str, int], set[str]],
) -> None:
    if manifest_count != 190244 or sidecar_rows != 1977:
        raise SystemExit("candidate or source-family row count differs from frozen v4")
    if status_counts != Counter({"unique": 1968, "unmatched": 9}):
        raise SystemExit("exact-match totals differ from the audited v4 source family")
    if norm_status_counts != Counter({"unique": 1977}):
        raise SystemExit("normalized-match totals differ from the audited v4 source family")
    if any(len(splits) > 1 for splits in locator_splits.values()):
        raise SystemExit("an exact source locator crosses v4 splits")


def main() -> int:
    source_files = validate_inputs()
    exact, norm, source_file_manifest, adapter_records = build_source_indexes(source_files)
    split_by_row, manifest_count = load_split_map()
    status_counts, norm_status_counts, split_candidates, locator_splits, sidecar_rows = build_candidate_sidecar(
        exact, norm, split_by_row
    )
    validate_binding(manifest_count, sidecar_rows, status_counts, norm_status_counts, locator_splits)
    result = {
        "adapter_sha256": digest_file(ROOT / "ai/sourcing/dataset_adapters/psycheval_adapter.py")[1],
        "candidate_sha256": digest_file(CANDIDATE)[1],
        "candidate_rows": sum(1 for _ in CANDIDATE.open(encoding="utf-8")),
        "family_rows": sidecar_rows,
        "family_split_counts": dict(sorted(split_candidates.items())),
        "manifest_rows": manifest_count,
        "normalized_status_counts": dict(sorted(norm_status_counts.items())),
        "raw_source_remote": SOURCE_REMOTE,
        "raw_snapshot_retrieved_at_utc": datetime.now(UTC).isoformat(),
        "results": {
            "adapter_output_records": adapter_records,
            "exact_status_counts": dict(sorted(status_counts.items())),
            "exact_source_locators_crossing_splits": sum(len(splits) > 1 for splits in locator_splits.values()),
            "exact_unique_source_locators": sum(len(splits) > 0 for splits in locator_splits.values()),
            "source_files": len(source_file_manifest),
            "source_file_bytes": sum(x["bytes"] for x in source_file_manifest),
            "source_files_manifest_sha256": hashlib.sha256(
                json.dumps(source_file_manifest, sort_keys=True, separators=(",", ":")).encode()
            ).hexdigest(),
        },
        "sidecar": {"path": str(SIDECAR.relative_to(ROOT)), "rows": sidecar_rows, "sha256": digest_file(SIDECAR)[1]},
        "status": "hash_only_exact_and_normalized_adapter_turn_binding",
        "warnings": [
            "Object-store snapshot has no immutable upstream commit/version recorded.",
            "Exact message correspondence does not establish dataset rights, consent, clinical suitability, or provider-transfer authorization.",
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
