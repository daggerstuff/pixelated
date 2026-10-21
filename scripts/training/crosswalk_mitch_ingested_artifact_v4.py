#!/usr/bin/env python3
"""Build a private hash-only crosswalk to the dated Mitch ingestion artifact."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from collections import defaultdict
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
RELEASE = ROOT / "ai/data/curated/recovery/gold-20261017/wandb-full-corpus-current-master-20261019-v4-preserve-system"
BINDINGS = ROOT / "ai/data/curated/recovery/gold-20261017/private-source-origin-binding-20261019/bindings"
REPORT = BINDINGS / "mitch-hamidi-bpd-nlp-v4-origin-binding-report.json"
ROWREFS = BINDINGS / "mitch-hamidi-bpd-nlp-v4-upstream-rowrefs.jsonl"
DEFAULT_INGESTED = ROOT / "ai/training/output/mitch_ingest_private_20261020/ingested.jsonl"
DEFAULT_INGEST_MANIFEST = ROOT / "ai/training/output/mitch_ingest_private_20261020/manifest.json"
DEFAULT_OUTPUT = ROOT / "ai/training/output/mitch_ingest_private_20261020/v4-crosswalk.jsonl"
DEFAULT_SUMMARY = ROOT / "ai/training/output/mitch_ingest_private_20261020/v4-crosswalk-summary.json"
COMMIT = "5867af435d9d667ae769058f893e3b35ea9f7496"
INGEST_SHA256 = "2f89269d3993a434e4cd2ae655b5d08fb3e3ca4dc9c90f8e8542997925e6585a"
INGEST_MANIFEST_SHA256 = "27ece0f65e8481789ede8bc7d49b4aad3103524c83159da7c536479212817db9"


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def projected_messages(row: dict[str, Any], basename: str) -> list[dict[str, str]] | None:
    stem = Path(basename).stem
    category = stem.replace("_comments", "").replace("_search", "")
    if stem.endswith("_comments"):
        comment = (row.get("Comment") or "").strip()
        if not comment:
            return None
        post = (row.get("Post") or "").strip()
        user_content = post if post else f"[{category} discussion]"
        return [{"role": "user", "content": user_content}, {"role": "assistant", "content": comment}]
    title = (row.get("Title") or "").strip()
    body = (row.get("Post Text") or "").strip()
    if not title and not body:
        return None
    user_content = f"{title}\n\n{body}" if title and body else title or body
    assistant = f"[Community discussion about {category}]"
    return [{"role": "user", "content": user_content}, {"role": "assistant", "content": assistant}]


def projected_hash(messages: list[dict[str, str]]) -> str:
    encoded = json.dumps(messages, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def load_candidate_rows() -> tuple[list[dict[str, Any]], dict[str, Any]]:
    release = json.loads((RELEASE / "manifest.json").read_text(encoding="utf-8"))
    report = json.loads(REPORT.read_text(encoding="utf-8"))
    rows = [json.loads(line) for line in ROWREFS.read_text(encoding="utf-8").splitlines()]
    if len(rows) != report.get("family_rows") or len(rows) != 13_890:
        raise ValueError("candidate origin rowref count does not match the checked report")
    if release.get("source_candidate_sha256") != report.get("candidate_sha256"):
        raise ValueError("candidate release and origin report hashes disagree")
    if report.get("revision") != COMMIT:
        raise ValueError("pinned source revision differs from the expected public commit")
    return rows, report


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ingested", type=Path, default=DEFAULT_INGESTED)
    parser.add_argument("--ingest-manifest", type=Path, default=DEFAULT_INGEST_MANIFEST)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--summary", type=Path, default=DEFAULT_SUMMARY)
    args = parser.parse_args()
    if sha256_file(args.ingested) != INGEST_SHA256:
        raise ValueError("dated ingestion artifact SHA-256 mismatch")
    if sha256_file(args.ingest_manifest) != INGEST_MANIFEST_SHA256:
        raise ValueError("dated ingestion manifest SHA-256 mismatch")
    ingest_manifest = json.loads(args.ingest_manifest.read_text(encoding="utf-8"))
    if (
        ingest_manifest.get("run_id") != "b28ed64046b5"
        or ingest_manifest.get("stats", {}).get("raw_records") != 381_737
    ):
        raise ValueError("ingestion manifest run ID or row count mismatch")

    # Match on full adapter-projected user/assistant message pairs, keyed only by hashes.
    artifact_matches: dict[str, list[dict[str, Any]]] = defaultdict(list)
    artifact_rows = 0
    with args.ingested.open(encoding="utf-8") as stream:
        for line_number, line in enumerate(stream, start=1):
            row = json.loads(line)
            artifact_rows += 1
            basename = Path(row.get("_source_file", "")).name
            messages = projected_messages(row, basename)
            if messages is None:
                continue
            artifact_matches[projected_hash(messages)].append(
                {"source_file_basename": basename, "artifact_line_ordinal": line_number}
            )
    if artifact_rows != ingest_manifest["stats"]["raw_records"]:
        raise ValueError("ingestion artifact line count does not match its manifest")

    candidate_rows, origin_report = load_candidate_rows()
    pinned_files = set(origin_report["upstream_files"])
    counts: dict[str, int] = defaultdict(int)
    output_lines = []
    unique_lines = set()
    for candidate in candidate_rows:
        matches = artifact_matches.get(candidate["candidate_messages_sha256"], [])
        matches = sorted(matches, key=lambda match: (match["source_file_basename"], match["artifact_line_ordinal"]))
        pinned_matches = [match for match in matches if match["source_file_basename"] in pinned_files]
        counts["candidate_rows"] += 1
        counts["rows_with_any_artifact_match"] += bool(matches)
        counts["rows_with_pinned_file_match"] += bool(pinned_matches)
        counts["rows_with_one_pinned_line"] += len(pinned_matches) == 1
        counts["rows_with_multiple_pinned_lines"] += len(pinned_matches) > 1
        counts["pinned_line_alternatives"] += len(pinned_matches)
        counts["rows_with_other_file_only"] += bool(matches) and not bool(pinned_matches)
        unique_lines.update((match["source_file_basename"], match["artifact_line_ordinal"]) for match in pinned_matches)
        output_lines.append(
            json.dumps(
                {
                    "candidate_row_sha256": candidate["candidate_row_sha256"],
                    "candidate_messages_sha256": candidate["candidate_messages_sha256"],
                    "split": candidate["split"],
                    "candidate_family_row_1based": candidate["candidate_row_number_1based"],
                    "existing_source_match_status": candidate["match_status"],
                    "ingested_artifact_matches": matches,
                    "pinned_commit_file_matches": pinned_matches,
                },
                sort_keys=True,
                separators=(",", ":"),
            )
        )

    args.output.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    os.chmod(args.output.parent, 0o700)
    args.output.write_text("\n".join(output_lines) + "\n", encoding="utf-8")
    os.chmod(args.output, 0o600)
    summary = {
        "schema_version": 1,
        "observed_at_utc": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
        "candidate_sha256": origin_report["candidate_sha256"],
        "origin_report_sha256": sha256_file(REPORT),
        "origin_rowrefs_sha256": sha256_file(ROWREFS),
        "pinned_public_repo": "mitch-hamidi/may-2024-mental-health-nlp",
        "pinned_public_commit": COMMIT,
        "ingestion_artifact": {
            "r2_key": "whitebat/training/pixelated-empathy/output/mitch_hamidi_bpd_nlp/output/mitch_hamidi_bpd_nlp_ingested.jsonl",
            "sha256": INGEST_SHA256,
            "bytes": args.ingested.stat().st_size,
            "rows": artifact_rows,
            "manifest_sha256": INGEST_MANIFEST_SHA256,
            "run_id": ingest_manifest["run_id"],
        },
        "crosswalk_method": (
            "Exact full role/content SHA-256 of the checked adapter projection for each source row; "
            "all matching artifact line ordinals retained. No text content exported."
        ),
        "counts": dict(counts),
        "unique_pinned_artifact_lines": len(unique_lines),
        "sidecar": {
            "path": str(args.output.relative_to(ROOT)),
            "rows": len(output_lines),
            "sha256": sha256_file(args.output),
        },
        "interpretation": (
            "Proves that adapter-projected rows are present in the dated R2 ingestion artifact and records "
            "all matching line positions. It does not prove that this artifact fed the v4 candidate build, "
            "and does not resolve rights, privacy, consent, or provider-transfer status."
        ),
    }
    args.summary.write_text(json.dumps(summary, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    os.chmod(args.summary, 0o600)
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
