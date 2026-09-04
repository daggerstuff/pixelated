from __future__ import annotations

from pathlib import Path

from skillreducer.llm.client import LLMClient
from skillreducer.llm import prompts
from skillreducer.models import ContentItem, ContentType, ReferenceFile
from skillreducer.stage2.classify import classify_paragraphs, split_paragraphs
from skillreducer.stage2.compress import (
    compress_background,
    compress_core,
    compress_examples,
    compress_templates,
)
from skillreducer.stage2.dedup import remove_overlap
from skillreducer.tokenizer import count_tokens

META_START = "<!-- skillreducer-meta"
META_END = "-->"


def restructure_body(
    body: str,
    llm: LLMClient | None,
    min_reference_tokens: int = 30,
) -> tuple[str, dict[str, str], list[str]]:
    notes: list[str] = []
    paragraphs = split_paragraphs(body)
    if not paragraphs:
        return body, {}, notes

    items = classify_paragraphs(paragraphs, llm)
    by_type: dict[ContentType, list[ContentItem]] = {t: [] for t in ContentType}
    for item in items:
        if item.content_type == ContentType.REDUNDANT:
            continue
        by_type[item.content_type].append(item)

    core = compress_core(by_type[ContentType.CORE_RULE])
    references: dict[str, str] = {}

    examples = compress_examples(by_type[ContentType.EXAMPLE])
    if examples and count_tokens(examples) >= min_reference_tokens:
        references["examples.md"] = examples

    templates = compress_templates(by_type[ContentType.TEMPLATE])
    if templates and count_tokens(templates) >= min_reference_tokens:
        references["templates.md"] = templates

    background = compress_background(by_type[ContentType.BACKGROUND], llm)
    if background and count_tokens(background) >= min_reference_tokens:
        references["background.md"] = background

    if references:
        notes.append(
            "Stage 2: progressive disclosure -> "
            + ", ".join(references.keys())
        )

    resource_lines = []
    if references:
        resource_lines.append("## Additional resources")
        labels = {
            "examples.md": "Examples",
            "templates.md": "Templates",
            "background.md": "Background",
        }
        for filename in references:
            label = labels.get(filename, filename)
            resource_lines.append(f"- {label}: [{filename}]({filename})")

    parts = []
    if core:
        parts.append(core)
    if resource_lines:
        parts.append("\n".join(resource_lines))

    new_body = "\n\n".join(parts).strip()
    if count_tokens(new_body) >= count_tokens(body):
        notes.append("Stage 2: kept original body (compression did not reduce tokens)")
        return body, {}, notes

    return new_body, references, notes


def annotate_reference(content: str, llm: LLMClient | None) -> tuple[str, str, list[str]]:
    when = "you need supplementary details from this reference"
    topics = ["reference"]
    if llm and llm.enabled:
        try:
            meta = llm.complete_json(prompts.GEN_REFERENCE_META.format(content=content[:4000]))
            if isinstance(meta, dict):
                when = str(meta.get("when", when))
                topics = [str(t) for t in meta.get("topics", topics)]
        except Exception:
            pass
    header = (
        f"{META_START}\n"
        f"when: {when}\n"
        f"topics: {', '.join(topics)}\n"
        f"{META_END}\n\n"
    )
    return header + content, when, topics


def write_reference_file(path: Path, content: str, llm: LLMClient | None) -> None:
    annotated, _, _ = annotate_reference(content, llm)
    path.write_text(annotated, encoding="utf-8")


def deduplicate_existing_references(
    references: list[ReferenceFile],
    body: str,
    min_reference_tokens: int,
) -> dict[str, str]:
    kept: dict[str, str] = {}
    for ref in references:
        cleaned = remove_overlap(ref.content, body, min_reference_tokens)
        if cleaned:
            kept[ref.path.name] = cleaned
    return kept
