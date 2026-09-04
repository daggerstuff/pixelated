from __future__ import annotations

import re
from dataclasses import dataclass

PYTHON_LANGS = {"python", "py"}
SHELL_LANGS = {"bash", "sh", "shell", "zsh"}
EXTRACTABLE_LANGS = PYTHON_LANGS | SHELL_LANGS

FENCE_PATTERN = re.compile(
    r"^```([^\n`]*)\n(.*?)```",
    re.MULTILINE | re.DOTALL,
)


@dataclass
class CodeBlock:
    index: int
    language: str
    content: str
    start: int
    end: int
    context_before: str
    context_after: str


def _normalize_language(lang: str) -> str:
    return lang.strip().lower()


def is_python_lang(language: str) -> bool:
    return _normalize_language(language) in PYTHON_LANGS


def is_shell_lang(language: str) -> bool:
    return _normalize_language(language) in SHELL_LANGS


def scan_script_blocks(markdown: str, context_chars: int = 200) -> list[CodeBlock]:
    blocks: list[CodeBlock] = []
    for match in FENCE_PATTERN.finditer(markdown):
        lang = _normalize_language(match.group(1))
        if lang not in EXTRACTABLE_LANGS:
            continue
        content = match.group(2)
        if not content.strip():
            continue
        start, end = match.start(), match.end()
        blocks.append(
            CodeBlock(
                index=len(blocks),
                language=lang,
                content=content,
                start=start,
                end=end,
                context_before=markdown[max(0, start - context_chars) : start],
                context_after=markdown[end : end + context_chars],
            )
        )
    return blocks


def scan_python_blocks(markdown: str, context_chars: int = 200) -> list[CodeBlock]:
    """Backward-compatible alias; returns Python and shell blocks."""
    return scan_script_blocks(markdown, context_chars=context_chars)
