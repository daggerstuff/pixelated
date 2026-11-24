# Linear Code / Cloud Coding Agent Protocol

This repository is configured for autonomous agent execution (Linear Code / Cloud Coding Agent and multi-agent coordination).

## BYOK & Open Source Model Strategy
* **Architecture & Feature Coding**: DeepSeek-V3 (`deepseek/deepseek-chat`) or Qwen 2.5 Coder 32B (`qwen/qwen-2.5-coder-32b-instruct`) via OpenRouter, vLLM, Ollama, or local gateway.
* **Deep Reasoning, Security & Threat Audits**: DeepSeek-R1 (`deepseek/deepseek-r1`) or Llama 3.3 70B for HIPAA compliance, PHI gating, and cryptographic verification.
* **Bug Fixes & Fast Iteration**: Qwen 2.5 Coder 32B / DeepSeek-V3 with strict verification loops.

## Runtime Environment & Setup
* **Python Runtime**: **Python 3.14** exclusively (managed via `uv`).
* **Node Runtime**: Node v24 (managed via `pnpm`).
* **Setup Command**:
  ```bash
  pnpm install --frozen-lockfile && uv sync
  ```
* **Verification Command**:
  ```bash
  pnpm lint && pnpm vitest run -c config/vitest.config.ts && uv run pytest
  ```

## Non-Negotiable Engineering Rules
* **Strict Anti-Suppression Policy**:
  - Never add `@ts-ignore`, `@ts-nocheck`, or `@ts-expect-error` to TypeScript files.
  - Never add `# noqa`, `# type: ignore`, or blanket pylint suppresses in Python.
  - Never add `/* eslint-disable */` comments.
* **Banned Type Checkers (OOM Prevention)**:
  - DO NOT run `astro check`, `pnpm typecheck`, or `tsc`. They cause severe out-of-memory crashes.
  - Use `pnpm lint` (type-aware oxlint) for lint and type verification.
* **PHI & Secrets**:
  - Never commit or log clinical PHI, patient identifiers, or API credentials.
