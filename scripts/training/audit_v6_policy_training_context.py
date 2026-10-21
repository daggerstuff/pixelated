"""Bind privacy review candidates to source context without exporting dialogue."""

from __future__ import annotations

import hashlib
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

from scripts.training.build_v6_safety_judge_packets import DOCS, ROOT
from scripts.training.summarize_v6_paired_evaluations import canonical_hash


def digest(path: Path) -> str:
    result = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            result.update(chunk)
    return result.hexdigest()


def bind_training_candidates(train: Path, membership: Path, candidates: list[dict]) -> list[dict]:
    """Reject stale, repeated or unmatched train-line references before review."""
    requested = {r["train_line"]: r for r in candidates}
    if len(requested) != len(candidates):
        raise ValueError("duplicate review candidate")
    by_content = defaultdict(list)
    with membership.open() as references:
        for reference in map(json.loads, references):
            if reference["split"] == "train":
                by_content[reference["content_group_sha256"]].append(reference)
    result = []
    seen = Counter()
    with train.open("rb") as stream:
        for index, raw in enumerate(stream, 1):
            row = json.loads(raw)
            group = canonical_hash(row["messages"])
            references = by_content.get(group, [])
            if not references:
                raise ValueError("training payload has no matching content reference")
            seen[group] += 1
            if index not in requested:
                continue
            if len(references) != 1:
                raise ValueError("ambiguous review candidate provenance")
            reference = references[0]
            request = requested[index]
            # The original signal audit hashed the full JSONL record, including newline.
            if hashlib.sha256(raw).hexdigest() != request["row_sha256"]:
                raise ValueError("stale review candidate payload")
            messages = row["messages"]
            user = "\n".join(m.get("content") or "" for m in messages if m["role"] == "user")
            result.append(
                {
                    **request,
                    "train_record_hash_includes_newline": True,
                    "candidate_row": reference["candidate_row_number_1based"],
                    "candidate_sha256": reference["candidate_row_sha256"],
                    "source_label": reference["source_label"],
                    "training_has_system_context": any(m["role"] == "system" for m in messages),
                    "user_mentions_privacy": bool(re.search(r"confiden|priva|secret|retain|shar(?:e|ing)", user, re.I)),
                    "review_status": "requires_contextual_adjudication",
                    "automatic_exclusion_authorized": False,
                }
            )
    if seen != Counter({group: len(refs) for group, refs in by_content.items()}):
        raise ValueError("training payload and membership multiplicities differ")
    if len(result) != len(requested):
        raise ValueError("unmatched review candidate")
    return result


def audit() -> dict:
    release = json.loads((DOCS / "wandb-full-corpus-current-master-20261021-v6.json").read_text())
    scan = json.loads((DOCS / "policy-repair-v3/training-signal-audit.json").read_text())
    train = ROOT / scan["train_path"]
    membership = ROOT / release["internal_manifest"]["path"]
    source = ROOT / release["source_candidate"]["path"]
    for path, expected in (
        (train, scan["train_sha256"]),
        (membership, release["internal_manifest"]["sha256"]),
        (source, release["source_candidate"]["sha256"]),
    ):
        if digest(path) != expected:
            raise ValueError(f"frozen source hash mismatch: {path.name}")
    queue = bind_training_candidates(train, membership, scan["candidate_rows"])
    by_source_index = {row["candidate_row"]: row for row in queue}
    found = set()
    with source.open("rb") as stream:
        for index, raw in enumerate(stream, 1):
            if index not in by_source_index:
                continue
            entry = by_source_index[index]
            if hashlib.sha256(raw.rstrip(b"\n")).hexdigest() != entry["candidate_sha256"]:
                raise ValueError("source candidate hash mismatch")
            original = json.loads(raw)
            systems = [m["content"] for m in original["messages"] if m["role"] == "system"]
            entry["source_has_system_context"] = bool(systems)
            entry["source_system_sha256"] = hashlib.sha256(json.dumps(systems, sort_keys=True).encode()).hexdigest()
            entry["source_system_mentions_therapist"] = any(
                re.search(r"therapist|counselor|psychologist", s, re.I) for s in systems
            )
            found.add(index)
    if found != set(by_source_index):
        raise ValueError("missing source candidates")
    return {
        "candidate_count": len(queue),
        "alignment_method": "Canonical weighted-message content hash, with full training membership multiplicity verification; never positional alignment.",
        "audit_correction": "An initial positional-join draft was invalid for this shuffled payload. Its source counts and system-context counts are superseded by this content-bound report.",
        "source_counts": dict(Counter(r["source_label"] for r in queue)),
        "source_system_removed_count": sum(
            r["source_has_system_context"] and not r["training_has_system_context"] for r in queue
        ),
        "source_system_mentions_therapist_count": sum(r["source_system_mentions_therapist"] for r in queue),
        "user_mentions_privacy_count": sum(r["user_mentions_privacy"] for r in queue),
        "interpretation": "Context flags are screening evidence, not adjudicated defects or causal proof. No conversation text exported.",
        "remediation": "Adjudicate source-context conflicts before reusing flagged targets; do not rewrite or drop rows by regex alone.",
        "training_modified": False,
        "clinical_clearance": False,
        "source_hashes": {str(p.relative_to(ROOT)): digest(p) for p in (train, membership, source)},
        "review_queue": queue,
    }


if __name__ == "__main__":
    report = audit()
    path = DOCS / "v6-policy-training-context-audit.json"
    path.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({k: v for k, v in report.items() if k != "review_queue"}, indent=2))
