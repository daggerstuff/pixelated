#!/usr/bin/env python3
"""
Validate governance/data_source_matrix.csv against simple business rules without external deps.
- CSV columns must match expected headers
- Enum fields: license, risk_level, approval_status
- Boolean fields: pii_present, deidentification_required, provenance_required
- allowed_uses/prohibited_uses are semicolon-separated lists
- If pii_present is true -> deidentification_required must be true
- If license is 'unclear' -> approval_status must be 'rejected' or 'pending' (not 'approved')
- If approval_status == 'approved' -> reviewer and review_date required
- If risk_level == 'high' -> approval_status cannot be 'approved' without reviewer and acceptance_criteria containing 'mitigation' or 'contract'
"""
from __future__ import annotations
import csv
import sys
from pathlib import Path

MATRIX_PATH = Path(__file__).resolve().parents[2] / 'governance' / 'data_source_matrix.csv'
EXPECTED_HEADERS = [
    'source_name','url','license','allowed_uses','prohibited_uses','pii_present',
    'deidentification_required','provenance_required','risk_level','acceptance_criteria',
    'approval_status','reviewer','review_date','notes'
]
ENUMS = {
    'license': {'permissive','contracted','proprietary','unclear'},
    'risk_level': {'low','medium','high'},
    'approval_status': {'pending','approved','rejected'},
}
BOOL_FIELDS = {'pii_present','deidentification_required','provenance_required'}

def parse_bool(val: str) -> bool | None:
    v = val.strip().lower()
    if v in {'true','1','yes','y'}: return True
    if v in {'false','0','no','n'}: return False
    return None

def main() -> int:
    errors: list[str] = []
    if not MATRIX_PATH.exists():
        print(f"ERROR: Matrix not found at {MATRIX_PATH}")
        return 2
    with MATRIX_PATH.open(newline='') as f:
        reader = csv.DictReader(f)
        headers = reader.fieldnames or []
        if headers != EXPECTED_HEADERS:
            errors.append(f"Header mismatch. Expected {EXPECTED_HEADERS} got {headers}")
        for i, row in enumerate(reader, start=2):
            ctx = f"row {i} ({row.get('source_name','<unknown>')})"
            # enums
            for field, allowed in ENUMS.items():
                val = (row.get(field) or '').strip().lower()
                if val not in allowed:
                    errors.append(f"{ctx}: invalid {field}='{row.get(field)}', allowed={sorted(allowed)}")
            # booleans
            bool_values: dict[str,bool] = {}
            for bf in BOOL_FIELDS:
                pv = row.get(bf, '')
                bv = parse_bool(str(pv))
                if bv is None:
                    errors.append(f"{ctx}: {bf} must be boolean (true/false)")
                else:
                    bool_values[bf] = bv
            # dependency: PII implies deidentification_required
            if bool_values.get('pii_present') and not bool_values.get('deidentification_required'):
                errors.append(f"{ctx}: pii_present=true requires deidentification_required=true")
            # allowed/prohibited lists
            for lf in ('allowed_uses','prohibited_uses'):
                raw = (row.get(lf) or '').strip()
                # allow empty but warn
                if raw:
                    # basic normalization
                    items = [x.strip() for x in raw.split(';') if x.strip()]
                    if not items:
                        errors.append(f"{ctx}: {lf} has invalid list format; use semicolon-separated values")
                else:
                    errors.append(f"{ctx}: {lf} should not be empty; specify at least one item or 'none'")
            # unclear license cannot be approved
            license_val = (row.get('license') or '').strip().lower()
            status_val = (row.get('approval_status') or '').strip().lower()
            if license_val == 'unclear' and status_val == 'approved':
                errors.append(f"{ctx}: license=unclear cannot be approval_status=approved")
            # approved requires reviewer and review_date
            if status_val == 'approved':
                if not (row.get('reviewer') and row.get('review_date')):
                    errors.append(f"{ctx}: approved requires reviewer and review_date")
            # high risk extra check
            if (row.get('risk_level') or '').strip().lower() == 'high' and status_val == 'approved':
                ac = (row.get('acceptance_criteria') or '').lower()
                if not any(k in ac for k in ('mitigation','contract')):
                    errors.append(f"{ctx}: high risk approved must include mitigation/contract in acceptance_criteria")
        if errors:
            print("VALIDATION FAILED:\n" + "\n".join(f"- {e}" for e in errors))
            return 1
        print("Validation passed: data_source_matrix.csv is consistent.")
        return 0

if __name__ == '__main__':
    raise SystemExit(main())
