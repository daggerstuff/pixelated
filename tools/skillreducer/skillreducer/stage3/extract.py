from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path

from skillreducer.config import Config
from skillreducer.llm.client import LLMClient
from skillreducer.llm import prompts
from skillreducer.stage3.scan import (
    CodeBlock,
    is_python_lang,
    is_shell_lang,
    scan_script_blocks,
)
from skillreducer.tokenizer import count_tokens


@dataclass
class BlockDecision:
    index: int
    extract: bool
    reason: str = ""
    script_name: str = ""
    replacement: str = ""


@dataclass
class ExtractResult:
    files: dict[str, str] = field(default_factory=dict)
    scripts: dict[str, str] = field(default_factory=dict)
    notes: list[str] = field(default_factory=list)


def extract_scripts_from_markdown(
    files: dict[str, str],
    llm: LLMClient | None,
    config: Config | None = None,
) -> ExtractResult:
    config = config or Config.load()
    min_script_tokens = config.min_script_tokens
    notes: list[str] = []
    updated_files: dict[str, str] = {}
    scripts: dict[str, str] = {}
    used_script_names: set[str] = set()

    original_tokens = sum(count_tokens(content) for content in files.values())

    for filename, content in files.items():
        blocks = scan_script_blocks(content)
        if not blocks:
            updated_files[filename] = content
            continue

        decisions = _review_blocks(filename, blocks, llm, min_script_tokens)
        approved = [d for d in decisions if d.extract]
        if not approved:
            updated_files[filename] = content
            notes.append(
                f"Stage 3: 0/{len(blocks)} script blocks extracted from {filename}"
            )
            continue

        new_content = content
        extracted_count = 0
        for decision in sorted(approved, key=lambda d: blocks[d.index].start, reverse=True):
            block = blocks[decision.index]
            script_name = _resolve_script_name(
                decision.script_name,
                filename,
                block.index,
                block.language,
                used_script_names,
            )
            replacement = decision.replacement.strip() or _default_run_reference(script_name, block.language)
            new_content = new_content[: block.start] + replacement + new_content[block.end :]
            scripts[f"scripts/{script_name}"] = _prepare_script_content(block.content, block.language)
            extracted_count += 1

        updated_files[filename] = new_content
        notes.append(
            f"Stage 3: extracted {extracted_count}/{len(blocks)} script blocks from {filename}"
        )

    new_tokens = sum(count_tokens(content) for content in updated_files.values())
    if scripts and new_tokens >= original_tokens:
        notes.append("Stage 3: kept original markdown (extraction did not reduce tokens)")
        return ExtractResult(files=dict(files), scripts={}, notes=notes)

    return ExtractResult(files=updated_files, scripts=scripts, notes=notes)


def _review_blocks(
    filename: str,
    blocks: list[CodeBlock],
    llm: LLMClient | None,
    min_script_tokens: int,
) -> list[BlockDecision]:
    if llm and llm.enabled:
        llm_decisions = _llm_review(filename, blocks, llm)
        if llm_decisions is not None:
            return llm_decisions
    return _heuristic_review(blocks, filename, min_script_tokens)


def _llm_review(
    filename: str,
    blocks: list[CodeBlock],
    llm: LLMClient,
) -> list[BlockDecision] | None:
    numbered = "\n\n".join(
        _format_block_for_prompt(block) for block in blocks
    )
    try:
        result = llm.complete_json(
            prompts.REVIEW_SCRIPT_EXTRACTION.format(filename=filename, blocks=numbered)
        )
    except Exception:
        return None

    if not isinstance(result, dict) or not result.get("items"):
        return None

    by_index: dict[int, BlockDecision] = {}
    for item in result["items"]:
        if not isinstance(item, dict) or "index" not in item:
            continue
        index = int(item["index"])
        extract = bool(item.get("extract", False))
        by_index[index] = BlockDecision(
            index=index,
            extract=extract,
            reason=str(item.get("reason", "")),
            script_name=str(item.get("script_name", "")),
            replacement=str(item.get("replacement", "")),
        )

    return [
        by_index.get(
            block.index,
            BlockDecision(index=block.index, extract=False, reason="not reviewed"),
        )
        for block in blocks
    ]


def _format_block_for_prompt(block: CodeBlock) -> str:
    return (
        f"[{block.index}] language={block.language} tokens={count_tokens(block.content)}\n"
        f"context_before:\n{block.context_before[-200:]}\n"
        f"code:\n{block.content}\n"
        f"context_after:\n{block.context_after[:200]}"
    )


def _heuristic_review(
    blocks: list[CodeBlock],
    filename: str,
    min_script_tokens: int,
) -> list[BlockDecision]:
    stem = Path(filename).stem
    decisions: list[BlockDecision] = []
    for block in blocks:
        extract = _heuristic_should_extract(block.content, block.language, min_script_tokens)
        ext = _default_extension(block.language)
        script_name = f"{stem}_{block.index}{ext}" if extract else ""
        replacement = _default_run_reference(script_name, block.language) if extract else ""
        decisions.append(
            BlockDecision(
                index=block.index,
                extract=extract,
                reason="heuristic: meets structural extraction criteria" if extract else "heuristic: keep inline",
                script_name=script_name,
                replacement=replacement,
            )
        )
    return decisions


def _heuristic_should_extract(content: str, language: str, min_script_tokens: int) -> bool:
    if count_tokens(content) < min_script_tokens:
        return False
    lines = [
        line
        for line in content.splitlines()
        if line.strip() and not line.strip().startswith("#")
    ]
    if len(lines) < 2:
        return False
    if is_python_lang(language):
        lower = content.lower()
        return "import " in lower or "def " in lower
    if is_shell_lang(language):
        return _looks_like_shell_script(content)
    return False


def _looks_like_shell_script(content: str) -> bool:
    patterns = (
        r"\bif\b",
        r"\bfor\b",
        r"\bwhile\b",
        r"\bfi\b",
        r"\bdone\b",
        r"\|\|",
        r"&&",
        r"\|",
        r"\bexport\b",
        r"\blocal\b",
        r"\bcurl\b",
        r"\bwget\b",
        r"\bsudo\b",
        r"\bapt\b",
        r"\byum\b",
        r"\bdnf\b",
        r"\bdocker\b",
        r"\bgit\b",
        r"\bchmod\b",
        r"\bmkdir\b",
        r"\bcd\b",
    )
    return any(re.search(pattern, content) for pattern in patterns)


def _default_extension(language: str) -> str:
    return ".sh" if is_shell_lang(language) else ".py"


def _default_run_reference(script_name: str, language: str) -> str:
    runner = "bash" if is_shell_lang(language) or script_name.endswith(".sh") else "python"
    return f"Run: `{runner} scripts/{script_name}`"


def _prepare_script_content(content: str, language: str) -> str:
    body = content.rstrip() + "\n"
    if is_shell_lang(language) and not body.lstrip().startswith("#!"):
        return "#!/usr/bin/env bash\n" + body
    return body


def _resolve_script_name(
    proposed: str,
    source_filename: str,
    block_index: int,
    language: str,
    used: set[str],
) -> str:
    stem = re.sub(r"\.md$", "", source_filename, flags=re.IGNORECASE)
    default_ext = _default_extension(language)
    if proposed.strip():
        base = _sanitize_script_name(proposed)
        if not Path(base).suffix:
            base = f"{base}{default_ext}"
    else:
        base = f"{stem}_{block_index}{default_ext}"

    if is_shell_lang(language) and base.endswith(".py"):
        base = f"{Path(base).stem}.sh"
    elif is_python_lang(language) and base.endswith(".sh"):
        base = f"{Path(base).stem}.py"

    candidate = base
    suffix = 2
    while candidate in used:
        path = Path(candidate)
        candidate = f"{path.stem}_{suffix}{path.suffix or default_ext}"
        suffix += 1
    used.add(candidate)
    return candidate


def _sanitize_script_name(name: str) -> str:
    name = name.replace("\\", "/").split("/")[-1]
    name = re.sub(r"[^a-zA-Z0-9_.-]", "_", name)
    name = re.sub(r"_+", "_", name).strip("._")
    return name or "script.py"
