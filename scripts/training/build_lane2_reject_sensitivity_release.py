#!/usr/bin/env python3
"""Build a private v4 sensitivity release excluding latest ARC lane-2 rejects.

The output is a comparison variant only. It does not replace v4, establish
that the original reviewers saw these exact content revisions, or open upload.
"""

from __future__ import annotations

import hashlib
import json
from collections import Counter
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
RECOVERY = ROOT / "ai/data/curated/recovery/gold-20261017"
SOURCE = RECOVERY / "wandb-full-corpus-current-master-20261019-v4"
SOURCE_MANIFEST = ROOT / "docs/training/execution-2026-10-19/wandb-full-corpus-current-master-20261019-v4.json"
LANE2_REPORT = RECOVERY / "private-lane2-current-content-attachment-20261020/report.json"
LANE2_SIDECAR = RECOVERY / "private-lane2-current-content-attachment-20261020/lane2-current-content-attachment.jsonl"
OUTPUT = RECOVERY / "wandb-full-corpus-lane2-reject-sensitivity-20261020-v1"
PUBLIC_REPORT = ROOT / "docs/training/execution-2026-10-19/lane2-reject-sensitivity-release-2026-10-20.md"
SPLITS = ("train", "validation", "test")


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def canonical_messages_hash(messages: list[dict[str, Any]]) -> str:
    payload = json.dumps(messages, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return sha256_bytes(payload.encode("utf-8"))


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def check_source_manifest() -> dict[str, Any]:
    manifest = json.loads(SOURCE_MANIFEST.read_text(encoding="utf-8"))
    if manifest["release_id"] != "wandb-full-corpus-current-master-20261019-v4":
        raise RuntimeError("unexpected source release id")
    if manifest["source_candidate_sha256"] != "f56e10b52ed83645ec3eca1b468724644dcbf6f843da96d7e82b5b4ef47bc349":
        raise RuntimeError("source candidate digest changed")
    if sha256_file(SOURCE_MANIFEST) != "a4b0507ff6447644d022e28b1ada91daefa0139f23f8800ae953a0fa9ab5cdb8":
        raise RuntimeError("source release manifest digest changed")
    if manifest.get("upload_gate") is not True:
        raise RuntimeError("source release is no longer authorized for the existing experiment")
    for split, details in manifest["partitions"].items():
        path = ROOT / details["path"]
        if sha256_file(path) != details["sha256"]:
            raise RuntimeError(f"frozen source payload hash changed for {split}")
    internal = manifest["internal_manifest"]
    if sha256_file(ROOT / internal["path"]) != internal["sha256"]:
        raise RuntimeError("frozen source internal manifest hash changed")
    repairs = manifest["repairs"]
    if sha256_file(ROOT / repairs["path"]) != repairs["sha256"]:
        raise RuntimeError("frozen repair input hash changed")
    return manifest


def load_exclusion_rows() -> tuple[set[int], dict[str, Any]]:
    report = json.loads(LANE2_REPORT.read_text(encoding="utf-8"))
    rows = read_jsonl(LANE2_SIDECAR)
    if sha256_file(LANE2_SIDECAR) != report["sidecar"]["sha256"]:
        raise RuntimeError("lane-2 sidecar digest differs from its report")
    excluded = [row for row in rows if row["review_verdict"] == "reject"]
    if len(excluded) != report["rejected_candidate_rows_with_machine_accept"]:
        raise RuntimeError("lane-2 reject row count differs from its audit report")
    row_numbers = [int(row["candidate_row_number_1based"]) for row in excluded]
    if len(row_numbers) != len(set(row_numbers)):
        raise RuntimeError("lane-2 reject row references are duplicated")
    return set(row_numbers), report


def load_and_verify_internal_rows() -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    internal = read_jsonl(SOURCE / "manifest_internal.jsonl")
    rowrefs = read_jsonl(SOURCE / "rowrefs.jsonl")
    if len(internal) != 190244 or len(rowrefs) != 190244:
        raise RuntimeError("unexpected source metadata row count")
    for i, (meta, ref) in enumerate(zip(internal, rowrefs, strict=True), start=1):
        if meta["candidate_row_number_1based"] != ref["candidate_row_number_1based"]:
            raise RuntimeError(f"candidate row order differs at source row {i}")
        for meta_field, ref_field in (
            ("candidate_row_sha256", "candidate_row_sha256"),
            ("content_group_sha256", "content_group_sha256"),
            ("split", "provisional_split"),
        ):
            if meta[meta_field] != ref[ref_field]:
                raise RuntimeError(f"source metadata differs at row {i}: {meta_field}")
    return internal, rowrefs


def verify_candidate_rows(
    internal: list[dict[str, Any]], exclude: set[int], source_manifest: dict[str, Any]
) -> dict[int, str]:
    candidate = ROOT / "ai/data/curated/sft_chatml/train_master_gold.jsonl"
    repair_path = ROOT / source_manifest["repairs"]["path"]
    repairs = {int(row["candidate_row_number_1based"]): row for row in read_jsonl(repair_path)}
    candidate_hashes: dict[int, str] = {}
    with candidate.open("rb") as stream:
        for row_number, raw in enumerate(stream, start=1):
            if row_number > len(internal):
                raise RuntimeError("candidate has more rows than the frozen source release")
            record = json.loads(raw)
            digest = sha256_bytes(raw.rstrip(b"\n"))
            if internal[row_number - 1]["candidate_row_sha256"] != digest:
                raise RuntimeError(f"candidate row hash mismatch at row {row_number}")
            repair = repairs.get(row_number)
            if repair is not None and repair["candidate_row_sha256"] != digest:
                raise RuntimeError(f"repair lineage hash mismatch at row {row_number}")
            candidate_hashes[row_number] = canonical_messages_hash(record["messages"])
    if len(candidate_hashes) != len(internal):
        raise RuntimeError("candidate row count differs from source release")

    lane2_rows = read_jsonl(LANE2_SIDECAR)
    for row in lane2_rows:
        number = int(row["candidate_row_number_1based"])
        if internal[number - 1]["candidate_row_sha256"] != row["candidate_row_sha256"]:
            raise RuntimeError("candidate row hash differs from the ARC lane-2 hash attachment")
        if row["review_verdict"] == "reject" and candidate_hashes[number] != row["messages_sha256"]:
            raise RuntimeError("current candidate messages differ from the ARC lane-2 hash attachment")
        if row["review_verdict"] == "reject" and internal[number - 1]["split"] != row["split"]:
            raise RuntimeError("lane-2 split label differs from the source manifest")
    if any(number < 1 or number > len(internal) for number in exclude):
        raise RuntimeError("lane-2 exclusion row is outside the candidate")
    return candidate_hashes


def write_variant(internal: list[dict[str, Any]], rowrefs: list[dict[str, Any]], exclude: set[int]) -> dict[str, Any]:
    if OUTPUT.exists():
        entries = list(OUTPUT.iterdir())
        if any(path.stat().st_size for path in entries if path.is_file()) or any(path.is_dir() for path in entries):
            raise RuntimeError("sensitivity output exists with data; refusing to overwrite it")
        for path in entries:
            path.unlink()
        OUTPUT.rmdir()
    OUTPUT.mkdir(mode=0o700, parents=True)
    groups: dict[str, set[str]] = {split: set() for split in SPLITS}
    counts: Counter[str] = Counter()
    removed: Counter[str] = Counter()
    payloads = {}

    for split in SPLITS:
        meta_rows = [row for row in internal if row["split"] == split]
        ref_rows = [row for row in rowrefs if row["provisional_split"] == split]
        if len(meta_rows) != len(ref_rows):
            raise RuntimeError(f"rowref count mismatch for {split}")
        payload_path = OUTPUT / f"{split}.jsonl"
        internal_path = OUTPUT / f"{split}-manifest_internal.jsonl"
        refs_path = OUTPUT / f"{split}-rowrefs.jsonl"
        payload_hash = hashlib.sha256()
        out_internal_hash = hashlib.sha256()
        out_refs_hash = hashlib.sha256()
        with (
            (SOURCE / f"{split}.jsonl").open("rb") as source_stream,
            payload_path.open("wb") as payload_out,
            internal_path.open("wb") as internal_out,
            refs_path.open("wb") as refs_out,
        ):
            for raw, meta, ref in zip(source_stream, meta_rows, ref_rows, strict=True):
                row_number = int(meta["candidate_row_number_1based"])
                item = json.loads(raw)
                if canonical_messages_hash(item["messages"]) != meta["content_group_sha256"]:
                    raise RuntimeError(f"training payload differs from frozen release lineage at row {row_number}")
                if row_number in exclude:
                    removed[split] += 1
                    continue
                payload_out.write(raw)
                payload_hash.update(raw)
                groups[split].add(str(meta["content_group_sha256"]))
                counts[split] += 1
                internal_line = (json.dumps(meta, ensure_ascii=False, separators=(",", ":")) + "\n").encode()
                ref_line = (json.dumps(ref, ensure_ascii=False, separators=(",", ":")) + "\n").encode()
                internal_out.write(internal_line)
                refs_out.write(ref_line)
                out_internal_hash.update(internal_line)
                out_refs_hash.update(ref_line)
        for path in (payload_path, internal_path, refs_path):
            path.chmod(0o600)
        payloads[split] = {
            "path": payload_path.name,
            "rows": counts[split],
            "sha256": payload_hash.hexdigest(),
            "bytes": payload_path.stat().st_size,
            "internal_manifest": {"path": internal_path.name, "sha256": out_internal_hash.hexdigest()},
            "rowrefs": {"path": refs_path.name, "sha256": out_refs_hash.hexdigest()},
        }

    cross = {
        f"{left}:{right}": len(groups[left] & groups[right])
        for i, left in enumerate(SPLITS)
        for right in SPLITS[i + 1 :]
    }
    if any(cross.values()):
        raise RuntimeError(f"filtered release has cross-split groups: {cross}")

    empty_heldout = OUTPUT / "heldout.jsonl"
    empty_heldout.write_bytes(b"")
    empty_heldout.chmod(0o600)
    return {
        "split_payloads": payloads,
        "split_counts": dict(counts),
        "excluded_rows_by_split": dict(removed),
        "cross_split_content_group_intersections": cross,
        "source_candidate_row_count": len(internal),
        "retained_candidate_row_count": sum(counts.values()),
        "excluded_candidate_row_count": sum(removed.values()),
    }


def main() -> None:
    source_manifest = check_source_manifest()
    exclude, lane2_report = load_exclusion_rows()
    internal, rowrefs = load_and_verify_internal_rows()
    verify_candidate_rows(internal, exclude, source_manifest)
    build = write_variant(internal, rowrefs, exclude)
    release_manifest = {
        "schema_version": 1,
        "release_id": "wandb-full-corpus-lane2-reject-sensitivity-20261020-v1",
        "status": "local_research_sensitivity_only",
        "upload_gate": False,
        "source_release_id": source_manifest["release_id"],
        "source_release_manifest_sha256": sha256_file(SOURCE_MANIFEST),
        "source_candidate_sha256": source_manifest["source_candidate_sha256"],
        "lane2_hash_attachment_report_sha256": sha256_file(LANE2_REPORT),
        "lane2_hash_attachment_sidecar_sha256": lane2_report["sidecar"]["sha256"],
        "exclusion_rule": "Remove current-v4 ARC candidate rows whose latest ARC-ID-keyed lane-2 decision is reject; treat as a sensitivity ablation because original review revisions are not pinned.",
        "exclusions": {
            "rows": build["excluded_candidate_row_count"],
            "by_split": build["excluded_rows_by_split"],
            "current_candidate_row_hashes": "listed in private split rowrefs and cross-referenceable to the lane-2 hash attachment",
        },
        "retained_rows": build["retained_candidate_row_count"],
        "split_counts": build["split_counts"],
        "split_payloads": build["split_payloads"],
        "cross_split_content_group_intersections": build["cross_split_content_group_intersections"],
        "limitations": [
            "This local sensitivity variant does not replace the user-directed v4 baseline release.",
            "The historical lane-2 decisions lack explicit reviewed content hashes; this ablation tests the effect of applying the current ARC-ID joins, not the correctness of those joins.",
            "No provider upload, training job, candidate edit, or source dataset edit is performed.",
        ],
    }
    manifest_path = OUTPUT / "release-manifest.json"
    manifest_path.write_text(json.dumps(release_manifest, indent=2) + "\n", encoding="utf-8")
    manifest_path.chmod(0o600)
    release_manifest["release_manifest_sha256"] = sha256_file(manifest_path)
    summary_path = OUTPUT / "build-summary.json"
    summary_path.write_text(
        json.dumps({**build, "release_manifest_sha256": release_manifest["release_manifest_sha256"]}, indent=2) + "\n",
        encoding="utf-8",
    )
    summary_path.chmod(0o600)
    OUTPUT.chmod(0o700)
    PUBLIC_REPORT.write_text(
        "# Lane-2 reject sensitivity dataset — 2026-10-20\n\n"
        "Built a separate private, local-only sensitivity variant from the immutable W&B v4 release by removing rows associated with the latest lane-2 `reject` decisions. This directly tests how those ARC-ID joins affect the experiment while preserving the original full-corpus release as the baseline. The review artifacts still do not identify the exact revision reviewers saw, so this is an ablation, not an adjudicated clean corpus.\n\n"
        f"The variant retains {build['retained_candidate_row_count']:,} of {build['source_candidate_row_count']:,} rows and excludes {build['excluded_candidate_row_count']} rows: {build['excluded_rows_by_split']}. Its train/validation/test payloads were aligned row-for-row to the source candidate by exact candidate row hashes and canonical message hashes. All split content-group intersections are zero.\n\n"
        "The release is mode 0700 with payload/manifests mode 0600. Its manifest sets `upload_gate=false`; no provider upload or job was made. Files are under `ai/data/curated/recovery/gold-20261017/wandb-full-corpus-lane2-reject-sensitivity-20261020-v1/`.\n",
        encoding="utf-8",
    )
    print(
        json.dumps(
            {
                "release_id": release_manifest["release_id"],
                "retained_rows": build["retained_candidate_row_count"],
                "excluded_rows_by_split": build["excluded_rows_by_split"],
                "split_counts": build["split_counts"],
                "cross_split_content_group_intersections": build["cross_split_content_group_intersections"],
                "upload_gate": False,
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
