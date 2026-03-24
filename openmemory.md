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

## Patterns

- Tool-only or partially-capable MCP servers can be wrapped behind a thin stdio compatibility proxy so Codex does not treat missing `resources/list` support as a server availability failure.
