#!/usr/bin/env python3
"""
Validate the data source matrix CSV against defined rules and constraints.
"""
import csv
from pathlib import Path
from typing import Optional

MATRIX_PATH = Path("business-strategy/data_source_matrix.csv")
EXPECTED_HEADERS = [
    "source_name", "category", "license", "pii_present", "deidentification_required",
    "risk_level", "approval_status", "reviewer", "review_date", "allowed_uses",
    "prohibited_uses", "acceptance_criteria"
]

ENUMS = {
    "category": {"clinical", "social_media", "academic", "synthetic", "internal"},
    "risk_level": {"low", "medium", "high", "critical"},
    "approval_status": {"pending", "approved", "rejected", "deprecated"},
}

BOOL_FIELDS = ["pii_present", "deidentification_required"]


def parse_bool(val: str) -> Optional[bool]:
    v = val.strip().lower()
    if v in ("true", "1", "yes", "y"):
        return True
    if v in ("false", "0", "no", "n"):
        return False
    return None


def validate_enums(row: dict, ctx: str, errors: list[str]):
    for field, allowed in ENUMS.items():
        val = (row.get(field) or "").strip().lower()
        if val not in allowed:
            errors.append(
                f"{ctx}: invalid {field}='{row.get(field)}', allowed={sorted(allowed)}"
            )


def validate_booleans(row: dict, ctx: str, errors: list[str]) -> dict[str, bool]:
    bool_values: dict[str, bool] = {}
    for bf in BOOL_FIELDS:
        pv = row.get(bf, "")
        bv = parse_bool(str(pv))
        if bv is None:
            errors.append(f"{ctx}: {bf} must be boolean (true/false)")
        else:
            bool_values[bf] = bv
    return bool_values


def validate_use_lists(row: dict, ctx: str, errors: list[str]):
    for lf in ("allowed_uses", "prohibited_uses"):
        raw = (row.get(lf) or "").strip()
        if raw:
            items = [x.strip() for x in raw.split(";") if x.strip()]
            if not items:
                errors.append(
                    f"{ctx}: {lf} has invalid list format; use semicolon-separated values"
                )
        else:
            errors.append(
                f"{ctx}: {lf} should not be empty; specify at least one item or 'none'"
            )


def validate_approval_rules(row: dict, ctx: str, bool_values: dict[str, bool], errors: list[str]):
    # dependency: PII implies deidentification_required
    if bool_values.get("pii_present") and not bool_values.get("deidentification_required"):
        errors.append(f"{ctx}: pii_present=true requires deidentification_required=true")

    license_val = (row.get("license") or "").strip().lower()
    status_val = (row.get("approval_status") or "").strip().lower()

    # unclear license cannot be approved
    if license_val == "unclear" and status_val == "approved":
        errors.append(f"{ctx}: license=unclear cannot be approval_status=approved")

    # approved requires reviewer and review_date
    if status_val == "approved" and not (row.get("reviewer") and row.get("review_date")):
        errors.append(f"{ctx}: approved requires reviewer and review_date")

    # high risk extra check
    if (row.get("risk_level") or "").strip().lower() == "high" and status_val == "approved":
        ac = (row.get("acceptance_criteria") or "").lower()
        if not any(k in ac for k in ("mitigation", "contract")):
            errors.append(
                f"{ctx}: high risk approved must include mitigation/contract in acceptance_criteria"
            )


def main() -> int:
    errors: list[str] = []
    if not MATRIX_PATH.exists():
        return 2
    with MATRIX_PATH.open(newline="") as f:
        reader = csv.DictReader(f)
        headers = reader.fieldnames or []
        if headers != EXPECTED_HEADERS:
            errors.append(f"Header mismatch. Expected {EXPECTED_HEADERS} got {headers}")
        for i, row in enumerate(reader, start=2):
            ctx = f"row {i} ({row.get('source_name', '<unknown>')})"
            validate_enums(row, ctx, errors)
            bool_values = validate_booleans(row, ctx, errors)
            validate_use_lists(row, ctx, errors)
            validate_approval_rules(row, ctx, bool_values, errors)

    if errors:
        for err in errors:
            print(f"ERROR: {err}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
