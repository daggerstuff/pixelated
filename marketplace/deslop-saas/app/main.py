"""Deslop SaaS — FastAPI HTTP API wrapping the deslop dataset hygiene engine."""

from __future__ import annotations

import os
import tempfile
from pathlib import Path
from typing import Annotated

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse, PlainTextResponse, Response

from deslop.engine import CleanOptions, apply_deslop_to_file, preview_file
from deslop.models import CleanReport, PreviewReport, RegenReport, ScanReport, dump_json
from deslop.regen import OllamaClient, OpenAICompatibleClient, regen_file
from deslop.reports import write_report
from deslop.rules.core import DEFAULT_RULE_PACKS, RuleSet, load_rule_set
from deslop.scanner import ScanOptions, scan_file

app = FastAPI(
    title="Deslop SaaS — Dataset Hygiene API",
    description=(
        "HTTP API for detecting and removing AI-generated slop from JSON/JSONL datasets. "
        "Scan for filler phrases, clean datasets, preview changes, optionally regenerate with LLMs."
    ),
    version="0.3.0",
    license_info={"name": "MIT"},
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _parse_csv(value: str | None) -> tuple[str, ...]:
    if value is None or not value.strip():
        return ()
    return tuple(item.strip() for item in value.split(",") if item.strip())


def _build_rules(rules_text: str | None, packs: str | None) -> RuleSet:
    """Build a RuleSet from an optional uploaded rules.yaml body and pack names."""
    pack_list = list(_parse_csv(packs))
    if rules_text:
        tmp = Path(tempfile.mkstemp(suffix=".yaml")[1])
        tmp.write_text(rules_text, encoding="utf-8")
        try:
            return load_rule_set(tmp, pack_list)
        finally:
            try:
                tmp.unlink()
            except OSError:
                pass
    return load_rule_set(None, pack_list)


async def _persist_upload(upload: UploadFile) -> Path:
    """Persist an UploadFile to a temp path and return it."""
    suffix = Path(upload.filename or "data.jsonl").suffix or ".jsonl"
    fd, name = tempfile.mkstemp(suffix=suffix)
    os.close(fd)
    path = Path(name)
    content = await upload.read()
    path.write_bytes(content)
    return path


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@app.get("/health", summary="Health check")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "deslop-saas", "version": "0.3.0"}


@app.get("/rules", summary="List available rule packs")
async def list_rules() -> dict[str, object]:
    """List the bundled rule packs and the default marker count."""
    return {
        "packs": {name: len(markers) for name, markers in DEFAULT_RULE_PACKS.items()},
        "default_markers": len(RuleSet.default().markers),
    }


@app.post("/scan", summary="Scan a dataset for AI slop")
async def scan_endpoint(
    file: Annotated[UploadFile, File(description="JSON array or JSONL file to scan.")],
    packs: Annotated[str | None, Form(description="Comma-separated bundled rule packs.")] = None,
    fields: Annotated[str | None, Form(description="Comma-separated field path filters.")] = None,
    sample: Annotated[int | None, Form(description="Scan only the first N records.")] = None,
    finding_limit: Annotated[int, Form(description="Max findings to return.")] = 200,
    rules: Annotated[str | None, Form(description="Custom rules.yaml body (optional).")] = None,
) -> JSONResponse:
    path = await _persist_upload(file)
    try:
        active_rules = _build_rules(rules, packs)
        report: ScanReport = scan_file(
            path,
            ScanOptions(
                rules=active_rules,
                fields=_parse_csv(fields),
                sample=sample,
                finding_limit=finding_limit,
            ),
        )
        return JSONResponse(content=report.to_dict())
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    finally:
        try:
            path.unlink()
        except OSError:
            pass


@app.post("/clean", summary="Clean a dataset and return cleaned JSONL")
async def clean_endpoint(
    file: Annotated[UploadFile, File(description="JSON array or JSONL file to clean.")],
    packs: Annotated[str | None, Form(description="Comma-separated bundled rule packs.")] = None,
    fields: Annotated[str | None, Form(description="Comma-separated field path filters.")] = None,
    rules: Annotated[str | None, Form(description="Custom rules.yaml body (optional).")] = None,
) -> Response:
    path = await _persist_upload(file)
    out_path = Path(tempfile.mkstemp(suffix=".jsonl")[1])
    try:
        active_rules = _build_rules(rules, packs)
        report: CleanReport = apply_deslop_to_file(
            path, out_path, CleanOptions(rules=active_rules, fields=_parse_csv(fields))
        )
        cleaned_bytes = out_path.read_bytes()
        headers = {
            "Content-Disposition": 'attachment; filename="deslop-cleaned.jsonl"',
            "X-Records-Processed": str(report.records_processed),
            "X-Records-Rewritten": str(report.records_rewritten),
            "X-Fields-Rewritten": str(report.fields_rewritten),
        }
        return Response(content=cleaned_bytes, media_type="application/x-ndjson", headers=headers)
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    finally:
        try:
            path.unlink()
        except OSError:
            pass
        try:
            out_path.unlink()
        except OSError:
            pass


@app.post("/preview", summary="Preview deslop changes without writing a file")
async def preview_endpoint(
    file: Annotated[UploadFile, File(description="JSON array or JSONL file to preview.")],
    packs: Annotated[str | None, Form(description="Comma-separated bundled rule packs.")] = None,
    fields: Annotated[str | None, Form(description="Comma-separated field path filters.")] = None,
    limit: Annotated[int, Form(description="Max preview items to return.")] = 20,
    rules: Annotated[str | None, Form(description="Custom rules.yaml body (optional).")] = None,
) -> JSONResponse:
    path = await _persist_upload(file)
    try:
        active_rules = _build_rules(rules, packs)
        report: PreviewReport = preview_file(
            path,
            CleanOptions(rules=active_rules, fields=_parse_csv(fields)),
            limit=limit,
        )
        return JSONResponse(content=report.to_dict())
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    finally:
        try:
            path.unlink()
        except OSError:
            pass


@app.post("/regen", summary="Regenerate flagged records with an LLM")
async def regen_endpoint(
    file: Annotated[UploadFile, File(description="JSON array or JSONL file to regenerate.")],
    packs: Annotated[str | None, Form(description="Comma-separated bundled rule packs.")] = None,
    fields: Annotated[str | None, Form(description="Comma-separated field path filters.")] = None,
    all_records: Annotated[bool, Form(description="Regenerate all records, not only flagged ones.")] = False,
    provider: Annotated[str, Form(description="LLM provider: 'ollama' or 'openai-compatible'.")] = "ollama",
    endpoint: Annotated[str | None, Form(description="LLM endpoint (defaults to DESLOP_LLM_ENDPOINT).")] = None,
    model: Annotated[str | None, Form(description="LLM model (defaults to DESLOP_LLM_MODEL).")] = None,
    api_key_env: Annotated[str, Form(description="Env var name for OpenAI-compatible API key.")] = "OPENAI_API_KEY",
    rules: Annotated[str | None, Form(description="Custom rules.yaml body (optional).")] = None,
) -> Response:
    llm_endpoint = endpoint or os.environ.get("DESLOP_LLM_ENDPOINT", "").strip()
    llm_model = model or os.environ.get("DESLOP_LLM_MODEL", "").strip()

    if not llm_endpoint:
        raise HTTPException(
            status_code=400,
            detail="No LLM endpoint configured. Set DESLOP_LLM_ENDPOINT or pass 'endpoint' form field.",
        )
    if not llm_model:
        raise HTTPException(
            status_code=400,
            detail="No LLM model configured. Set DESLOP_LLM_MODEL or pass 'model' form field.",
        )

    path = await _persist_upload(file)
    out_path = Path(tempfile.mkstemp(suffix=".jsonl")[1])
    try:
        active_rules = _build_rules(rules, packs)
        if provider == "ollama":
            client = OllamaClient(endpoint=llm_endpoint, model=llm_model)
        elif provider == "openai-compatible":
            client = OpenAICompatibleClient(endpoint=llm_endpoint, model=llm_model, api_key_env=api_key_env)
        else:
            raise HTTPException(status_code=400, detail="provider must be 'ollama' or 'openai-compatible'")

        report: RegenReport = regen_file(
            path,
            out_path,
            client,
            only_flagged=not all_records,
            rules=active_rules,
        )
        cleaned_bytes = out_path.read_bytes()
        headers = {
            "Content-Disposition": 'attachment; filename="deslop-regen.jsonl"',
            "X-Records-Processed": str(report.records_processed),
            "X-Records-Rewritten-Via-Llm": str(report.records_rewritten_via_llm),
            "X-Records-Failed-Regen": str(report.records_failed_regen),
        }
        return Response(content=cleaned_bytes, media_type="application/x-ndjson", headers=headers)
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    finally:
        try:
            path.unlink()
        except OSError:
            pass
        try:
            out_path.unlink()
        except OSError:
            pass


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=False)
