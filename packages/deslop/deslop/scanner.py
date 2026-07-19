from dataclasses import dataclass
from pathlib import Path

from deslop.engine import field_is_selected
from deslop.io import read_records, string_fields
from deslop.models import Finding, ScanReport
from deslop.rules.core import RuleSet, get_pattern_regex


@dataclass(frozen=True, slots=True)
class ScanOptions:
    rules: RuleSet | None = None
    fields: tuple[str, ...] = ()
    sample: int | None = None
    finding_limit: int = 200


def make_snippet(text: str, start: int, end: int, radius: int = 42) -> str:
    left = max(start - radius, 0)
    right = min(end + radius, len(text))
    prefix = "…" if left > 0 else ""
    suffix = "…" if right < len(text) else ""
    return f"{prefix}{text[left:right]}{suffix}"


def scan_file(input_file: Path, options: ScanOptions | None = None) -> ScanReport:
    active_options = options or ScanOptions()
    rules = active_options.rules or RuleSet.default()
    regex = get_pattern_regex(rules.all_patterns())
    processed = 0
    flagged_records = 0
    pattern_counts: dict[str, int] = {}
    fields_affected: dict[str, int] = {}
    findings: list[Finding] = []

    for record in read_records(input_file):
        if active_options.sample is not None and processed >= active_options.sample:
            break
        processed += 1
        record_flagged = False
        for field_path, text in string_fields(record.value):
            if not field_is_selected(field_path, active_options.fields):
                continue
            for match in regex.finditer(text):
                pattern = match.group(0).lower()
                pattern_counts[pattern] = pattern_counts.get(pattern, 0) + 1
                fields_affected[field_path] = fields_affected.get(field_path, 0) + 1
                record_flagged = True
                if len(findings) < active_options.finding_limit:
                    findings.append(
                        Finding(
                            record_index=record.index,
                            record_id=record.record_id,
                            field_path=field_path,
                            pattern=pattern,
                            snippet=make_snippet(text, match.start(), match.end()),
                        )
                    )
        if record_flagged:
            flagged_records += 1

    density = round((flagged_records / processed) * 100, 2) if processed > 0 else 0
    return ScanReport(
        file=str(input_file),
        records_scanned=processed,
        records_flagged=flagged_records,
        slop_density_pct=density,
        top_slop_patterns=dict(sorted(pattern_counts.items(), key=lambda item: item[1], reverse=True)),
        fields_affected=dict(sorted(fields_affected.items(), key=lambda item: item[1], reverse=True)),
        findings=findings,
    )
