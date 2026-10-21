#!/usr/bin/env python3
"""Refine ambiguous v4 book-row joins to exact local source-file locators.

The audit never writes dialogue text. Its private sidecar records source paths,
file hashes, and line numbers for the 18 rows that had ambiguous source-row
matches. A unique file match narrows local provenance but does not establish an
upstream edition, acquisition history, rights, or training permission.
"""

from __future__ import annotations

import hashlib
import json
import os
from collections import defaultdict
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
PRIVATE = ROOT / "ai/data/curated/recovery/gold-20261017/private-source-origin-binding-20261019/bindings"
DEFAULT_GAP = PRIVATE / "v4-untransferred-source-binding-gap-20261020.jsonl"
DEFAULT_SOURCE_REFS = PRIVATE / "clinical-books-local-exact-origin-v4-rowrefs.jsonl"
DEFAULT_CANDIDATE = ROOT / "ai/data/curated/sft_chatml/train_master_gold.jsonl"
DEFAULT_SOURCE_DIR = ROOT / "ai/data/curated/books_distilled"
DEFAULT_OUTPUT = PRIVATE / "clinical-book-file-origin-v4-followup-20261020.jsonl"
DEFAULT_REPORT = PRIVATE / "clinical-book-file-origin-v4-followup-20261020-report.json"


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    with path.open(encoding="utf-8") as stream:
        for line_number, line in enumerate(stream, 1):
            try:
                row = json.loads(line)
            except json.JSONDecodeError as exc:
                raise ValueError(f"invalid JSONL at {path.name}:{line_number}") from exc
            if not isinstance(row, dict):
                raise ValueError(f"non-object JSONL row at {path.name}:{line_number}")
            rows.append(row)
    return rows


def candidate_pair(row: dict[str, Any]) -> tuple[str, str]:
    messages = row.get("messages")
    if not isinstance(messages, list):
        raise ValueError("candidate row has no messages list")
    parts = [
        (message.get("role"), message.get("content"))
        for message in messages
        if isinstance(message, dict) and message.get("role") in {"user", "assistant"}
    ]
    if len(parts) != 2 or parts[0][0] != "user" or parts[1][0] != "assistant":
        raise ValueError("ambiguous book candidate is not one user/assistant pair")
    if not all(isinstance(content, str) for _, content in parts):
        raise ValueError("candidate user/assistant content is not text")
    return parts[0][1], parts[1][1]


def load_candidate_targets(
    targets: dict[int, dict[str, Any]],
) -> tuple[dict[int, tuple[dict[str, Any], tuple[str, str], str]], str]:
    candidate_rows: dict[int, tuple[dict[str, Any], tuple[str, str], str]] = {}
    candidate_digest = hashlib.sha256()
    with DEFAULT_CANDIDATE.open("rb") as stream:
        for row_number, raw in enumerate(stream, 1):
            candidate_digest.update(raw)
            if row_number not in targets:
                continue
            stripped = raw[:-1] if raw.endswith(b"\n") else raw
            row_hash = sha256_bytes(stripped)
            if row_hash != targets[row_number].get("candidate_record_sha256"):
                raise ValueError("candidate row hash disagrees with the gap sidecar")
            candidate = json.loads(stripped)
            candidate_rows[row_number] = (candidate, candidate_pair(candidate), row_hash)
    if set(candidate_rows) != set(targets):
        raise ValueError("candidate is missing one or more gap positions")
    return candidate_rows, candidate_digest.hexdigest()


def collect_file_matches(
    candidate_rows: dict[int, tuple[dict[str, Any], tuple[str, str], str]],
) -> tuple[dict[int, dict[Path, list[int]]], list[dict[str, Any]]]:
    matches: dict[int, dict[Path, list[int]]] = defaultdict(lambda: defaultdict(list))
    source_manifest = []
    source_paths = sorted(DEFAULT_SOURCE_DIR.glob("*.jsonl"))
    if len(source_paths) != 47:
        raise ValueError("local book source file count changed from the audited 47 files")
    for path in source_paths:
        relative = path.relative_to(ROOT).as_posix()
        digest = sha256_file(path)
        source_manifest.append({"path": relative, "sha256": digest, "size_bytes": path.stat().st_size})
        with path.open(encoding="utf-8") as stream:
            for line_number, line in enumerate(stream, 1):
                try:
                    row = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if not isinstance(row, dict):
                    continue
                instruction, output = row.get("instruction"), row.get("output")
                if not isinstance(instruction, str) or not isinstance(output, str):
                    continue
                pair = (instruction, output)
                for candidate_number, (_, expected_pair, _) in candidate_rows.items():
                    if pair == expected_pair:
                        matches[candidate_number][path].append(line_number)
    return matches, source_manifest


def build_sidecar_rows(
    targets: dict[int, dict[str, Any]],
    prior_refs: dict[int, dict[str, Any]],
    candidate_rows: dict[int, tuple[dict[str, Any], tuple[str, str], str]],
    matches: dict[int, dict[Path, list[int]]],
    source_manifest: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], dict[str, int]]:
    output_rows = []
    for candidate_number in sorted(targets):
        gap = targets[candidate_number]
        prior = prior_refs.get(candidate_number)
        if prior is None:
            raise ValueError("no prior source-row sidecar entry for an ambiguous candidate")
        file_matches = matches.get(candidate_number, {})
        if not file_matches:
            raise ValueError("previously matched ambiguous row has no exact local source file")
        locators = []
        for path, line_numbers in sorted(file_matches.items(), key=lambda item: item[0].as_posix()):
            locators.append(
                {
                    "path": path.relative_to(ROOT).as_posix(),
                    "file_sha256": next(
                        item["sha256"] for item in source_manifest if item["path"] == path.relative_to(ROOT).as_posix()
                    ),
                    "line_numbers": sorted(line_numbers),
                }
            )
        output_rows.append(
            {
                "candidate_row_1based": candidate_number,
                "candidate_row_sha256": candidate_rows[candidate_number][2],
                "source_label_sha256": gap["source_label_sha256"],
                "source_pair_exact_sha256": prior["source_pair_exact_sha256"],
                "prior_source_row_match_status": "exact_ambiguous",
                "file_match_status": "exact_single_local_file" if len(locators) == 1 else "exact_multiple_local_files",
                "local_source_file_matches": locators,
            }
        )

    counts = {
        "exact_single_local_file": sum(r["file_match_status"] == "exact_single_local_file" for r in output_rows),
        "exact_multiple_local_files": sum(r["file_match_status"] == "exact_multiple_local_files" for r in output_rows),
    }
    if counts != {"exact_single_local_file": 12, "exact_multiple_local_files": 6}:
        raise ValueError(f"local file-match counts differ from reviewed audit: {counts}")
    return output_rows, counts


def main() -> int:
    gap_rows = read_jsonl(DEFAULT_GAP)
    prior_refs = {row["candidate_row_1based"]: row for row in read_jsonl(DEFAULT_SOURCE_REFS)}
    targets = {row["candidate_row_1based"]: row for row in gap_rows}
    if len(targets) != len(gap_rows) or not targets:
        raise ValueError("gap sidecar has empty or duplicate candidate positions")
    candidate_rows, candidate_digest = load_candidate_targets(targets)
    matches, source_manifest = collect_file_matches(candidate_rows)
    output_rows, counts = build_sidecar_rows(targets, prior_refs, candidate_rows, matches, source_manifest)
    encoded = "".join(json.dumps(row, sort_keys=True) + "\n" for row in output_rows).encode()
    PRIVATE.mkdir(parents=True, exist_ok=True, mode=0o700)
    os.chmod(PRIVATE, 0o700)
    DEFAULT_OUTPUT.write_bytes(encoded)
    os.chmod(DEFAULT_OUTPUT, 0o600)
    report = {
        "schema": "clinical-book-file-origin-v4-followup-v1",
        "candidate_sha256": candidate_digest,
        "candidate_row_count": 190244,
        "gap_sidecar_sha256": sha256_file(DEFAULT_GAP),
        "prior_source_rowrefs_sha256": sha256_file(DEFAULT_SOURCE_REFS),
        "local_source_dir": DEFAULT_SOURCE_DIR.relative_to(ROOT).as_posix(),
        "local_source_file_count": len(source_manifest),
        "local_source_files_manifest_sha256": sha256_bytes(
            "".join(json.dumps(row, sort_keys=True) + "\n" for row in source_manifest).encode()
        ),
        "ambiguous_candidate_rows": len(output_rows),
        "file_match_counts": counts,
        "sidecar_path": DEFAULT_OUTPUT.relative_to(ROOT).as_posix(),
        "sidecar_rows": len(output_rows),
        "sidecar_sha256": sha256_bytes(encoded),
        "sidecar_mode": "0600",
        "limitations": [
            "Unique file-level correspondence does not identify a unique duplicated line.",
            "Multiple matching files remain ambiguous at file level.",
            "Local distilled-file matching does not establish original book edition, acquisition, rights, privacy, clinical suitability, or provider-transfer permission.",
            "No candidate or training payload was modified.",
        ],
    }
    report_bytes = (json.dumps(report, indent=2, sort_keys=True) + "\n").encode()
    DEFAULT_REPORT.write_bytes(report_bytes)
    os.chmod(DEFAULT_REPORT, 0o600)
    print(
        json.dumps(
            {k: report[k] for k in ("ambiguous_candidate_rows", "file_match_counts", "sidecar_sha256", "sidecar_path")},
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
