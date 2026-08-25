"""Monthly gate — prepare command.

Checks prior-month acceptance status + input readiness → emits gate_report.json.
Status: "ready" or "not_ready".
"""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

from pixelated_empathy.schemas import GateReport, GateStatus, MONTH_ORDER


def _check(name: str, passed: bool, detail: str) -> dict[str, object]:
    return {"check": name, "passed": passed, "detail": detail}


def prepare(month: str, work_dir_root: Path) -> GateReport:
    """
    Check all preconditions for generating a month's corpus.

    Args:
        month: YYYY-MM string (e.g. "2025-07")
        work_dir_root: root of monthly_work/ directory

    Returns:
        GateReport with status READY or NOT_READY
    """
    if month not in MONTH_ORDER:
        raise ValueError(f"Unknown month: {month!r}")

    checks: list[dict[str, object]] = []
    month_idx = MONTH_ORDER.index(month)
    month_dir = work_dir_root / month

    # ------------------------------------------------------------------ #
    # Check 1: Month bible exists
    # ------------------------------------------------------------------ #
    bible_path = month_dir / "month_bible.json"
    bible_ok = bible_path.exists()
    checks.append(_check(
        "month_bible_present",
        bible_ok,
        str(bible_path) if bible_ok else f"Missing: {bible_path}",
    ))

    # ------------------------------------------------------------------ #
    # Check 2: Prior month accepted (not needed for the first month)
    # ------------------------------------------------------------------ #
    if month_idx == 0:
        checks.append(_check(
            "prior_month_accepted",
            True,
            "First month — no prior required",
        ))
    else:
        prior_month = MONTH_ORDER[month_idx - 1]
        prior_gate_path = work_dir_root / prior_month / "gate_report.json"
        if not prior_gate_path.exists():
            checks.append(_check(
                "prior_month_accepted",
                False,
                f"Prior month gate report missing: {prior_gate_path}",
            ))
        else:
            try:
                prior_report = json.loads(prior_gate_path.read_text())
                prior_status = prior_report.get("status", "unknown")
                accepted = prior_status == GateStatus.ACCEPTED
                checks.append(_check(
                    "prior_month_accepted",
                    accepted,
                    f"Prior month {prior_month} status: {prior_status}",
                ))
            except Exception as exc:
                checks.append(_check(
                    "prior_month_accepted",
                    False,
                    f"Could not parse prior gate report: {exc}",
                ))

    # ------------------------------------------------------------------ #
    # Check 3: Month enrichment present
    # ------------------------------------------------------------------ #
    enrichment_path = month_dir / "month_enrichment.json"
    enrichment_ok = enrichment_path.exists()
    checks.append(_check(
        "month_enrichment_present",
        enrichment_ok,
        str(enrichment_path) if enrichment_ok else f"Missing: {enrichment_path}",
    ))

    # ------------------------------------------------------------------ #
    # Check 4: No stale generation in progress (no lock file)
    # ------------------------------------------------------------------ #
    lock_path = month_dir / "generation.lock"
    no_lock = not lock_path.exists()
    checks.append(_check(
        "no_generation_lock",
        no_lock,
        "No lock file present" if no_lock else f"Lock file exists: {lock_path}",
    ))

    # ------------------------------------------------------------------ #
    # Check 5: Work directory writable
    # ------------------------------------------------------------------ #
    try:
        month_dir.mkdir(parents=True, exist_ok=True)
        test_file = month_dir / ".write_test"
        test_file.write_text("ok")
        test_file.unlink()
        dir_writable = True
        dir_detail = str(month_dir)
    except Exception as exc:
        dir_writable = False
        dir_detail = f"Write test failed: {exc}"
    checks.append(_check("work_dir_writable", dir_writable, dir_detail))

    # ------------------------------------------------------------------ #
    # Determine overall status
    # ------------------------------------------------------------------ #
    all_passed = all(bool(c["passed"]) for c in checks)
    status = GateStatus.READY if all_passed else GateStatus.NOT_READY

    report = GateReport(
        month=month,
        status=status,
        checks=checks,
        generated_at=datetime.utcnow(),
    )
    month_dir.mkdir(parents=True, exist_ok=True)
    (month_dir / "gate_report.json").write_text(report.model_dump_json(indent=2))

    return report


def mark_accepted(month: str, work_dir_root: Path) -> GateReport:
    """Mark a month as accepted — called after all three audit gates pass."""
    gate_path = work_dir_root / month / "gate_report.json"
    if not gate_path.exists():
        raise FileNotFoundError(f"Gate report not found for {month}: {gate_path}")

    report = GateReport.model_validate_json(gate_path.read_text())
    updated = report.model_copy(update={"status": GateStatus.ACCEPTED})
    gate_path.write_text(updated.model_dump_json(indent=2))
    return updated


def mark_rejected(month: str, work_dir_root: Path, reason: str) -> GateReport:
    """Mark a month as rejected — called when any audit gate fails."""
    gate_path = work_dir_root / month / "gate_report.json"
    if not gate_path.exists():
        raise FileNotFoundError(f"Gate report not found for {month}: {gate_path}")

    report = GateReport.model_validate_json(gate_path.read_text())
    rejection_check: dict[str, object] = {
        "check": "manual_rejection",
        "passed": False,
        "detail": reason,
    }
    updated = report.model_copy(
        update={
            "status": GateStatus.REJECTED,
            "checks": list(report.checks) + [rejection_check],
        }
    )
    gate_path.write_text(updated.model_dump_json(indent=2))
    return updated


def get_accepted_months(work_dir_root: Path) -> list[str]:
    """Return list of months with ACCEPTED gate reports, in order."""
    accepted: list[str] = []
    for month in MONTH_ORDER:
        gate_path = work_dir_root / month / "gate_report.json"
        if not gate_path.exists():
            continue
        try:
            report = json.loads(gate_path.read_text())
            if report.get("status") == GateStatus.ACCEPTED:
                accepted.append(month)
        except Exception:
            continue
    return accepted


def next_eligible_month(work_dir_root: Path) -> str | None:
    """Return the next month eligible for generation (prior month accepted or first)."""
    accepted = set(get_accepted_months(work_dir_root))
    for i, month in enumerate(MONTH_ORDER):
        if month in accepted:
            continue
        if i == 0:
            return month
        prior = MONTH_ORDER[i - 1]
        if prior in accepted:
            return month
        return None
    return None
