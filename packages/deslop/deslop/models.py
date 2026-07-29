import json
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import TypeAlias

JsonValue: TypeAlias = dict[str, "JsonValue"] | list["JsonValue"] | str | int | float | bool | None
JsonObject: TypeAlias = dict[str, JsonValue]


@dataclass(frozen=True, slots=True)
class Finding:
    record_index: int
    record_id: str
    field_path: str
    pattern: str
    snippet: str
    category: str = ""  # canonical 17-value BiasType value (GENDER, RACIAL, etc.) or "slop"; from deslop engine substrate (PIX-4078)


@dataclass(frozen=True, slots=True)
class ScanReport:
    file: str
    records_scanned: int
    records_flagged: int
    slop_density_pct: float
    top_slop_patterns: dict[str, int]
    fields_affected: dict[str, int]
    findings: list[Finding] = field(default_factory=list)

    def to_dict(self) -> dict[str, JsonValue]:
        return {
            "file": self.file,
            "records_scanned": self.records_scanned,
            "records_flagged": self.records_flagged,
            "slop_density_pct": self.slop_density_pct,
            "top_slop_patterns": self.top_slop_patterns,
            "fields_affected": self.fields_affected,
            "findings": [asdict(finding) for finding in self.findings],
        }


@dataclass(frozen=True, slots=True)
class CleanReport:
    records_processed: int
    records_rewritten: int
    fields_rewritten: int
    output_file: str

    def to_dict(self) -> dict[str, JsonValue]:
        return asdict(self)


@dataclass(frozen=True, slots=True)
class PreviewItem:
    record_id: str
    field_path: str
    before: str
    after: str


@dataclass(frozen=True, slots=True)
class PreviewReport:
    file: str
    items: list[PreviewItem]

    def to_dict(self) -> dict[str, JsonValue]:
        return {"file": self.file, "items": [asdict(item) for item in self.items]}


@dataclass(frozen=True, slots=True)
class RegenReport:
    records_processed: int
    records_rewritten_via_llm: int
    records_failed_regen: int
    output_file: str

    def to_dict(self) -> dict[str, JsonValue]:
        return asdict(self)


def dump_json(data: dict[str, JsonValue]) -> str:
    return json.dumps(data, ensure_ascii=False, indent=2)


def write_json_report(path: Path, data: dict[str, JsonValue]) -> None:
    path.write_text(dump_json(data) + "\n", encoding="utf-8")
