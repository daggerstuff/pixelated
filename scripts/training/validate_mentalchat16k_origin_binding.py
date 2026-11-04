#!/usr/bin/env python3
"""Revalidate the private MentalChat16K exact-turn origin sidecar.

This command reads candidate/source text only in memory. It emits aggregate
counts and hashes; it never prints message content or writes source material.
"""

from __future__ import annotations

import csv
import hashlib
import json
import os
import sys
import tempfile
from collections import defaultdict
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from ai.sourcing.dataset_adapters.mentalchat16k_adapter import MentalChat16KAdapter

DATA_ROOT = ROOT / "ai/data/curated/recovery/gold-20261017"
PRIVATE_ROOT = DATA_ROOT / "private-source-origin-binding-20261019"
SIDECAR = PRIVATE_ROOT / "bindings/mentalchat16k-candidate-upstream-rowrefs.jsonl"
MANIFEST = PRIVATE_ROOT / "bindings/manifest.json"
CANDIDATE = DATA_ROOT / "train_master_gold.recovered_candidate.jsonl"
FILES = ("Interview_Data_6K.csv", "Synthetic_Data_10K.csv")
REPO = "ShenLab/MentalChat16K"
REVISION = "5f60cd380cfc58f0f12d44892bed41ee3670a70a"


def require(condition: bool, message: str) -> None:
    if not condition:
        raise SystemExit(message)


def sha256_file(path: Path) -> tuple[int, str]:
    digest = hashlib.sha256()
    size = 0
    with path.open("rb") as stream:
        while chunk := stream.read(1024 * 1024):
            size += len(chunk)
            digest.update(chunk)
    return size, digest.hexdigest()


def sequence(messages: list[dict[str, Any]]) -> tuple[tuple[str, str], ...]:
    return tuple((message["role"], message["content"]) for message in messages if message.get("role") != "system")


def normalized(messages: list[dict[str, Any]]) -> tuple[tuple[str, str], ...]:
    return tuple((role, " ".join(content.split()).casefold()) for role, content in sequence(messages))


def locator_key(locator: dict[str, Any]) -> tuple[Any, ...]:
    return (
        locator["file"],
        locator["row_number_1based"],
        locator["repo"],
        locator["revision"],
        locator["adapter_non_system_message_count"],
    )


def match_status(count: int) -> str:
    if count == 0:
        return "unmatched"
    if count == 1:
        return "unique_upstream_row"
    return "ambiguous_upstream_rows"


def load_adapter_sequences() -> tuple[
    dict[tuple[tuple[str, str], ...], list[dict[str, Any]]],
    dict[tuple[tuple[str, str], ...], list[dict[str, Any]]],
    dict[str, dict[str, Any]],
    int,
]:
    exact: dict[tuple[tuple[str, str], ...], list[dict[str, Any]]] = defaultdict(list)
    normalized_index: dict[tuple[tuple[str, str], ...], list[dict[str, Any]]] = defaultdict(list)
    source_hashes: dict[str, dict[str, Any]] = {}
    usable_rows = 0

    with tempfile.TemporaryDirectory(prefix="mentalchat16k-origin-validation-") as temp:
        os.chmod(temp, 0o700)
        adapter = MentalChat16KAdapter("mentalchat16k", temp)
        os.chmod(adapter.output_dir, 0o700)
        os.chmod(adapter._raw_dir, 0o700)
        for filename in FILES:
            path = PRIVATE_ROOT / "mentalchat16k" / filename
            size, digest = sha256_file(path)
            source_hashes[filename] = {"bytes": size, "sha256": digest}
            with path.open(encoding="utf-8", newline="") as stream:
                for row_number, row in enumerate(csv.DictReader(stream), start=1):
                    row["_source_file"] = filename
                    projected = adapter.convert_to_chatml([row])
                    if not projected:
                        continue
                    usable_rows += 1
                    turns = sequence(projected[0]["messages"])
                    locator = {
                        "adapter_non_system_message_count": len(turns),
                        "file": filename,
                        "repo": REPO,
                        "revision": REVISION,
                        "row_number_1based": row_number,
                    }
                    # The adapter produces one user/assistant pair per source
                    # record. Index each rendered record by its full turn tuple.
                    exact[turns].append(locator)
                    normalized_index[normalized(projected[0]["messages"])].append(locator)
    return exact, normalized_index, source_hashes, usable_rows


def verify_private_inputs() -> tuple[dict[str, Any], int, str]:
    require((PRIVATE_ROOT.stat().st_mode & 0o777) == 0o700, "private source directory permissions are not 0700")
    require((SIDECAR.stat().st_mode & 0o777) == 0o600, "private sidecar permissions are not 0600")

    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    require(
        manifest["sources"]["mentalchat16k"]["repo"] == REPO
        and manifest["sources"]["mentalchat16k"]["revision"] == REVISION,
        "manifest repository or revision differs from pinned source",
    )

    candidate_bytes, candidate_hash = sha256_file(CANDIDATE)
    require(candidate_hash == manifest["candidate"]["sha256"], "candidate file hash differs from binding manifest")
    return manifest, candidate_bytes, candidate_hash


def load_recorded_sidecar() -> dict[int, dict[str, Any]]:
    recorded: dict[int, dict[str, Any]] = {}
    with SIDECAR.open(encoding="utf-8") as stream:
        for line in stream:
            entry = json.loads(line)
            recorded[entry["candidate_row_number_1based"]] = entry
    return recorded


def recompute_row_bindings(
    entry: dict[str, Any],
    turns: tuple[tuple[str, str], ...],
    normalized_turns: tuple[tuple[str, str], ...],
    exact_index: dict[tuple[tuple[str, str], ...], list[dict[str, Any]]],
    normalized_index: dict[tuple[tuple[str, str], ...], list[dict[str, Any]]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    matches = exact_index.get(turns, [])
    norm_matches = normalized_index.get(normalized_turns, [])
    old_matches = entry["exact_adapter_sequence_matches"]
    old_norm = entry["normalized_adapter_sequence_matches"]
    require(
        sorted(map(locator_key, matches)) == sorted(map(locator_key, old_matches))
        and sorted(map(locator_key, norm_matches)) == sorted(map(locator_key, old_norm)),
        "recomputed source locators differ from private sidecar",
    )
    # Verify the recorded locators themselves point to exact adapter
    # rows. The legacy window count is retained as audit metadata.
    exact_locator_keys = set(map(locator_key, matches))
    normalized_locator_keys = set(map(locator_key, norm_matches))
    for ref in old_matches:
        require(locator_key(ref) in exact_locator_keys, "exact sidecar locator does not bind to source row")
    for ref in old_norm:
        require(locator_key(ref) in normalized_locator_keys, "normalized sidecar locator does not bind to source row")
    return matches, norm_matches


def main() -> int:
    manifest, candidate_bytes, candidate_hash = verify_private_inputs()

    exact_index, normalized_index, source_hashes, usable_rows = load_adapter_sequences()
    require(
        source_hashes == manifest["sources"]["mentalchat16k"]["files"],
        "local source hashes differ from binding manifest",
    )

    recorded = load_recorded_sidecar()

    totals: dict[str, Any] = {
        "candidate_family_rows": 0,
        "exact_contiguous_sequence_matches": 0,
        "exact_full_non_system_sequence_equal_rows": 0,
        "exact_status_counts": {"unique_upstream_row": 0, "ambiguous_upstream_rows": 0, "unmatched": 0},
        "normalized_status_counts": {"unique_upstream_row": 0, "ambiguous_upstream_rows": 0, "unmatched": 0},
        "normalized_contiguous_sequence_matches": 0,
        "sidecar_rows": len(recorded),
    }
    visited: set[int] = set()
    with CANDIDATE.open(encoding="utf-8") as candidate_stream:
        for row_number, line in enumerate(candidate_stream, start=1):
            entry = recorded.get(row_number)
            if entry is None:
                continue
            row = json.loads(line)
            require(
                hashlib.sha256(line.rstrip("\r\n").encode("utf-8")).hexdigest() == entry["candidate_line_sha256"],
                "candidate row hash differs from private sidecar",
            )
            require(row.get("source") == "mentalchat16k", "sidecar row does not identify MentalChat16K")
            visited.add(row_number)
            totals["candidate_family_rows"] += 1
            turns = sequence(row.get("messages", []))
            matches, norm_matches = recompute_row_bindings(
                entry, turns, normalized(row.get("messages", [])), exact_index, normalized_index
            )
            exact_status = match_status(len(matches))
            normalized_status = match_status(len(norm_matches))
            require(
                exact_status == entry["exact_match_status"] and normalized_status == entry["normalized_match_status"],
                "recomputed match status differs from private sidecar",
            )
            totals["exact_status_counts"][exact_status] += 1
            totals["normalized_status_counts"][normalized_status] += 1
            totals["exact_contiguous_sequence_matches"] += len(matches) > 0
            totals["normalized_contiguous_sequence_matches"] += len(norm_matches) > 0
            totals["exact_full_non_system_sequence_equal_rows"] += any(
                locator["adapter_non_system_message_count"] == len(turns) for locator in matches
            )

    require(visited == set(recorded), "sidecar contains candidate row ordinals not validated")
    require(
        totals["candidate_family_rows"] == 11135 and usable_rows == 16057,
        "candidate or adapter-usable row totals differ from audit",
    )

    output = {
        "adapter_sha256": sha256_file(ROOT / "ai/sourcing/dataset_adapters/mentalchat16k_adapter.py")[1],
        "candidate": {
            "bytes": candidate_bytes,
            "rows_in_sidecar": totals["candidate_family_rows"],
            "sha256": candidate_hash,
        },
        "results": totals,
        "source_files": source_hashes,
        "source_repo": REPO,
        "source_revision": REVISION,
        "source_adapter_usable_rows": usable_rows,
        "status": "validated_hash_only_exact_turn_sequence_bindings",
    }
    print(json.dumps(output, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
