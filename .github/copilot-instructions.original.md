# Copilot Instructions — Pixelated

Concise repository guidance for GitHub Copilot in this project.

## 1) Project identity

- **Project**: Pixelated Empathy
- **Domain**: Therapeutic training and conversational analysis
- **Stack**: Astro, React 19, TypeScript, Express, Python AI pipelines
- **Data**: MongoDB, Redis, PostgreSQL, vector stores
- **Package managers**: `pnpm` (Node/TS), `uv` (Python)

## 2) Non-negotiables

- Do not ship suppression comments to hide issues.
  - `// @ts-ignore`, `# noqa`, `# type: ignore`, `/* eslint-disable */`
- Allowed exception only: `# type: ignore[import-untyped]` for missing
  third-party stubs, with reason in comment.
- Never include credentials, patient data, or sensitive info in code, logs,
  tests, or commits.
- Preserve therapeutic and privacy context in user-facing output.
- Do not use `context-mode` or `context-mode_*` workflows.
- Verify behavior before declaring completion.

## 3) NVIDIA NIM Setup

This project is pre-configured to use NVIDIA NIM (NVIDIA Inference
Microservices) as a custom model provider for GitHub Copilot CLI.

### Quick Start

To configure your environment for NVIDIA NIM:

```bash
source .github/copilot/nim-byok.sh
```

This script sets the following environment variables:

- `COPILOT_PROVIDER_BASE_URL="https://integrate.api.nvidia.com/v1"`
- `COPILOT_PROVIDER_API_KEY="${NVIDIA_API_KEY}"` (requires NVIDIA_API_KEY to be
  set)
- `COPILOT_PROVIDER_TYPE="openai"`
- `COPILOT_MODEL="openai/gpt-oss-120b"` (default)
- `COPILOT_PROVIDER_MODEL_ID="openai/gpt-oss-120b"` (default)
- Token limits tuned for the selected NIM model

### Available NIM Models

You can switch between different NVIDIA NIM models by setting the
`COPILOT_MODEL` environment variable:

| Model ID                                   | Context Length | Best For                                 |
| ------------------------------------------ | -------------- | ---------------------------------------- |
| `openai/gpt-oss-120b`                      | 128K+          | General coding and reasoning             |
| `nvidia/llama-3.3-nemotron-super-49b-v1.5` | 256K+          | Complex coding and therapeutic reasoning |
| `z-ai/glm-5.1`                             | 128K           | General purpose tasks                    |
| `deepseek-ai/deepseek-v3.2`                | 128K           | Code + mathematical reasoning            |
| `moonshotai/kimi-k2.6`                     | 256K           | Long context tasks                       |
| `minimaxai/minimax-2.7`                    | 128K           | Multi-step reasoning                     |

### Switching Models

To temporarily use a different model for a session:

```bash
export COPILOT_MODEL="openai/gpt-oss-120b"
copilot <your-command>
```

Or make it persistent by adding to your shell profile:

```bash
echo 'export COPILOT_MODEL="openai/gpt-oss-120b"' >> ~/.bashrc
```

### Rate Limit Handling

The project includes a `copilot-safe-run.sh` script that provides automatic
fallback and retry logic for handling rate limits:

```bash
# Instead of running copilot directly, use:
scripts/devops/copilot-safe-run.sh copilot <args>
```

This script will:

1. Try the primary model with retry logic
2. Automatically fall back to alternative models on rate limit errors
3. Use exponential backoff for retries

### Verification

To verify your NVIDIA NIM setup is working correctly:

```bash
# Check that environment variables are set
echo $COPILOT_PROVIDER_BASE_URL
echo $COPILOT_MODEL
echo $COPILOT_PROVIDER_MODEL_ID

# Test with a simple command
scripts/devops/copilot-safe-run.sh copilot --version
```

### Persistent GitHub auth

To avoid re-authenticating in every new terminal, set your GitHub token in a
shell startup file such as `~/.bashrc` or `~/.zshrc`:

```bash
export GH_TOKEN="ghp_your_token_here"
export GITHUB_TOKEN="$GH_TOKEN"
```

Copilot CLI accepts either variable, with `GH_TOKEN` taking precedence. If you
already use `gh auth login`, you can also rely on that session instead of
hardcoding a token in your shell profile.

## 4) Structure and conventions

- `src/`: Astro + React app, routes, shared TypeScript libraries.
- `ai/`: Python AI code (own commit discipline).
- `scripts/`: launcher and deployment helpers.
- `tests/`: integration, browser, security, and API tests.
- `.agent/internal/`: durable private docs, plans, and runbooks.

## 5) Core commands

### Development

- `pnpm dev`
- `pnpm dev:all-services`
- `pnpm dev:bias-detection`
- `pnpm dev:ai-service`
- `pnpm dev:training-server`
- `pnpm dev:websocket`
- `uv run pytest`

### Validation

- `pnpm test`, `pnpm test:unit`, `pnpm test:integration`
- `pnpm test:evals`, `pnpm test:bias-detection`
- `pnpm e2e`, `pnpm e2e:ui`, `pnpm e2e:debug`
- `pnpm lint`, `pnpm lint:fix`, `pnpm format`, `pnpm format:check`,
  `pnpm typecheck`
- `pnpm security:check` for security-relevant changes.

### Release

- `pnpm build`, `pnpm build:analyze`
- `pnpm deploy`, `pnpm deploy:prod`

## 6) Memory continuity

For active work and cross-session context, use **Foresight MCP**.

- Primary: `Foresight MCP` (task state, ownership, continuity).
- Secondary durable: `.agent/internal/` docs and plans.

### 6.1) Foresight MCP

- Launcher: `scripts/memory/foresight-mcp-server.sh`
- Config: `scripts/memory/mcp-config.json`
- Core tools:
  - `manage_memories`
  - `search_memories` / `query_memories`
  - `manage_subconscious`
  - `process_session_transcript`
  - `inject_context`
  - `query_memories_temporal`
  - `manage_entities`, `query_entities`
  - `analyze_memories`
  - `get_system_status`

Orientation flow:

1. `manage_subconscious` (`action: list`)
2. `manage_subconscious` (`action: get`, label `pending_items`)
3. `manage_subconscious` (`action: get`, label `project_context`)
4. `query_memories` for active and upcoming work signals
5. `manage_entities` (`action: extract`) when semantic context is useful

## 7) `.agent/internal` references

- `.agent/internal/plans/`
- `.agent/internal/guides/`
- `.agent/internal/decisions.md`
- `.agent/internal/current/`
- `.agent/internal/upcoming/`

## 8) MCP and model nuance

- `context7` is available for documentation lookup when needed.
- Enabled: `context7`, `linear`, `brave-search`, `firecrawl`.
- Disabled: `github`, `playwright`, `sentry`, `e2b-sandbox`.
- Use standard tooling when those are unavailable.
