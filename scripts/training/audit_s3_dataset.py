#!/usr/bin/env python3
"""Audit JSONL training datasets streamed from S3 via rclone."""

from __future__ import annotations

import argparse
import json
import re
import statistics
import subprocess
import sys
from collections import Counter
from dataclasses import asdict, dataclass

WORD_RE = re.compile(r"\b\w+\b")
WS_RE = re.compile(r"\s+")


@dataclass
class AuditResult:
    path: str
    scanned_lines: int
    parsed_lines: int
    parse_errors: int
    schema_ok: int
    turns_avg: float | None
    turns_p50: float | None
    turns_p95: int | None
    content_len_avg: float | None
    content_len_p50: float | None
    role_distribution_top: list[tuple[str, int]]
    duplicate_like_samples: int
    unique_samples: int
    repeat_heavy_message_count: int
    rclone_stderr: str


def normalize_text(text: str) -> str:
    return WS_RE.sub(" ", text.lower().strip())


def percentile_index(n: int, pct: float) -> int:
    if n <= 0:
        return 0
    idx = int(n * pct) - 1
    return max(0, min(idx, n - 1))


def audit_path(path: str, max_lines: int) -> AuditResult:
    proc = subprocess.Popen(
        ["rclone", "cat", path],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        errors="ignore",
    )

    total = 0
    parsed = 0
    parse_errors = 0
    schema_ok = 0
    turns: list[int] = []
    roles: Counter[str] = Counter()
    text_lengths: list[int] = []
    duplicate_counter: Counter[str] = Counter()
    repeat_heavy = 0

    assert proc.stdout is not None
    for raw_line in proc.stdout:
        total += 1
        if total > max_lines:
            break

        line = raw_line.strip()
        if not line:
            continue

        try:
            item = json.loads(line)
            parsed += 1
        except Exception:
            parse_errors += 1
            continue

        messages = item.get("messages") if isinstance(item, dict) else None
        if not isinstance(messages, list) or not messages:
            continue

        schema_ok += 1
        turns.append(len(messages))

        sample_parts: list[str] = []
        for message in messages[:8]:
            if not isinstance(message, dict):
                continue

            role = str(message.get("role", "")).strip().lower()
            content = str(message.get("content", ""))
            roles[role] += 1
            text_lengths.append(len(content))
            sample_parts.append(f"{role}:{normalize_text(content)[:120]}")

            words = WORD_RE.findall(content.lower())
            if len(words) >= 12:
                top_count = Counter(words).most_common(1)[0][1]
                if top_count / max(1, len(words)) > 0.25:
                    repeat_heavy += 1

        duplicate_counter["|".join(sample_parts)] += 1

    proc.stdout.close()
    proc.terminate()
    stderr_text = ""
    if proc.stderr is not None:
        stderr_text = proc.stderr.read().strip()

    unique_samples = sum(1 for _, v in duplicate_counter.items() if v == 1)
    duplicate_like = sum(v for _, v in duplicate_counter.items() if v > 1)

    turns_sorted = sorted(turns)

    return AuditResult(
        path=path,
        scanned_lines=min(total, max_lines),
        parsed_lines=parsed,
        parse_errors=parse_errors,
        schema_ok=schema_ok,
        turns_avg=statistics.mean(turns) if turns else None,
        turns_p50=statistics.median(turns) if turns else None,
        turns_p95=(
            turns_sorted[percentile_index(len(turns_sorted), 0.95)] if turns_sorted else None
        ),
        content_len_avg=statistics.mean(text_lengths) if text_lengths else None,
        content_len_p50=statistics.median(text_lengths) if text_lengths else None,
        role_distribution_top=roles.most_common(8),
        duplicate_like_samples=duplicate_like,
        unique_samples=unique_samples,
        repeat_heavy_message_count=repeat_heavy,
        rclone_stderr=stderr_text[:500],
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("paths", nargs="+", help="rclone paths, e.g. Remote:bucket/key.jsonl")
    parser.add_argument("--max-lines", type=int, default=100000, help="Max lines to scan")
    parser.add_argument("--out", default="", help="Optional output JSON path")
    args = parser.parse_args()

    results = [asdict(audit_path(path, args.max_lines)) for path in args.paths]

    payload = {"max_lines": args.max_lines, "results": results}
    sys.stdout.write(json.dumps(payload, indent=2) + "\n")

    if args.out:
        with open(args.out, "w") as handle:
            json.dump(payload, handle, indent=2)


if __name__ == "__main__":
    main()
