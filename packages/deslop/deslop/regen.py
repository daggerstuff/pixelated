import json
import os
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any


def call_ollama(endpoint: str, model: str, prompt: str) -> dict[str, Any]:
    headers = {"Content-Type": "application/json", "User-Agent": "DeslopEngine/1.0"}
    api_key = os.environ.get("OLLAMA_API_KEY", "").strip()
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    clean = endpoint.strip().rstrip("/")
    url = clean if clean.endswith("/api/chat") else f"{clean}/api/chat"

    request = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "stream": False,
        "format": "json",
        "options": {"temperature": 0.95, "num_predict": 1600},
    }

    http_request = urllib.request.Request(url, data=json.dumps(request).encode("utf-8"), headers=headers, method="POST")

    try:
        with urllib.request.urlopen(http_request, timeout=900) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except (urllib.error.HTTPError, urllib.error.URLError) as exc:
        raise RuntimeError(f"Ollama chat regen failed: {exc}") from exc

    message = payload.get("message")
    if not isinstance(message, dict) or not isinstance(message.get("content"), str):
        raise RuntimeError("Ollama chat regen returned malformed payload")

    content = message["content"].strip()

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
                        if isinstance(candidate, dict):
                            return candidate
                    except json.JSONDecodeError:
                        break
                    break
        start = content.find("{", start + 1)

    raise RuntimeError(f"Ollama regen did not return valid JSON object: {content[:240]!r}")


def _build_regen_prompt(record: dict, variation: int) -> str:
    return (
        "You are an AI editor tasked with deslopping a synthetic dataset record. "
        "Rewrite the string fields in the following JSON object to remove all AI cliches, "
        "generic filler text, and overly enthusiastic tone. Make it sound highly natural, human, "
        "and concrete. Do not change the overall meaning, the keys, the IDs, or the structural metadata. "
        "Return exactly ONE valid JSON object with the exact same schema. "
        f"Variation seed: {variation}\n"
        f"Original JSON:\n{json.dumps(record, ensure_ascii=True)}"
    )


def regen_file_with_ollama(
    input_file: Path, output_file: Path, endpoint: str = "http://127.0.0.1:11434", model: str = "llama3.2"
) -> dict:
    processed = 0
    rewritten = 0
    failed = 0

    with open(input_file, encoding="utf-8") as fin, open(output_file, "w", encoding="utf-8") as fout:
        for offset, line in enumerate(fin):
            if not line.strip():
                continue

            try:
                record = json.loads(line)
            except json.JSONDecodeError:
                fout.write(line)
                continue

            processed += 1

            try:
                prompt = _build_regen_prompt(record, variation=offset)
                cleaned_record = call_ollama(endpoint, model, prompt)

                if isinstance(cleaned_record, dict) and cleaned_record:
                    fout.write(json.dumps(cleaned_record, ensure_ascii=False) + "\n")
                    rewritten += 1
                else:
                    fout.write(line)
                    failed += 1
            except Exception as e:
                print(f"Failed to regen record {offset}: {e}")
                fout.write(line)
                failed += 1

    return {"records_processed": processed, "records_rewritten_via_llm": rewritten, "records_failed_regen": failed}
