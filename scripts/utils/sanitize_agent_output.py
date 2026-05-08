#!/usr/bin/env python3
"""Sanitize agent/internal protocol markers from text output."""

from __future__ import annotations

import os
import re
import sys
from collections.abc import Callable

THOUGHT_MARKER_RE = re.compile(r"\[Thought:\s*.*?\]")
STOP_TURN_RE = re.compile(r"\[STOP_TURN\]")
PROMISE_RE = re.compile(r"<promise>(.*?)</promise>", re.IGNORECASE | re.DOTALL)
CHECK_MARKER_RE = re.compile(r"^\s*[✓✦]\s*")


LineSanitizer = Callable[[str], str]


def strip_thought_markers(line: str) -> str:
    return THOUGHT_MARKER_RE.sub("", line)


def strip_turn_markers(line: str) -> str:
    return STOP_TURN_RE.sub("", line)


def strip_promise_blocks(line: str) -> str:
    def _replace(match: re.Match[str]) -> str:
        body = match.group(1).strip()
        if body.upper() == "COMPLETE":
            return "__RALPH_PROMISE_COMPLETE__"
        return body

    return PROMISE_RE.sub(_replace, line)


def strip_check_marker_prefix(line: str) -> str:
    return CHECK_MARKER_RE.sub("", line)


TRANSFORMERS: list[LineSanitizer] = [
    strip_thought_markers,
    strip_turn_markers,
    strip_promise_blocks,
    strip_check_marker_prefix,
]


def sanitize_agent_output(raw_text: str | None) -> str:
    """Strip internal markers and noisy protocol lines from output."""
    if not raw_text:
        return ""

    cleaned_lines: list[str] = []
    for raw_line in raw_text.splitlines():
        sanitized_line = raw_line
        for sanitizer in TRANSFORMERS:
            sanitized_line = sanitizer(sanitized_line)
        if not sanitized_line.strip():
            continue
        cleaned_lines.append(sanitized_line.rstrip())

    return "\n".join(cleaned_lines)


def main() -> None:
    raw = os.environ.get("AGENT_OUTPUT_SANITIZE_INPUT")
    if raw is None:
        raw = sys.stdin.read()
    sanitized_output = sanitize_agent_output(raw)
    sys.stdout.write(sanitized_output)
    if sanitized_output and sanitized_output[-1] != "\n":
        sys.stdout.write("\n")


if __name__ == "__main__":
    main()

