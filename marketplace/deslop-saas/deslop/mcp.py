"""Standard I/O Model Context Protocol (MCP) server for Deslop & Anti-Sycophancy.

Exposes deslop cleaning, pattern scanning, and anti-sycophancy gating as native MCP
tools for AI agents (Claude Desktop, Antigravity, OpenCode, Cursor, etc.)
with zero external runtime dependencies.
"""

from __future__ import annotations

import json
import sys
from typing import Any

from deslop.engine import clean_text, scan_text
from deslop.gate import AntiSycophancyGate
from deslop.rules.core import DEFAULT_RULE_PACKS

gate = AntiSycophancyGate.default()

TOOLS: list[dict[str, Any]] = [
    {
        "name": "deslop_gate",
        "description": (
            "Validate assistant text against zero-tolerance anti-sycophancy rules. "
            "Detects sycophantic openers, reflexive caving/backtracking, canned empathy, "
            "and quote parroting. Returns pass/fail with targeted retry prompt corrections."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "text": {
                    "type": "string",
                    "description": "The assistant response text to validate.",
                },
                "general_only": {
                    "type": "boolean",
                    "description": "If true, skips clinical-specific somatic and crisis questionnaire checks.",
                    "default": False,
                },
            },
            "required": ["text"],
        },
    },
    {
        "name": "deslop_clean",
        "description": (
            "Clean AI slop and filler phrases from text using weighted deterministic replacements. "
            "Preserves meaning while removing generic buzzwords ('delve into', 'happy to help', 'moving forward')."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "text": {
                    "type": "string",
                    "description": "The text to clean.",
                },
                "packs": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Optional rule packs (e.g., ['generic-ai', 'sycophancy', 'chatbot-assistant']).",
                },
            },
            "required": ["text"],
        },
    },
    {
        "name": "deslop_scan",
        "description": ("Scan text and return all detected AI slop patterns and clichés across rule packs."),
        "inputSchema": {
            "type": "object",
            "properties": {
                "text": {
                    "type": "string",
                    "description": "The text to scan.",
                },
                "packs": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Rule packs to scan against (defaults to all active patterns).",
                },
            },
            "required": ["text"],
        },
    },
]


def handle_tool_call(name: str, arguments: dict[str, Any]) -> str:
    text = str(arguments.get("text", ""))

    if name == "deslop_gate":
        general_only = bool(arguments.get("general_only", False))
        active_gate = AntiSycophancyGate.general_assistant() if general_only else gate
        result = active_gate.check(text)
        return json.dumps(result.to_dict(), indent=2)

    if name == "deslop_clean":
        packs = arguments.get("packs")
        cleaned = clean_text(text, packs=packs)
        return json.dumps(
            {
                "original": text,
                "cleaned": cleaned,
                "changed": cleaned != text,
            },
            indent=2,
        )

    if name == "deslop_scan":
        packs = arguments.get("packs")
        hits = scan_text(text, packs=packs)
        return json.dumps(
            {
                "hit_count": len(hits),
                "patterns": hits,
                "available_packs": list(DEFAULT_RULE_PACKS.keys()),
            },
            indent=2,
        )

    raise ValueError(f"Unknown tool: {name}")


def run_stdio_server() -> None:
    """Run line-delimited JSON-RPC 2.0 loop over stdin and stdout."""
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
        except Exception:
            continue

        req_id = req.get("id")
        method = req.get("method")
        params = req.get("params", {})

        if method == "initialize":
            resp = {
                "jsonrpc": "2.0",
                "id": req_id,
                "result": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {"tools": {}},
                    "serverInfo": {"name": "deslop-mcp", "version": "0.3.0"},
                },
            }
            sys.stdout.write(json.dumps(resp) + "\n")
            sys.stdout.flush()
        elif method == "notifications/initialized":
            pass
        elif method == "ping":
            resp = {"jsonrpc": "2.0", "id": req_id, "result": {}}
            sys.stdout.write(json.dumps(resp) + "\n")
            sys.stdout.flush()
        elif method == "tools/list":
            resp = {"jsonrpc": "2.0", "id": req_id, "result": {"tools": TOOLS}}
            sys.stdout.write(json.dumps(resp) + "\n")
            sys.stdout.flush()
        elif method == "tools/call":
            tool_name = params.get("name", "")
            args = params.get("arguments", {})
            try:
                out_str = handle_tool_call(tool_name, args)
                resp = {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "result": {
                        "content": [{"type": "text", "text": out_str}],
                        "isError": False,
                    },
                }
            except Exception as exc:
                resp = {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "result": {
                        "content": [{"type": "text", "text": str(exc)}],
                        "isError": True,
                    },
                }
            sys.stdout.write(json.dumps(resp) + "\n")
            sys.stdout.flush()
        elif req_id is not None:
            resp = {
                "jsonrpc": "2.0",
                "id": req_id,
                "error": {"code": -32601, "message": f"Method {method} not found"},
            }
            sys.stdout.write(json.dumps(resp) + "\n")
            sys.stdout.flush()
