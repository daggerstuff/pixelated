import re
from dataclasses import dataclass
from fnmatch import fnmatchcase
from pathlib import Path

from deslop.io import clone_json, read_records, set_field, string_fields, write_jsonl
from deslop.models import CleanReport, JsonObject, PreviewItem, PreviewReport
from deslop.rules.core import RuleSet, get_pattern_regex, weighted_pick


@dataclass(frozen=True, slots=True)
class CleanOptions:
    rules: RuleSet | None = None
    fields: tuple[str, ...] = ()


def field_is_selected(field_path: str, fields: tuple[str, ...]) -> bool:
    if not fields:
        return True
    normalized = re.sub(r"\[\d+\]", ".*", field_path)
    return any(fnmatchcase(field_path, field) or fnmatchcase(normalized, field) for field in fields)


def normalize_spacing(text: str) -> str:
    text = re.sub(r"\s+([,.;:!?])", r"\1", text)
    text = re.sub(r"([—-])\s*([,.;:!?])", r"\1", text)
    text = re.sub(r"\s{2,}", " ", text)
    # Clean orphaned punctuation left by None replacements (e.g. "Of course. Can you" → ". Can you")
    text = re.sub(r"^[.,;:!?]+\s+", "", text)
    # Collapse doubled sentence punctuation (e.g. "you. . That" → "you. That")
    text = re.sub(r"([.!?])\s+[.,;:!?]+\s+", r"\1 ", text)
    return text.strip()


def remove_slop(text: str, item_id: str = "generic_id", rules: RuleSet | None = None) -> str:
    active_rules = rules or RuleSet.default()
    regex = get_pattern_regex(active_rules.all_patterns())

    def replace_match(match: re.Match[str]) -> str:
        matched_text = match.group(0)
        lowered = matched_text.lower()
        pool = active_rules.replacements.get(lowered)
        if pool is None:
            return ""

        replacement = weighted_pick(pool, f"slop:{item_id}:{lowered}")
        if replacement is None:
            return ""
        if matched_text and matched_text[0].isupper():
            return replacement[:1].upper() + replacement[1:]
        return replacement

    return normalize_spacing(regex.sub(replace_match, text))


def clean_record(record: JsonObject, record_id: str, options: CleanOptions) -> tuple[JsonObject, int]:
    cleaned = clone_json(record)
    rewritten_fields = 0
    for field_path, text in list(string_fields(cleaned)):
        if not field_is_selected(field_path, options.fields):
            continue
        updated = remove_slop(text, record_id, options.rules)
        if updated != text:
            set_field(cleaned, field_path, updated)
            rewritten_fields += 1
    return cleaned, rewritten_fields


def apply_deslop_to_file(input_file: Path, output_file: Path, options: CleanOptions | None = None) -> CleanReport:
    active_options = options or CleanOptions()
    processed = 0
    rewritten = 0
    fields_rewritten = 0
    cleaned_records: list[JsonObject] = []

    for record in read_records(input_file):
        processed += 1
        cleaned, changed_fields = clean_record(record.value, record.record_id, active_options)
        fields_rewritten += changed_fields
        if changed_fields > 0:
            rewritten += 1
        cleaned_records.append(cleaned)

    write_jsonl(output_file, cleaned_records)
    return CleanReport(
        records_processed=processed,
        records_rewritten=rewritten,
        fields_rewritten=fields_rewritten,
        output_file=str(output_file),
    )


def preview_file(input_file: Path, options: CleanOptions | None = None, limit: int = 20) -> PreviewReport:
    active_options = options or CleanOptions()
    items: list[PreviewItem] = []
    for record in read_records(input_file):
        for field_path, text in string_fields(record.value):
            if len(items) >= limit:
                return PreviewReport(file=str(input_file), items=items)
            if not field_is_selected(field_path, active_options.fields):
                continue
            updated = remove_slop(text, record.record_id, active_options.rules)
            if updated != text:
                items.append(PreviewItem(record_id=record.record_id, field_path=field_path, before=text, after=updated))
    return PreviewReport(file=str(input_file), items=items)
