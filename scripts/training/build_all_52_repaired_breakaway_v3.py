#!/usr/bin/env python3
"""Build a private v4-derived view applying all 52 row repairs.

The two non-dialogue source records are replaced with clearly synthetic,
substantive data-quality conversations. The source candidate and original
52-row repair overlay remain immutable.
"""

from __future__ import annotations

import hashlib
import importlib.util
import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
RECOVERY = ROOT / "ai/data/curated/recovery/gold-20261017"
SOURCE_SCRIPT = ROOT / "scripts/training/build_source_quality_triage_breakaway_v4.py"
AMENDMENTS_PATH = RECOVERY / "wandb-full-corpus-repairs-20261020-v1/triage-repair-amendments.jsonl"
OUTPUT = RECOVERY / "wandb-full-corpus-repaired-breakaway-20261020-v3"
EXPECTED = {
    6142: "b8f1b4cce623d2400b59a0988d41285fcd5dfd68f87ca036fd7e6da3d52371e9",
    6146: "c215cd3780e62d3aca68a5aae2bac14ed767e28249ae9c5c4f25be0e6bf6a744",
}

AMENDMENTS: list[dict[str, Any]] = [
    {
        "candidate_row_number_1based": 6142,
        "candidate_row_sha256": EXPECTED[6142],
        "repair_kind": "synthetic_data_quality_dialogue",
        "payload_metadata": {
            "source": "synthetic_data_quality_reconstruction",
            "task_type": "training_data_quality_review",
            "synthetic": True,
            "provenance": {
                "kind": "synthetic_data_quality_reconstruction",
                "derived_from_candidate_sha256": "f56e10b52ed83645ec3eca1b468724644dcbf6f843da96d7e82b5b4ef47bc349",
                "candidate_row_number_1based": 6142,
                "candidate_row_sha256": EXPECTED[6142],
                "original_source_label": "clinical_book_Get More.....",
            },
        },
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are a training-data quality reviewer, not a therapist. "
                    "Classify whether a record is a genuine client-counselor exchange. "
                    "Do not infer clinical content from advertisements or page headings."
                ),
            },
            {
                "role": "user",
                "content": (
                    'A scraped record contains only the page heading "Get More..." and a '
                    "promotional call to action. It has no client statement, counselor "
                    "reply, symptoms, or clinical discussion. Should I turn it into a "
                    "therapy-response example so the dataset keeps its row count?"
                ),
            },
            {
                "role": "assistant",
                "content": (
                    "No. The captured material is promotional copy, not a counseling "
                    "exchange, so it has no supported client context or target response. "
                    "Do not invent either one to preserve the count. Keep the raw record "
                    "and source locator in the audit trail, label it as non-dialogue "
                    "promotional content, and exclude it from counselor-response SFT. "
                    "It can be reconsidered only if the actual source contains a "
                    "separately recoverable dialogue."
                ),
            },
        ],
    },
    {
        "candidate_row_number_1based": 6146,
        "candidate_row_sha256": EXPECTED[6146],
        "repair_kind": "synthetic_data_quality_dialogue",
        "payload_metadata": {
            "source": "synthetic_data_quality_reconstruction",
            "task_type": "training_data_quality_review",
            "synthetic": True,
            "provenance": {
                "kind": "synthetic_data_quality_reconstruction",
                "derived_from_candidate_sha256": "f56e10b52ed83645ec3eca1b468724644dcbf6f843da96d7e82b5b4ef47bc349",
                "candidate_row_number_1based": 6146,
                "candidate_row_sha256": EXPECTED[6146],
                "original_source_label": "clinical_book_Get More.....",
            },
        },
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are a training-data quality reviewer, not a therapist. "
                    "Separate observed source text from missing context. Never invent "
                    "the contents of a missing page or linked resource."
                ),
            },
            {
                "role": "user",
                "content": (
                    'OCR from a mental-health website captured a "Get More..." heading, '
                    "a link button, and no linked-page body. The source file and page "
                    "locator are recorded. Can we write the likely advice that followed "
                    "and use it as a counselor answer?"
                ),
            },
            {
                "role": "assistant",
                "content": (
                    "No. The source locator helps trace the capture, but it does not "
                    "supply the missing page or prove what it said. Do not reconstruct "
                    "the linked content or present it as a counselor response. Mark the "
                    "record as an incomplete promotional-page capture, retain the raw "
                    "OCR and locator for follow-up, and leave it out of response training "
                    "unless the original page is recovered and independently contains "
                    "a real client-counselor exchange."
                ),
            },
        ],
    },
]


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_builder() -> Any:
    spec = importlib.util.spec_from_file_location("source_quality_builder", SOURCE_SCRIPT)
    if spec is None or spec.loader is None:
        raise RuntimeError("could not load source release verifier")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.OUTPUT = OUTPUT
    return module


def annotate_synthetic_triage_rows(builder: Any) -> dict[str, Any]:
    """Add explicit synthetic lineage and recompute every affected split hash."""
    amendments = {row["candidate_row_number_1based"]: row for row in AMENDMENTS}
    found_amendments: set[int] = set()
    split_payloads: dict[str, Any] = {}
    groups: dict[str, set[str]] = {name: set() for name in builder.SPLITS}
    for split in builder.SPLITS:
        payload_path = OUTPUT / f"{split}.jsonl"
        internal_path = OUTPUT / f"{split}-manifest_internal.jsonl"
        refs_path = OUTPUT / f"{split}-rowrefs.jsonl"
        payload_rows = [json.loads(line) for line in payload_path.read_text(encoding="utf-8").splitlines()]
        internal_rows = [json.loads(line) for line in internal_path.read_text(encoding="utf-8").splitlines()]
        ref_rows = [json.loads(line) for line in refs_path.read_text(encoding="utf-8").splitlines()]
        if not (len(payload_rows) == len(internal_rows) == len(ref_rows)):
            raise RuntimeError(f"split files have inconsistent row counts: {split}")
        new_payload: list[str] = []
        new_internal: list[str] = []
        new_refs: list[str] = []
        for row, meta, ref in zip(payload_rows, internal_rows, ref_rows, strict=True):
            number = int(meta["candidate_row_number_1based"])
            amendment = amendments.get(number)
            if amendment is not None:
                if meta["candidate_row_sha256"] != amendment["candidate_row_sha256"]:
                    raise RuntimeError(f"synthetic lineage candidate hash mismatch at {number}")
                row.update(amendment["payload_metadata"])
                meta["transformation"] = "repair_overlay_messages_and_synthetic_provenance"
                found_amendments.add(number)
            raw = (json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n").encode("utf-8")
            payload_digest = builder.sha256_bytes(raw[:-1])
            meta["transformed_payload_sha256"] = payload_digest
            ref["transformed_payload_sha256"] = payload_digest
            group_digest = builder.canonical_messages_hash(row["messages"])
            meta["content_group_sha256"] = group_digest
            groups[split].add(group_digest)
            new_payload.append(raw.decode("utf-8"))
            new_internal.append(json.dumps(meta, ensure_ascii=False, separators=(",", ":")) + "\n")
            new_refs.append(json.dumps(ref, ensure_ascii=False, separators=(",", ":")) + "\n")
        for path, lines in ((payload_path, new_payload), (internal_path, new_internal), (refs_path, new_refs)):
            temporary = path.with_suffix(path.suffix + ".tmp")
            temporary.write_text("".join(lines), encoding="utf-8")
            temporary.chmod(0o600)
            temporary.replace(path)
        split_payloads[split] = {
            "payload": {
                "path": payload_path.name,
                "rows": len(payload_rows),
                "bytes": payload_path.stat().st_size,
                "sha256": sha256_file(payload_path),
            },
            "internal_manifest": {
                "path": internal_path.name,
                "rows": len(internal_rows),
                "sha256": sha256_file(internal_path),
            },
            "rowrefs": {"path": refs_path.name, "rows": len(ref_rows), "sha256": sha256_file(refs_path)},
        }
    if found_amendments != set(amendments):
        raise RuntimeError("not all synthetic amendment rows appear in the rebuilt splits")
    if any(groups[left] & groups[right] for i, left in enumerate(builder.SPLITS) for right in builder.SPLITS[i + 1 :]):
        raise RuntimeError("transformed content groups overlap across splits")
    return split_payloads


def main() -> None:
    if OUTPUT.exists() or AMENDMENTS_PATH.exists():
        raise RuntimeError("refusing to overwrite an existing repair artifact")
    AMENDMENTS_PATH.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    AMENDMENTS_PATH.parent.chmod(0o700)
    amendment_payload = "".join(json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n" for row in AMENDMENTS)
    AMENDMENTS_PATH.write_text(amendment_payload, encoding="utf-8")
    AMENDMENTS_PATH.chmod(0o600)

    builder = load_builder()
    source_manifest, internal, excluded, repairs, checks = builder.validate_inputs()
    if excluded != set(EXPECTED):
        raise RuntimeError("the source verifier found a different pair of triage rows")
    if set(repairs) & set(EXPECTED) != set(EXPECTED):
        raise RuntimeError("triage amendment rows are missing from the frozen repair overlay")
    for amendment in AMENDMENTS:
        number = amendment["candidate_row_number_1based"]
        if repairs[number]["candidate_row_sha256"] != amendment["candidate_row_sha256"]:
            raise RuntimeError(f"amendment row hash mismatch at candidate row {number}")
        repairs[number] = {**repairs[number], **amendment}

    checks["triage_amendment_path"] = str(AMENDMENTS_PATH.relative_to(ROOT))
    checks["triage_amendment_sha256"] = sha256_file(AMENDMENTS_PATH)
    checks["triage_amendment_rows"] = len(AMENDMENTS)
    summary = builder.build(source_manifest, internal, set(), repairs, checks)
    updated_split_payloads = annotate_synthetic_triage_rows(builder)

    release_path = OUTPUT / "release-manifest.json"
    release = json.loads(release_path.read_text(encoding="utf-8"))
    release.update(
        release_id="wandb-full-corpus-repaired-breakaway-20261020-v3",
        status="local_research_sensitivity_only",
        upload_gate=False,
        triage_amendment_path=str(AMENDMENTS_PATH.relative_to(ROOT)),
        triage_amendment_sha256=checks["triage_amendment_sha256"],
        triage_amendment_rows=2,
        split_payloads=updated_split_payloads,
        replacement_rule=(
            "Apply all 52 v4-bound repairs. Fifty rows replace the malformed short "
            "excerpts with pinned-source excerpts plus labeled generated continuations; "
            "two repeated promotional-page rows receive distinct synthetic data-quality "
            "dialogues. Preserve all v4 splits and all source rows."
        ),
        excluded_rows=0,
        excluded_rows_by_split={},
        retained_rows=190244,
        split_counts={"train": 171261, "validation": 9673, "test": 9310},
        limitations=[
            "This local sensitivity release does not replace the user-directed full-corpus v4 baseline.",
            "All retained candidate rows remain covered only by the unresolved/hold source-status dispositions in the linked ledger.",
            "The 50 generated continuations are not upstream response targets and have not received human clinical review.",
            "The two synthetic data-quality examples replace repeated promotional-page records; they train data-quality handling, not therapeutic response behavior.",
            "No rights, privacy, consent, clinical-suitability, or provider-transfer clearance is inferred; upload_gate remains false.",
        ],
    )
    release_path.write_text(json.dumps(release, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    release_path.chmod(0o600)
    summary.update(
        release_manifest_sha256=sha256_file(release_path),
        triage_amendment_sha256=checks["triage_amendment_sha256"],
        retained_rows=190244,
        excluded_rows=0,
        upload_gate=False,
    )
    summary_path = OUTPUT / "build-summary.json"
    summary_path.write_text(json.dumps(summary, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    summary_path.chmod(0o600)
    print(json.dumps(summary, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
