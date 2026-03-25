## Overview

Pixelated is a multi-surface application with an Astro-based web app, AI service code, test infrastructure, and local MCP integrations for tool and memory workflows.

## Architecture

- Frontend and site application logic live under `src/`.
- AI and Python-side MCP/service code live under `ai/`.
- Local editor and assistant MCP wiring lives in `.vscode/mcp.json`, `.cursor/mcp.json`, and user-level Codex config under `~/.codex/config.toml`.

## User Defined Namespaces

- 

## Components

- `scripts/utils/mcp-resource-compat-proxy.mjs`: Local stdio proxy that answers optional MCP resource-list calls with empty results while forwarding all other traffic to the wrapped server.
- `ai/api/mcp_server/memory_scope.py`: Shared scope utility for MCP memory surfaces; normalizes scope (`user/org/project/agent/run/session`), builds metadata, and provides shared scoped filtering/lookup helpers.

## Patterns

- Tool-only or partially-capable MCP servers can be wrapped behind a thin stdio compatibility proxy so Codex does not treat missing `resources/list` support as a server availability failure.
- Memory scope handling is centralized in `memory_scope.py` and reused by HTTP (`memory_server.py`), FastMCP (`fastmcp_app.py`), and stdio MCP (`mcp_stdio_server.py`) to keep isolation and shared-memory semantics consistent.
