from __future__ import annotations

import re

from skillreducer.llm.client import LLMClient
from skillreducer.llm import prompts
from skillreducer.models import ContentItem, ContentType


def split_paragraphs(body: str) -> list[str]:
    blocks: list[str] = []
    current: list[str] = []
    for line in body.splitlines():
        if line.strip() == "" and current:
            blocks.append("\n".join(current).strip())
            current = []
        else:
            current.append(line)
    if current:
        blocks.append("\n".join(current).strip())
    return [b for b in blocks if b]


def classify_paragraphs(paragraphs: list[str], llm: LLMClient | None) -> list[ContentItem]:
    if llm and llm.enabled and paragraphs:
        numbered = "\n\n".join(f"[{i}] {p}" for i, p in enumerate(paragraphs))
        result = llm.complete_json(prompts.CLASSIFY_PARAGRAPHS.format(paragraphs=numbered))
        if isinstance(result, dict) and result.get("items"):
            mapping = {
                int(item["index"]): ContentType(item["type"])
                for item in result["items"]
                if isinstance(item, dict) and "index" in item and "type" in item
            }
            return [
                ContentItem(text=p, content_type=mapping.get(i, ContentType.CORE_RULE), index=i)
                for i, p in enumerate(paragraphs)
            ]
    return [_heuristic_classify(p, i) for i, p in enumerate(paragraphs)]


def _heuristic_classify(paragraph: str, index: int) -> ContentItem:
    lower = paragraph.lower()
    heading = paragraph.splitlines()[0].lower() if paragraph else ""

    if re.search(r"```", paragraph) and any(k in lower for k in ("example", "input:", "output:")):
        content_type = ContentType.EXAMPLE
    elif any(k in heading for k in ("example", "examples")):
        content_type = ContentType.EXAMPLE
    elif any(k in heading for k in ("template", "boilerplate", "format")):
        content_type = ContentType.TEMPLATE
    elif any(k in heading for k in ("background", "rationale", "why", "overview")):
        content_type = ContentType.BACKGROUND
    elif paragraph.strip() == paragraph.strip().upper() and len(paragraph) < 120:
        content_type = ContentType.REDUNDANT
    elif paragraph.count(paragraph[:40]) > 1:
        content_type = ContentType.REDUNDANT
    else:
        content_type = ContentType.CORE_RULE

    return ContentItem(text=paragraph, content_type=content_type, index=index)
