import json
from collections.abc import Iterator
from dataclasses import dataclass
from pathlib import Path

from deslop.models import JsonObject, JsonValue


@dataclass(frozen=True, slots=True)
class DatasetRecord:
    index: int
    raw_line: str
    value: JsonObject

    @property
    def record_id(self) -> str:
        candidate = self.value.get("id")
        if isinstance(candidate, str | int | float):
            return str(candidate)
        return str(self.index + 1)


def read_records(path: Path) -> Iterator[DatasetRecord]:
    text = path.read_text(encoding="utf-8")
    stripped = text.lstrip()
    if stripped.startswith("["):
        try:
            payload = json.loads(text)
        except json.JSONDecodeError as exc:
            raise RuntimeError(f"malformed JSON array: {path}") from exc
        if not isinstance(payload, list):
            return
        for index, item in enumerate(payload):
            if isinstance(item, dict):
                yield DatasetRecord(index=index, raw_line=json.dumps(item, ensure_ascii=False), value=item)
        return

    for index, line in enumerate(text.splitlines()):
        if not line.strip():
            continue
        try:
            item = json.loads(line)
        except json.JSONDecodeError:
            continue
        if isinstance(item, dict):
            yield DatasetRecord(index=index, raw_line=line, value=item)


def write_jsonl(path: Path, records: list[JsonObject]) -> None:
    path.write_text(
        "".join(json.dumps(record, ensure_ascii=False) + "\n" for record in records),
        encoding="utf-8",
    )


def clone_json(value: JsonObject) -> JsonObject:
    cloned = json.loads(json.dumps(value, ensure_ascii=False))
    if isinstance(cloned, dict):
        return cloned
    return {}


def string_fields(value: JsonValue, prefix: str = "") -> Iterator[tuple[str, str]]:
    if isinstance(value, dict):
        for key, child in value.items():
            child_path = key if not prefix else f"{prefix}.{key}"
            yield from string_fields(child, child_path)
    elif isinstance(value, list):
        for index, child in enumerate(value):
            yield from string_fields(child, f"{prefix}[{index}]")
    elif isinstance(value, str):
        yield prefix, value


def set_field(value: JsonValue, path: str, replacement: str) -> JsonValue:
    if not path:
        return replacement
    parts = path.replace("[", ".[").split(".")
    cursor = value
    for part in parts[:-1]:
        if part.startswith("[") and isinstance(cursor, list):
            cursor = cursor[int(part.strip("[]"))]
        elif isinstance(cursor, dict):
            cursor = cursor[part]
    last = parts[-1]
    if last.startswith("[") and isinstance(cursor, list):
        cursor[int(last.strip("[]"))] = replacement
    elif isinstance(cursor, dict):
        cursor[last] = replacement
    return value
