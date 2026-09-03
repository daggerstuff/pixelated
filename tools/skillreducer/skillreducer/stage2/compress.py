from __future__ import annotations

import re
from collections import defaultdict

from skillreducer.llm.client import LLMClient
from skillreducer.llm import prompts
from skillreducer.models import ContentItem, ContentType


def compress_core(items: list[ContentItem]) -> str:
    lines: list[str] = []
    for item in items:
        for line in item.text.splitlines():
            stripped = line.strip()
            if not stripped or stripped.startswith("#"):
                continue
            if stripped.startswith(("-", "*", "1.", "2.", "3.")):
                lines.append(stripped)
            else:
                lines.append(f"- {stripped}")
    deduped = _dedupe_lines(lines)
    return "\n".join(deduped).strip()


def compress_examples(items: list[ContentItem]) -> str:
    grouped: dict[str, list[str]] = defaultdict(list)
    for item in items:
        key = _concept_key(item.text)
        grouped[key].append(item.text)
    selected = [group[0] for group in grouped.values()]
    return "\n\n".join(_strip_boilerplate(s) for s in selected).strip()


def compress_templates(items: list[ContentItem]) -> str:
    return compress_examples(items)


def compress_background(items: list[ContentItem], llm: LLMClient | None) -> str:
    joined = "\n\n".join(item.text for item in items)
    if llm and llm.enabled and joined:
        return llm.complete(prompts.SUMMARIZE_BACKGROUND.format(content=joined[:8000])).strip()
    sentences = re.split(r"(?<=[.!?])\s+", joined)
    return " ".join(sentences[:3]).strip()


def _concept_key(text: str) -> str:
    heading = text.splitlines()[0].lower()
    return re.sub(r"[^a-z0-9]+", "-", heading)[:60] or "example"


def _strip_boilerplate(text: str) -> str:
    lines = []
    for line in text.splitlines():
        if line.strip().startswith("#") and "example" in line.lower():
            continue
        lines.append(line)
    return "\n".join(lines).strip()


def _dedupe_lines(lines: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for line in lines:
        key = re.sub(r"\s+", " ", line.lower())
        if key in seen:
            continue
        seen.add(key)
        out.append(line)
    return out
