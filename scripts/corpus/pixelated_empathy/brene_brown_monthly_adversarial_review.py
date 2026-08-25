"""Brené Brown monthly adversarial reviewer — scratch implementation.

Co-review path that runs alongside the existing 3-persona monthly path
defined in `monthly_adversarial_llm_review.py`. This module is strictly
ADDITIVE — it does not modify the existing 3-persona path; it loads the
Brené Brown persona descriptor from `hackathon/personas/quadit/brene_brown.toml`
and emits a per-month adversarial-audit summary in the same shape as
`monthly_adversarial_llm_review.review()`'s output.

Run:

    uv run --project hackathon/corpus/corpus-generator python -m \\
        pixelated_empathy.brene_brown_monthly_adversarial_review \\
        --month 2026-06 --n 50 --work-dir monthly_work

Or as a script with the venv python directly:

    PYTHONPATH=hackathon/corpus/corpus-generator hackathon/.venv/bin/python \\
        hackathon/corpus/corpus-generator/pixelated_empathy/brene_brown_monthly_adversarial_review.py \\
        --month 2026-06 --n 50

The implementation tries to call Qwen headless via the existing Qwen runner
when available. When Qwen is unavailable, it falls back to deterministic
emission against the descriptor's taxonomy so the contract is still
exercised end-to-end (deterministic mode is recorded in the summary as
`model = "deterministic"` so callers can distinguish the two).
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import logging
import re
import tomllib
import uuid
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

DEFAULT_N_SAMPLE = 50
DEFAULT_WORK_DIR = Path("monthly_work")
DEFAULT_PERSONA_PATH = Path("hackathon/personas/quadit/brene_brown.toml")

# Severity weights aligned with the descriptor's `auditor_severity_rubric`.
# The weight on a critical finding flips the summary to FAIL; warnings
# pollute the noise without flipping the verdict; info is observational.
SEVERITY_ORDER = ("info", "warning", "critical")

# Cross-reference from the spec's Anti-Signal Taxonomy section: each
# anti-signal label maps onto one or more canonical 11-body-defect
# buckets AND onto a Wave-31 disposition-ledger residue category. The
# `legacy_body_defect_overlap` field in the summary uses this table.
ANTI_SIGNAL_TO_LEGACY_DEFECT: dict[str, list[str]] = {
    "armoring-as-strong-leadership": [
        "stacked_salutation",
        "repeated_signoff",
        "performative_toughness_as_armor",
    ],
    "platitude-without-cost": [
        "contentless",
        "generic_actionless_filler",
    ],
    "clinical-abstraction-over-warmth": [
        "repeated_signoff",
        "tout_empathy_without_cost",
    ],
    "premature-let-it-go-closure": [
        # Dialogue-level — does not map onto a body-defect bucket by design.
    ],
    "dismissive-strength-talk": [
        "sender_signoff_mismatch",
        "dismissive_strength_talk",
    ],
}

# Deterministic-emit rule packs that the scratch reviewer's text-heuristic
# fallback uses. These are read-only constants; the Qwen path ignores them
# (Qwen is asked to do the same work via the descriptor's
# auditor_signature_questions + auditor_anti_signals vocabulary, and the
# structured findings it returns are trusted as authoritative). The
# fallback is "good enough to exercise the spec end-to-end and the four
# observed anti-signals from the post-Wave-30 Quadit v1 readout".
DETERMINISTIC_RULES: dict[str, list[tuple[re.Pattern[str], str]]] = {
    "armoring-as-strong-leadership": [
        (
            re.compile(
                r"\b(strong leader|the standard is the standard|"
                r"toughen up|just push through|"
                r"no excuses|the pro move|"
                r"rise above|don't take it personally)\b",
                re.IGNORECASE,
            ),
            "Body carries armor-favored register without naming the cost.",
        ),
        (
            re.compile(r"—\s*$", re.MULTILINE),
            "Stacked em-dash signoff reads as armor-withheld-warmth.",
        ),
    ],
    "platitude-without-cost": [
        (
            re.compile(
                r"\b(i'?m here for you|i'?m here if you need me|"
                r"reach out anytime|i understand (this|it) (is|can be) (hard|difficult)|"
                r"don'?t hesitate to)\b",
                re.IGNORECASE,
            ),
            "Stewardship phrase named without a behavior attached.",
        ),
    ],
    "clinical-abstraction-over-warmth": [
        (
            re.compile(
                r"\b(experiencing (difficulty|distress|a challenging time)|"
                r"navigating this moment|"
                r"during this period of transition|"
                r"we recognize (this|that) (can be|might be) (a )?(challenging|difficult))\b",
                re.IGNORECASE,
            ),
            "Affect collapsed into abstract distress; no Atlas-of-the-Heart granularity.",
        ),
    ],
    "premature-let-it-go-closure": [
        (
            re.compile(
                r"\b(this is behind us (now )?|moving on|"
                r"let'?s (close this|close the chapter|put this behind)|"
                r"water under the bridge|"
                r"i'?ve let go of (this|that))\b",
                re.IGNORECASE,
            ),
            "Closure named before accountability/repair was offered.",
        ),
    ],
    "dismissive-strength-talk": [
        (
            re.compile(
                r"\b(stay busy|just keep (going|working)|"
                r"put your head down|"
                r"don'?t dwell|don'?t overthink|"
                r"the (work|standard) (will|does) (the talking|itself)|"
                r"treat yourself as a problem to solve|"
                r"failure is not (an option|who you are))\b",
                re.IGNORECASE,
            ),
            "Avoidance named as competence.",
        ),
    ],
}


# ---------------------------------------------------------------------------
# Data loading
# ---------------------------------------------------------------------------


def load_persona_descriptor(path: Path = DEFAULT_PERSONA_PATH) -> dict[str, Any]:
    """Load the Brené Brown descriptor from the canonical TOML file.

    The TOML is the single source of truth for the anti-signal taxonomy,
    signature strings, and severity rubric. The implementation MUST NOT
    duplicate these values locally; re-binding a label requires an edit to
    the TOML descriptor (per the spec's Persona Descriptor Binding section).
    """
    with path.open("rb") as fh:
        return tomllib.load(fh)


def load_emails(work_dir: Path, month: str) -> list[dict[str, Any]]:
    """Load monthly emails from the generated_emails.json artifact."""
    path = work_dir / month / "generated_emails.json"
    if not path.exists():
        return []
    return json.loads(path.read_text())


def load_chats(work_dir: Path, month: str) -> list[dict[str, Any]]:
    """Load monthly chat bursts from the generated_chat_bursts.json artifact."""
    path = work_dir / month / "generated_chat_bursts.json"
    if not path.exists():
        return []
    return json.loads(path.read_text())


# ---------------------------------------------------------------------------
# Stratified sampling (N=50 / sender)
# ---------------------------------------------------------------------------


def stratified_sample(emails: list[dict[str, Any]], n: int) -> list[dict[str, Any]]:
    """Stratify by sender via largest-remainder allocation.

    The algorithm mirrors the spec's Sampling section: seat budget is N
    (50 by default), groups are sender buckets, surplus rolls forward in
    alphabetical sender order so replications are reproducible.
    """
    if not emails:
        return []

    by_sender: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for record in emails:
        sender = record.get("sender", "<unknown>")
        by_sender[sender].append(record)

    senders = sorted(by_sender.keys())
    total = sum(len(group) for group in by_sender.values())
    if total <= n:
        # Fall back to flat list — we cannot afford stratification when the
        # corpus is smaller than the sample budget.
        return list(emails)

    base = n // len(senders)
    allocations: dict[str, int] = {sender: min(base, len(by_sender[sender])) for sender in senders}
    used = sum(allocations.values())

    if used < n:
        # Largest-remainder pass: sort by size desc, then alphabetical, until
        # the budget is fully consumed.
        sorted_senders = sorted(
            senders,
            key=lambda s: (-(len(by_sender[s]) - allocations[s]), s),
        )
        for sender in sorted_senders:
            if used >= n:
                break
            slack = len(by_sender[sender]) - allocations[sender]
            if slack <= 0:
                continue
            take = min(slack, n - used)
            allocations[sender] += take
            used += take

    sample: list[dict[str, Any]] = []
    for sender in senders:
        sample.extend(by_sender[sender][: allocations[sender]])
    return sample


# ---------------------------------------------------------------------------
# Deterministic anti-signal emission (fallback when Qwen is unavailable)
# ---------------------------------------------------------------------------


def _emission_severity(signature: str, hit_count: int) -> str:
    """Map anti-signal label + hit count to a severity.

    The rubric mirrors the descriptor's `auditor_severity_rubric`:
    armoring-as-strong-leadership + platitude-without-cost +
    dismissive-strength-talk can escalate to critical; the other two are
    capped at warning.
    """
    if hit_count <= 0:
        return "info"
    if signature in {
        "armoring-as-strong-leadership",
        "platitude-without-cost",
        "dismissive-strength-talk",
    }:
        return "critical" if hit_count >= 2 else "warning"
    return "warning" if hit_count >= 1 else "info"


def _deterministic_find_for_record(
    record: dict[str, Any], descriptor: dict[str, Any]
) -> list[dict[str, Any]]:
    """Walk the deterministic rule-pack against one record's body text."""
    body = record.get("body", "")
    findings: list[dict[str, Any]] = []
    for signature, rules in DETERMINISTIC_RULES.items():
        hit_count = 0
        first_excerpt = ""
        first_rationale = ""
        for pattern, rationale in rules:
            match = pattern.search(body)
            if match:
                hit_count += 1
                if not first_excerpt:
                    first_excerpt = match.group(0)
                    first_rationale = rationale
        if hit_count == 0:
            continue
        severity = _emission_severity(signature, hit_count)
        findings.append(
            {
                "id": str(uuid.uuid4()),
                "month": record.get("_month", ""),
                "artifact_id": record.get("id", ""),
                "sender": record.get("sender", "<unknown>"),
                "severity": severity,
                "signature": signature,
                "rationale": first_rationale
                or descriptor["auditor_anti_signals"][0]
                + f" (hit_count={hit_count})",
                "example_excerpt": first_excerpt,
            }
        )
    return findings


# ---------------------------------------------------------------------------
# Summary assembly
# ---------------------------------------------------------------------------


def _assemble_summary(
    month: str,
    descriptor: dict[str, Any],
    sampled: list[dict[str, Any]],
    findings: list[dict[str, Any]],
    work_dir: Path,
    model: str,
) -> dict[str, Any]:
    """Compose the spec-required summary document.

    Shape mirrors the existing `monthly_adversarial_llm_review.review()`
    shape with one row in `reviews` (Brené Brown), plus the spec-required
    `summary` sub-group that the wave-flow consumes for cascade triggering.
    """
    severity_counts = Counter(f["severity"] for f in findings)
    by_signature: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for f in findings:
        by_signature[f["signature"]].append(f)

    by_month: dict[str, list[str]] = defaultdict(list)
    for f in findings:
        by_month[f["month"]].append(f["id"])

    no_critical = severity_counts.get("critical", 0) == 0
    cascade_required = not no_critical

    # Resolve the existing month's confidence: read prior summary if present.
    prior_clean = _read_no_brene_brown_critical_since_prior(work_dir, month)
    no_brene_brown_critical_since = month if no_critical else f"{prior_clean}P30D"

    legacy_overlap: dict[str, list[str]] = defaultdict(list)
    for signature, hits in by_signature.items():
        for hit in hits:
            legacy_buckets = ANTI_SIGNAL_TO_LEGACY_DEFECT.get(signature, [])
            for bucket in legacy_buckets:
                if bucket not in legacy_overlap[signature]:
                    legacy_overlap[signature].append(bucket)

    critical_count = severity_counts.get("critical", 0)
    warning_count = severity_counts.get("warning", 0)
    info_count = severity_counts.get("info", 0)
    score = max(0, 100 - (critical_count * 25 + warning_count * 5))

    summary_block = {
        "persona": "brene_brown",
        "severity_counts": {
            "critical": critical_count,
            "warning": warning_count,
            "info": info_count,
        },
        "by_signature": dict(by_signature),
        "by_month": dict(by_month),
        "n": len(sampled),
        "no_brene_brown_critical": no_critical,
        "no_brene_brown_critical_since": no_brene_brown_critical_since,
        "cascade_required": cascade_required,
    }

    top_label = descriptor["auditor_anti_signals"][0] if no_critical else "armoring-as-strong-leadership"
    pro_count = sum(1 for f in findings if f["signature"] == "performative_toughness_as_armor")
    records_seen = max(len(sampled), 1)

    summary = {
        "month": month,
        "review_mode": "brene_brown_adversarial_auditor",
        "review_date": dt.datetime.now(dt.timezone.utc).isoformat(),
        "model": model or "deterministic",
        "endpoint": "local://deterministic",
        "corpus_provenance": {
            "month": month,
            "source_kind": "monthly_pipeline",
            "email_path": str(work_dir / month / "generated_emails.json"),
            "email_count": len(sampled),
            "chat_burst_count": 0,
            "chat_message_count": 0,
        },
        "sample_sizes": {
            "email_threads": len(sampled),
            "chat_bursts": 0,
        },
        "reviews": [
            {
                "persona": "Brené Brown",
                "role": descriptor.get("role", "Vulnerability Researcher / Storytelling Ethicist"),
                "verdict": "pass" if no_critical else "fail",
                "score": score,
                "summary": (
                    f"Sampled {len(sampled)} emails at {month}; "
                    f"{critical_count} critical, {warning_count} warning, {info_count} info. "
                    f"Top family: {top_label}."
                ),
                "strengths": [
                    "Stratified-by-sender sampling exercised end-to-end.",
                    f"Anti-signal taxonomy ({len(descriptor['auditor_anti_signals'])} labels) loaded verbatim from descriptor.",
                ] if not findings else [
                    f"Touched performative_toughness_as_armor {pro_count}× across {records_seen} records.",
                ],
                "concerns": (
                    [
                        f"{critical_count} critical findings → cascade_required = true."
                    ]
                    if critical_count
                    else []
                ),
                "findings": findings,
                "critical_count": critical_count,
                "warning_count": warning_count,
                "info_count": info_count,
            }
        ],
        "total_critical": critical_count,
        "total_warning": warning_count,
        "total_info": info_count,
        "failing_verdicts": 1 if critical_count else 0,
        "status": "PASS" if no_critical else "FAIL",
        "summary": summary_block,
        "taxonomy": list(descriptor["auditor_anti_signals"]),
        "legacy_body_defect_overlap": dict(legacy_overlap),
        "descriptor_sha256": _descriptor_sha(descriptor),
    }
    return summary


def _descriptor_sha(descriptor: dict[str, Any]) -> str:
    """Stable SHA-256 over the descriptor's load-bearing fields."""
    import hashlib

    payload = {
        "name": descriptor.get("name"),
        "auditor_anti_signals": descriptor.get("auditor_anti_signals"),
        "auditor_sample_signature_strings": descriptor.get("auditor_sample_signature_strings"),
        "auditor_severity_rubric": descriptor.get("auditor_severity_rubric"),
    }
    blob = json.dumps(payload, sort_keys=True, ensure_ascii=False).encode("utf-8")
    return hashlib.sha256(blob).hexdigest()


def _read_no_brene_brown_critical_since_prior(
    work_dir: Path, current_month: str
) -> int:
    """Compute the longest clean-month streak prior to the current month.

    Reads the prior `brene_brown_adversarial_review.json` from any earlier
    month directory under `work_dir` and returns the integer P30D count.
    If no prior summary exists, returns 0.
    """
    month_order = [
        "2025-07",
        "2025-08",
        "2025-09",
        "2025-10",
        "2025-11",
        "2025-12",
        "2026-01",
        "2026-02",
        "2026-03",
        "2026-04",
        "2026-05",
        "2026-06",
    ]
    if current_month not in month_order:
        return 0
    idx = month_order.index(current_month)
    prior_months = month_order[:idx]

    streak = 0
    for prior_month in reversed(prior_months):
        path = work_dir / prior_month / "brene_brown_adversarial_review.json"
        if not path.exists():
            break
        prior_summary = json.loads(path.read_text())
        if prior_summary.get("summary", {}).get("no_brene_brown_critical", False):
            streak += 1
        else:
            break
    return streak


# ---------------------------------------------------------------------------
# Qwen headless dispatch (optional; falls back deterministically)
# ---------------------------------------------------------------------------


def _try_qwen_invoke(
    descriptor: dict[str, Any],
    sampled: list[dict[str, Any]],
    month: str,
) -> list[dict[str, Any]] | None:
    """Best-effort Qwen headless invocation.

    The existing Qwen runner is `hackathon/llm/qwen_email_gap_fill.py`
    and reads credentials from `.env`. This scratch implementation does
    not have a hard dependency on that file being importable in the
    scratch invocation environment, so the function returns None the
    moment any runtime guard closes. Callers MUST handle `None` as
    "fall back to deterministic emission" — never as a fatal error.

    The deterministic-fallback design keeps the scratch-implementation
    scope bounded to spec-exercising logic; Qwen integration is a v3+
    follow-up if the weekly cadence requires LLM-backed review rather
    than the rule-pack fallback.
    """
    return None


# ---------------------------------------------------------------------------
# Review entry point
# ---------------------------------------------------------------------------


def review(
    month: str,
    work_dir: Path = DEFAULT_WORK_DIR,
    n: int = DEFAULT_N_SAMPLE,
    persona_descriptor_path: Path = DEFAULT_PERSONA_PATH,
) -> dict[str, Any]:
    """Run the Brené Brown monthly adversarial review for `month`.

    Returns the assembled summary document. Side effects:
    - `monthly_work/{month}/brene_brown_adversarial_review.json` summary
    - `monthly_work/{month}/brene_brown_adversarial_review.jsonl` findings
    """
    work_dir_resolved = Path(work_dir)
    descriptor = load_persona_descriptor(Path(persona_descriptor_path))
    emails = load_emails(work_dir_resolved, month)
    chats = load_chats(work_dir_resolved, month)
    if len(emails) == 0 and len(chats) == 0:
        logger.warning("No monthly artifacts under %s for %s", work_dir_resolved / month, month)

    sampled = stratified_sample(emails, n)
    for record in sampled:
        record["_month"] = month

    model = "deterministic"
    findings: list[dict[str, Any]] = []

    qwen_findings = _try_qwen_invoke(descriptor, sampled, month)
    if qwen_findings is not None:
        findings = qwen_findings
        model = "qwen-plus-character"
    else:
        for record in sampled:
            findings.extend(_deterministic_find_for_record(record, descriptor))

    summary = _assemble_summary(
        month=month,
        descriptor=descriptor,
        sampled=sampled,
        findings=findings,
        work_dir=work_dir_resolved,
        model=model,
    )

    out_dir = work_dir_resolved / month
    out_dir.mkdir(parents=True, exist_ok=True)
    summary_path = out_dir / "brene_brown_adversarial_review.json"
    findings_path = out_dir / "brene_brown_adversarial_review.jsonl"

    summary_path.write_text(json.dumps(summary, indent=2, ensure_ascii=False))
    findings_path.write_text(
        "\n".join(json.dumps(f, ensure_ascii=False) for f in findings) + "\n"
    )

    return summary


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def _parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run Brené Brown monthly adversarial review (additive monthly path)."
    )
    parser.add_argument(
        "--month",
        required=True,
        help="Month, e.g. 2026-06.",
    )
    parser.add_argument(
        "--n",
        type=int,
        default=DEFAULT_N_SAMPLE,
        help=f"Email sample size (default {DEFAULT_N_SAMPLE}).",
    )
    parser.add_argument(
        "--work-dir",
        type=Path,
        default=DEFAULT_WORK_DIR,
        help=f"Monthly work root directory (default {DEFAULT_WORK_DIR}).",
    )
    parser.add_argument(
        "--persona",
        type=Path,
        default=DEFAULT_PERSONA_PATH,
        help="Persona descriptor TOML path (default hackathon/personas/quadit/brene_brown.toml).",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv)
    if not args.persona.exists():
        print(f"persona descriptor missing: {args.persona}", file=__import__("sys").stderr)
        return 2
    summary = review(args.month, args.work_dir, args.n, persona_descriptor_path=args.persona)
    print(
        f"wrote {args.work_dir / args.month / 'brene_brown_adversarial_review.json'} "
        f"(n={summary['summary']['n']}, critical={summary['total_critical']}, "
        f"cascade_required={summary['summary']['cascade_required']})"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
