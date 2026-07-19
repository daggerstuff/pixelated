import json
import subprocess
import sys
from pathlib import Path

from deslop.engine import CleanOptions, apply_deslop_to_file
from deslop.models import JsonObject
from deslop.regen import regen_file
from deslop.rules.core import RuleSet, load_rule_set
from deslop.scanner import ScanOptions, scan_file


def write_jsonl(path: Path, records: list[dict[str, str]]) -> None:
    path.write_text(
        "".join(json.dumps(record, ensure_ascii=False) + "\n" for record in records),
        encoding="utf-8",
    )


def test_scan_reports_field_paths_and_examples_when_markers_match(tmp_path: Path) -> None:
    # Given: a nested JSONL record containing multiple AI-slop markers.
    source = tmp_path / "data.jsonl"
    write_jsonl(
        source,
        [{"id": "r1", "messages": [{"content": "Happy to help with a robust plan moving forward."}]}],
    )

    # When: the file is scanned.
    report = scan_file(source, ScanOptions())

    # Then: the report includes field-level findings with snippets.
    assert report.records_scanned == 1
    assert report.records_flagged == 1
    assert report.findings[0].field_path == "messages[0].content"
    assert report.findings[0].pattern == "happy to help"
    assert "Happy to help" in report.findings[0].snippet


def test_clean_rewrites_detected_markers_and_preserves_schema(tmp_path: Path) -> None:
    # Given: a record with replaceable and detect-only default markers.
    source = tmp_path / "data.jsonl"
    output = tmp_path / "clean.jsonl"
    write_jsonl(source, [{"id": "r1", "text": "Happy to help with a robust plan moving forward."}])

    # When: the file is cleaned.
    report = apply_deslop_to_file(source, output, CleanOptions())

    # Then: all detected default markers are removed or rewritten.
    cleaned = json.loads(output.read_text(encoding="utf-8"))
    assert report.records_rewritten == 1
    assert cleaned["id"] == "r1"
    assert "happy to help" not in cleaned["text"].lower()
    assert "robust" not in cleaned["text"].lower()
    assert "moving forward" not in cleaned["text"].lower()


def test_custom_rules_are_loaded_without_mutating_defaults(tmp_path: Path) -> None:
    # Given: a custom rules file with one marker.
    rules_path = tmp_path / "rules.yaml"
    rules_path.write_text("markers:\n  - bespoke slop\n", encoding="utf-8")

    # When: custom rules are loaded.
    custom = load_rule_set(rules_path)
    defaults = RuleSet.default()

    # Then: custom rules include the marker and defaults remain unchanged.
    assert "bespoke slop" in custom.markers
    assert "bespoke slop" not in defaults.markers


def test_cli_supports_scan_subcommand_with_json_output(tmp_path: Path) -> None:
    # Given: a JSONL dataset.
    source = tmp_path / "data.jsonl"
    write_jsonl(source, [{"id": "r1", "text": "As discussed, happy to help."}])

    # When: the CLI scan subcommand runs with JSON output.
    result = subprocess.run(
        [sys.executable, "-m", "deslop.cli", "scan", str(source), "--json"],
        cwd=Path(__file__).resolve().parents[1],
        check=True,
        capture_output=True,
        text=True,
    )

    # Then: machine-readable scan output is emitted.
    report = json.loads(result.stdout)
    assert report["records_scanned"] == 1
    assert report["records_flagged"] == 1
    assert report["findings"][0]["field_path"] == "text"


def test_cli_preview_shows_before_after_without_writing(tmp_path: Path) -> None:
    # Given: a JSONL dataset.
    source = tmp_path / "data.jsonl"
    write_jsonl(source, [{"id": "r1", "text": "Moving forward, this is robust."}])

    # When: preview runs.
    result = subprocess.run(
        [sys.executable, "-m", "deslop.cli", "preview", str(source), "--json", "--limit", "1"],
        cwd=Path(__file__).resolve().parents[1],
        check=True,
        capture_output=True,
        text=True,
    )

    # Then: it emits a before/after preview and leaves the source unchanged.
    preview = json.loads(result.stdout)
    assert preview["items"][0]["before"] != preview["items"][0]["after"]
    assert "Moving forward" in source.read_text(encoding="utf-8")


def test_scan_field_filter_matches_list_wildcards(tmp_path: Path) -> None:
    # Given: nested messages and a wildcard field filter.
    source = tmp_path / "data.jsonl"
    write_jsonl(source, [{"id": "r1", "messages": [{"content": "Happy to help."}], "other": "Happy to help."}])

    # When: scanning only message content fields.
    report = scan_file(source, ScanOptions(fields=("messages.*.content",)))

    # Then: only the nested message field is counted.
    assert report.records_flagged == 1
    assert report.fields_affected == {"messages[0].content": 1}


def test_regen_only_rewrites_flagged_records(tmp_path: Path) -> None:
    # Given: one flagged and one clean record.
    source = tmp_path / "data.jsonl"
    output = tmp_path / "regen.jsonl"
    write_jsonl(source, [{"id": "dirty", "text": "Happy to help."}, {"id": "clean", "text": "plain text"}])

    class FakeClient:
        def regenerate(self, record: JsonObject, variation: int) -> JsonObject:
            return {**record, "text": f"rewritten-{variation}"}

    # When: regeneration runs in flagged-only mode.
    report = regen_file(source, output, FakeClient(), only_flagged=True)

    # Then: only the flagged record is sent to the client.
    records = [json.loads(line) for line in output.read_text(encoding="utf-8").splitlines()]
    assert report.records_rewritten_via_llm == 1
    assert records[0]["text"] == "rewritten-0"
    assert records[1]["text"] == "plain text"
