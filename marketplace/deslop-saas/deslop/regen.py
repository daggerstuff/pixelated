import json
import os
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

from deslop.io import read_records, write_jsonl
from deslop.models import JsonObject, RegenReport
from deslop.rules.core import RuleSet
from deslop.scanner import ScanOptions, scan_file


class RegenClient(Protocol):
    def regenerate(self, record: JsonObject, variation: int) -> JsonObject: ...


@dataclass(frozen=True, slots=True)
class OllamaClient:
    endpoint: str
    model: str

    def regenerate(self, record: JsonObject, variation: int) -> JsonObject:
        prompt = build_regen_prompt(record, variation)
        payload = call_ollama(self.endpoint, self.model, prompt)
        assert_same_schema(record, payload)
        return payload


@dataclass(frozen=True, slots=True)
class OpenAICompatibleClient:
    endpoint: str
    model: str
    api_key_env: str = "OPENAI_API_KEY"

    def regenerate(self, record: JsonObject, variation: int) -> JsonObject:
        prompt = build_regen_prompt(record, variation)
        payload = call_openai_compatible(self.endpoint, self.model, prompt, self.api_key_env)
        assert_same_schema(record, payload)
        return payload


def call_ollama(endpoint: str, model: str, prompt: str) -> JsonObject:
    headers = {"Content-Type": "application/json", "User-Agent": "DeslopEngine/1.0"}
    api_key = os.environ.get("OLLAMA_API_KEY", "").strip()
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    url = endpoint.strip().rstrip("/")
    request = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "stream": False,
        "format": "json",
        "options": {"temperature": 0.75, "num_predict": 1600},
    }
    http_request = urllib.request.Request(
        url if url.endswith("/api/chat") else f"{url}/api/chat",
        data=json.dumps(request).encode("utf-8"),
        headers=headers,
        method="POST",
    )
    try:
        with urllib.request.urlopen(http_request, timeout=120) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raise RuntimeError(f"Ollama HTTP {exc.code}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Ollama connection failed: {exc.reason}") from exc

    message = payload.get("message")
    if not isinstance(message, dict) or not isinstance(message.get("content"), str):
        raise RuntimeError("Ollama returned malformed chat payload")
    return parse_json_object(message["content"])


def call_openai_compatible(endpoint: str, model: str, prompt: str, api_key_env: str) -> JsonObject:
    api_key = os.environ.get(api_key_env, "").strip()
    if not api_key:
        raise RuntimeError(f"{api_key_env} is required for OpenAI-compatible regeneration")

    clean = endpoint.strip().rstrip("/")
    url = clean if clean.endswith("/chat/completions") else f"{clean}/chat/completions"
    request = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.75,
        "response_format": {"type": "json_object"},
    }
    http_request = urllib.request.Request(
        url,
        data=json.dumps(request).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
            "User-Agent": "DeslopEngine/1.0",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(http_request, timeout=120) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raise RuntimeError(f"OpenAI-compatible HTTP {exc.code}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"OpenAI-compatible connection failed: {exc.reason}") from exc

    choices = payload.get("choices")
    if not isinstance(choices, list) or not choices:
        raise RuntimeError("OpenAI-compatible provider returned no choices")
    message = choices[0].get("message")
    if not isinstance(message, dict) or not isinstance(message.get("content"), str):
        raise RuntimeError("OpenAI-compatible provider returned malformed payload")
    return parse_json_object(message["content"])


def parse_json_object(content: str) -> JsonObject:
    """Extract the first balanced JSON object from `content` that parses as a dict.

    Malformed JSON (e.g. unterminated strings, trailing commas) raises
    ``RuntimeError`` so callers like ``regen_file`` can catch and skip the
    record gracefully instead of propagating ``json.JSONDecodeError`` (which
    is a subclass of ``ValueError``, not ``RuntimeError``).
    """
    start = content.find("{")
    while start >= 0:
        depth = 0
        for index in range(start, len(content)):
            char = content[index]
            if char == "{":
                depth += 1
            elif char == "}":
                depth -= 1
                if depth == 0:
                    try:
                        candidate = json.loads(content[start : index + 1])
                    except json.JSONDecodeError as exc:
                        raise RuntimeError(f"LLM returned malformed JSON object: {content[:240]!r}") from exc
                    if isinstance(candidate, dict):
                        return candidate
        start = content.find("{", start + 1)
    raise RuntimeError(f"LLM did not return a JSON object: {content[:240]!r}")


def build_regen_prompt(record: JsonObject, variation: int) -> str:
    return (
        "Rewrite only string values in this JSON dataset record to remove AI clichés, generic filler, "
        "and overly polished assistant tone. Preserve meaning, keys, IDs, field types, arrays, and metadata. "
        "Return exactly one valid JSON object with the same schema.\n"
        f"Variation seed: {variation}\n"
        f"Original JSON:\n{json.dumps(record, ensure_ascii=True)}"
    )


def assert_same_schema(original: JsonObject, candidate: JsonObject) -> None:
    if set(original.keys()) != set(candidate.keys()):
        raise RuntimeError("LLM output changed top-level schema")


def regen_file_with_ollama(
    input_file: Path,
    output_file: Path,
    endpoint: str = "http://127.0.0.1:11434",
    model: str = "llama3.2",
    only_flagged: bool = True,
    rules: RuleSet | None = None,
) -> RegenReport:
    return regen_file(input_file, output_file, OllamaClient(endpoint=endpoint, model=model), only_flagged, rules)


def regen_file(
    input_file: Path,
    output_file: Path,
    client: RegenClient,
    only_flagged: bool = True,
    rules: RuleSet | None = None,
) -> RegenReport:
    flagged_ids = set[str]()
    if only_flagged:
        # Effectively unbounded: the default finding_limit caps findings (for
        # scan reports); leaving it capped would silently drop flagged records
        # beyond the cap from regen.
        report = scan_file(
            input_file,
            ScanOptions(rules=rules, finding_limit=sys.maxsize),
        )
        flagged_ids = {finding.record_id for finding in report.findings}

    processed = 0
    rewritten = 0
    failed = 0
    output_records: list[JsonObject] = []
    for record in read_records(input_file):
        processed += 1
        if only_flagged and record.record_id not in flagged_ids:
            output_records.append(record.value)
            continue
        try:
            output_records.append(client.regenerate(record.value, record.index))
            rewritten += 1
        except RuntimeError:
            output_records.append(record.value)
            failed += 1

    write_jsonl(output_file, output_records)
    return RegenReport(
        records_processed=processed,
        records_rewritten_via_llm=rewritten,
        records_failed_regen=failed,
        output_file=str(output_file),
    )
