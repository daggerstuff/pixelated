# OpenCode + OhMyOpenAgent — Nvidia NIM Router Configuration

## Overview

This configuration uses **Nvidia NIM as a model router** for 40+ models across diverse providers. Nvidia is the default provider, but NIM surfaces models from **Qwen, DeepSeek, Mistral, Google, Meta, Moonshot AI, Z.ai, Microsoft, MiniMax, StepFun, ByteDance, and OpenAI OSS**.

## Configuration Files

| File                                      | Purpose                                          |
| ----------------------------------------- | ------------------------------------------------ |
| `~/.config/opencode/opencode.json`        | User-level: loads oh-my-openagent plugin         |
| `~/.config/opencode/oh-my-openagent.json` | User-level: agent/category model assignments      |
| `.opencode/opencode.json`                 | **Project-level: Nvidia NIM provider + models**  |
| `.opencode/oh-my-openagent.json`          | Project-level: agent/category overrides          |

## Quick Start

1. **Set Nvidia NIM API Key:**
   ```bash
   export NVIDIA_NIM_API_KEY=nvapi-xxxxxxxxxxxxxxxx
   ```

2. **Launch OpenCode:**
   ```bash
   opencode
   ```

## Model-Specific Fixes

### GLM-5 — Malformed Tool Call JSON (FIXED)

**Issue:** `z-ai/glm5` emits truncated/malformed JSON in tool call arguments via NIM's OpenAI-compatible endpoint. Root cause traced to SGLang runtime stream chunk corruption.

**Status:** NVIDIA fixed this server-side on NIM (March 2026). The config retains defensive tuning:

```json
"z-ai/glm5": {
  "temperature": 0.1,
  "top_p": 0.95,
  "frequency_penalty": 0,
  "presence_penalty": 0
}
```

**References:**
- OpenCode Issue [#13900](https://github.com/anomalyco/opencode/issues/13900)
- NVIDIA Developer Forums: [GLM-5 malformed tool-call JSON](https://forums.developer.nvidia.com/t/nim-glm-5-malformed-tool-call-json-missing-via-openai-compatible-endpoint-opencode/360809)
- SGLang Issue [#19345](https://github.com/sgl-project/sglang/issues/19345)

### Qwen 3.5 — "System message must be at the beginning" (FIXED)

**Issue:** Qwen 3.5 models (both `122b-a10b` and `397b-a17b`) enforce strict chat template rules:
1. System message MUST be the first message in the conversation
2. Only ONE system message allowed
3. `developer` role messages must be processed before the main loop

**Fix applied at two levels:**

**1. OpenCode framework (v1.2.22+):** Automatically consolidates multiple system prompts into one and ensures proper message ordering.

**2. Model-level chat_template_kwargs:** Added to opencode.json for both Qwen 3.5 models:
```json
"qwen/qwen3.5-122b-a10b": {
  "options": {
    "chat_template_kwargs": { "enable_system_prompt": true }
  }
}
```

**Note:** `qwen/qwen3.5-397b-a17b` is preferred over `122b-a10b` — it's the larger model with better agentic capabilities and the same template fix applied.

**References:**
- OpenCode Issue [#16560](https://github.com/anomalyco/opencode/issues/16560)
- OpenCode Issue [#15059](https://github.com/anomalyco/opencode/issues/15059)
- QwenLM/Qwen3 Issue [#1831](https://github.com/QwenLM/Qwen3/issues/1831) — 21 chat template fixes

## Model Assignments

### Agent Model Assignments

| Agent               | Primary                                      | Fallbacks                                            |
| ------------------- | -------------------------------------------- | ---------------------------------------------------- |
| `sisyphus`          | Nemotron Ultra 253B                          | Qwen 3.5 397B, DeepSeek V3.2, Mistral Large 3        |
| `hephaestus`        | Nemotron Ultra 253B                          | Qwen 3 Coder 480B, Devstral 2, Qwen 3.5 397B         |
| `oracle`            | Nemotron Ultra 253B                          | DeepSeek V3.2, Qwen 3.5 397B, Mistral Large 3        |
| `explore`           | Nemotron Super 49B                           | Nemotron 3 Nano 30B, Mistral Small 4, Llama 3.1 8B   |
| `librarian`         | Kimi K2.5                                    | Qwen 3 Coder 480B, Nemotron Super 49B, Mistral S4    |
| `prometheus`        | Nemotron Ultra 253B                          | Qwen 3.5 397B, DeepSeek V3.2, Mistral Large 3        |
| `metis`             | DeepSeek V3.2                                | Qwen 3.5 397B, Nemotron Ultra 253B                   |
| `momus`             | Nemotron Ultra 253B                          | DeepSeek V3.2, Qwen 3.5 397B, Mistral Large 3        |
| `atlas`             | Nemotron Super 49B                           | Kimi K2.5, Llama 3.3 70B, Nemotron 3 Super 120B      |
| `sisyphus-junior`   | Nemotron Nano 8B                             | Phi-4 Mini, Llama 3.2 3B, Nemotron 3 Nano 30B        |
| `multimodal-looker` | Gemma 4 31B                                  | Phi-4 Multimodal, Llama 3.2 90B Vision, Qwen 3.5 397B|

### Category Model Assignments

| Category             | Primary                | Fallbacks                                      |
| -------------------- | ---------------------- | ---------------------------------------------- |
| `visual-engineering` | Nemotron Ultra         | Qwen 3.5 397B, Mistral Large 3, Gemma 4         |
| `ultrabrain`         | Nemotron Ultra (xhigh) | DeepSeek V3.2, Qwen 3.5 397B, Mistral Large 3   |
| `deep`               | Qwen 3.5 397B          | Nemotron Ultra, DeepSeek V3.2, Devstral 2       |
| `artistry`           | Nemotron Ultra         | Mistral Large 3, Qwen 3.5 397B, Gemma 4         |
| `quick`              | Nemotron Nano 8B       | Phi-4 Mini, Llama 3.2 3B, Nemotron 3 Nano 30B   |
| `unspecified-low`    | Nemotron Super 49B     | Llama 3.3 70B, Mistral Small 4, Nemotron 3 Nano |
| `unspecified-high`   | Nemotron Ultra         | Qwen 3.5 397B, DeepSeek V3.2, Mistral Large 3   |
| `writing`            | Mistral Large 3        | Kimi K2.5, Nemotron Ultra, Qwen 3.5 397B        |

## Available Models (Nvidia NIM Router)

### Text Generation Models

| Provider      | Model ID                                      | Use Case                        |
| ------------- | --------------------------------------------- | ------------------------------- |
| **Qwen**      | `qwen/qwen3.5-397b-a17b`                      | Agentic coding, reasoning       |
| **Qwen**      | `qwen/qwen3.5-122b-a10b`                      | Multimodal chat, coding         |
| **Qwen**      | `qwen/qwen3-coder-480b-a35b-instruct`         | Agentic coding (specialist)     |
| **Qwen**      | `qwen/qwen3-next-80b-a3b-instruct`            | Sparse MoE, efficient inference |
| **Qwen**      | `qwen/qwen3-next-80b-a3b-thinking`            | Hybrid reasoning MoE            |
| **Nvidia**    | `nvidia/llama-3.1-nemotron-ultra-253b-v1`     | Tool use, agentic (best overall)|
| **Nvidia**    | `nvidia/llama-3.3-nemotron-super-49b-v1.5`    | Fast inference                  |
| **Nvidia**    | `nvidia/llama-3.1-nemotron-nano-8b-v1`        | Quick tasks, low latency        |
| **Nvidia**    | `nvidia/nemotron-3-super-120b-a12b`           | Text/chat/coding/agentic        |
| **Nvidia**    | `nvidia/nemotron-3-nano-30b-a3b`              | MoE, efficient inference        |
| **DeepSeek**  | `deepseek-ai/deepseek-v3.2`                   | Reasoning, math                 |
| **DeepSeek**  | `deepseek-ai/deepseek-v3.1`                   | Chat, general purpose           |
| **Mistral**   | `mistralai/mistral-large-3-675b-instruct-2512`| Multimodal, coding              |
| **Mistral**   | `mistralai/mistral-small-4-119b-2603`         | Multimodal chat/coding          |
| **Mistral**   | `mistralai/devstral-2-123b-instruct-2512`     | Code/reasoning specialist       |
| **Mistral**   | `mistralai/codestral-22b-instruct-v0.1`       | Coding specialist               |
| **Z.ai**      | `z-ai/glm5`                                   | Reasoning, long-horizon agentic |
| **Z.ai**      | `z-ai/glm4.7`                                 | Coding, tool calling            |
| **Moonshot**  | `moonshotai/kimi-k2.5`                        | Vision-language, agentic        |
| **Moonshot**  | `moonshotai/kimi-k2-instruct`                 | Coding, MoE                     |
| **Moonshot**  | `moonshotai/kimi-k2-thinking`                 | Reasoning model                 |
| **Google**    | `google/gemma-4-31b-it`                       | Text/coding/reasoning           |
| **Google**    | `google/gemma-3-27b-it`                       | Lightweight general purpose     |
| **Meta**      | `meta/llama-3.3-70b-instruct`                 | General purpose                 |
| **Meta**      | `meta/llama-3.1-405b-instruct`                | Large-scale reasoning           |
| **Meta**      | `meta/llama-3.1-70b-instruct`                 | General purpose                 |
| **Meta**      | `meta/llama-3.1-8b-instruct`                  | Fast, lightweight               |
| **Meta**      | `meta/llama-3.2-3b-instruct`                  | Quick tasks                     |
| **Meta**      | `meta/llama-3.2-90b-vision-instruct`          | Vision-language                 |
| **Microsoft** | `microsoft/phi-4-mini-instruct`               | Lightweight general purpose     |
| **Microsoft** | `microsoft/phi-4-multimodal-instruct`         | Multimodal understanding        |
| **MiniMax**   | `minimaxai/minimax-m2.5`                      | Text/reasoning/coding           |
| **StepFun**   | `stepfun-ai/step-3.5-flash`                   | Fast reasoning/agentic          |
| **ByteDance** | `bytedance/seed-oss-36b-instruct`             | Chat LLM                        |
| **OpenAI**    | `openai/gpt-oss-120b`                         | Open-weight reasoning           |
| **OpenAI**    | `openai/gpt-oss-20b`                          | Lightweight reasoning           |

## Environment Variables

```bash
# Required
export NVIDIA_NIM_API_KEY=nvapi-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Optional — for MCP servers
export FIRECRAWL_API_KEY=fc-xxxxxxxxx      # Firecrawl web scraping
export BRAVE_API_KEY=xxxxxxxxxxxxx         # Brave Search
```

## MCP Servers

### Enabled by Default

| Server | Type | Purpose |
|--------|------|---------|
| `websearch` | Built-in (Exa) | High-quality web search |
| `context7` | Built-in | Version-specific library docs |
| `grep_app` | Built-in | GitHub code search |
| `github` | stdio (`@anthropic-ai/mcp-server-github`) | PRs, issues, repos, file ops *(disabled — enable when needed)* |
| `sequential-thinking` | stdio (`@anthropic-ai/mcp-server-sequential-thinking`) | Structured multi-step reasoning |
| `playwright` | stdio (`@anthropic-ai/mcp-server-playwright`) | Browser E2E testing, UI verification *(disabled — enable when needed)* |
| `firecrawl` | stdio (`@anthropic-ai/mcp-server-firecrawl`) | Clean web scraping, API doc extraction |
| `brave-search` | stdio (`@anthropic-ai/mcp-server-brave-search`) | Live web search (independent index) |
| `rube` | Remote (`https://rube.app/mcp`) | 500+ app integrations (Slack, Jira, etc.) |
| `linear` | stdio (`@anthropic-ai/mcp-server-linear`) | Issue CRUD, sprint tracking |
| `hindsight` | stdio (`hindsight-mcp`) | Persistent memory, session recall |

### Disabled by Default (enable when needed)

| Server | Type | Purpose |
|--------|------|---------|
| `sentry` | stdio (`@anthropic-ai/mcp-server-sentry`) | Error monitoring, stack traces |
| `e2b-sandbox` | stdio (`@e2b/mcp`) | Isolated cloud code execution |

### Claude Code Import Blocking

OpenCode/OhMyOpenAgent auto-imports from `~/.claude/` (MCP servers, plugins, skills, agents, hooks, commands). **All six gates are explicitly disabled** in `oh-my-openagent.json`:

```json
"claude_code": {
  "mcp": false,
  "commands": false,
  "skills": false,
  "agents": false,
  "hooks": false,
  "plugins": false
}
```

Every flag defaults to `true` if the block is missing. All six **must** be set to `false` (issue #2037).

### External Import Hard Kill

The config flags above are the normal guardrails, but the plugin also exposes a stronger loader-level kill switch:

```bash
export OPENCODE_DISABLE_CLAUDE_CODE=true
export OPENCODE_DISABLE_CLAUDE_CODE_PLUGINS=true
```

These disable the external Claude plugin bridge before command/skill/agent/MCP plugin payloads are loaded at all.

Per the current OpenCode docs, OpenCode auto-loads plugins only from `.opencode/plugins/` and `~/.config/opencode/plugins/`, and skills only from `.opencode/skills/`, `~/.config/opencode/skills/`, plus Claude/Agents-compatible skill directories. Per the Gemini CLI extension docs, Gemini loads extensions from `~/.gemini/extensions/` and merges their `gemini-extension.json` config only inside Gemini CLI.

That means a Gemini extension repo can carry an `.opencode/` payload, but OpenCode will not ingest it just because it exists under `~/.gemini/extensions/`. It only becomes active after being copied, symlinked, or otherwise installed into an OpenCode load path.

### Dynamic Context Pruning (DCP)

The `@tarquinen/opencode-dcp` plugin is installed globally. It:
- Auto-compresses conversation context to prevent token overflow
- Provides `/dcp`, `/dcp context`, `/dcp stats`, `/dcp compress` commands
- Has model-specific tuning for GLM-5 and Qwen 3.5 (see `dcp.jsonc`)

GLM-5 and Qwen 3.5 get lower context thresholds to avoid their known issues:
- **GLM-5**: max 90K / min 40K — compresses earlier to reduce tool-call JSON errors
- **Qwen 3.5 122B**: max 100K / min 50K — fewer messages = fewer system prompt collisions
- **Qwen 3.5 397B**: max 200K / min 80K — larger window, same system message rules

---

## Context Engineering Guide (April 2026)

### The Three Bottlenecks

| Bottleneck | Symptom | Fix |
|---|---|---|
| **Tool description bloat** | Session starts with 50K+ tokens before any work | Fewer enabled MCPs + lazy loading |
| **Large tool outputs** | `read_file`, API responses, test output fill window | DCP deduplication + `truncate_all_tool_outputs` |
| **Long dialogue chains** | Model "forgets" earlier decisions, repeats work | Preemptive compaction + structured summaries |

### What's Already Configured

**OhMyOpenAgent `experimental` block** (in `oh-my-openagent.json`):

| Setting | Value | What it does |
|---|---|---|
| `aggressive_truncation` | `true` | Truncates long tool outputs to prevent context flooding |
| `preemptive_compaction` | `true` | Compacts context at threshold (not at 100%) — preserves state |
| `truncate_all_tool_outputs` | `true` | All tool responses get truncated to fit, not just specific ones |
| `auto_resume` | `true` | Automatically resumes from last compaction checkpoint |

**DCP `compress` block** (in `dcp.jsonc`):

| Setting | Value | Why |
|---|---|---|
| `mode` | `"range"` | Block summaries (more efficient than per-message) |
| `maxContextLimit` | `"70%"` | Compresses at 70% — before context rot degrades recall |
| `minContextLimit` | `"20%"` | Starts nudging at 20% remaining |
| `nudgeFrequency` | `3` | Nudges every 3rd fetch (aggressive) |
| `iterationNudgeThreshold` | `10` | After 10 messages without user input, adds compression reminders |
| `nudgeForce` | `"strong"` | High likelihood of compression after user messages |
| `summaryBuffer` | `true` | Active summary tokens extend effective max — prevents premature hard pruning |
| `protectUserMessages` | `true` | User messages are never compressed or lost |
| `deduplication` | `true` | Auto-removes duplicate tool calls with same args |
| `purgeErrors` | `true`, 4 turns | Removes errored tool outputs after 4 turns |
| `turnProtection` | `true`, 2 turns | Keeps last 2 turns in context as sliding cache |

### MCP Tool Bloat Prevention

**1. Fewer enabled MCPs** — each enabled server adds 5–30 tool descriptions to every request. We disabled `github` (20+ tools) and `playwright` (15+ tools). Enable them only when needed.

**2. Auto-deferral** — OpenCode automatically defers MCP tool descriptions when they exceed 10% of the context window. Deferred tools are discovered on-demand via `MCPSearch`. No config needed; it's built-in.

**3. Lazy loading** — Issue #17482 tracks dynamic/lazy loading for MCP tool schemas. When implemented, only actively-used tool schemas load into context.

### Active Practices

**Start fresh for distinct tasks.** Don't pile unrelated work into one session. Each new topic should be a new `/new` — the compaction summary won't be as good as a clean start.

**Use `/dcp context` to audit.** Shows a token breakdown of what's consuming your window. Check this before sessions feel sluggish.

**Use `/dcp stats` for cumulative metrics.** Tracks total tokens saved, compression frequency, and cache efficiency over time.

**Enable `manualMode` when you want full control.** Set `"manualMode": { "enabled": true }` in `dcp.jsonc` — DCP tools only run via `/dcp` commands, no autonomous compression. Automatic dedup/purge still run.

**Protect expensive tools from dedup.** If a tool is slow/expensive to re-run (e.g., `edit`, `write`), add it to `deduplication.protectedTools` so identical calls aren't collapsed.

**Model-specific limits matter.** GLM-5 and Qwen 3.5 get lower `modelMaxLimits` because they degrade faster under context pressure. Nemotron Ultra can handle more — it gets 100K vs GLM-5's 90K.

**Avoid running multiple compaction systems.** DCP and SuperMemory/preemptive compaction can conflict. If using DCP (which we are), disable any other compaction plugins to prevent double-compaction.

### Enabling MCPs On-Demand

When you need `github` or `playwright` for a specific task, flip their `enabled` flag in `.opencode/opencode.json` and restart OpenCode. Alternatively, use `/connect` in the TUI to manage MCP servers at runtime.
