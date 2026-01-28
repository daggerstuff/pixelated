# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Core Commands for Development

| Goal | Command | Description |
|------|---------|-------------|
| Install dependencies | `pnpm install` | Installs all packages listed in `package.json` (pnpm is used for this repo). |
| Build / Start dev server | `pnpm dev` | Starts the development server (typically runs Astro/Vite). |
| Build for production | `pnpm build` | Generates production‑ready static assets. |
| Run tests | `pnpm test` | Executes the project's test suite (Jest/PyTest/etc.). Use `pnpm test --watch` for iterative testing. |
| Lint code | `pnpm lint` | Runs ESLint + TypeScript checks. |
| Format code | `pnpm format` | Applies Prettier formatting. |
| Type‑check only | `pnpm typecheck` | TypeScript compile‑only without emitting files. |
| Clean build artifacts | `pnpm clean` | Removes `node_modules`, `dist`, and other generated folders. |

> **Tip:** All scripts are defined in `package.json` under `"scripts"`. You can discover them with `pnpm exec --scripts-prepend-node-path` or by inspecting that file.

## High‑Level Architecture Overview

The repository is organized as a **monorepo** with a clear separation of concerns:

1. **Core Logic** – `src/` (or `src/`‑like directories) contains the main application code.
   - Feature modules are self‑contained (e.g., `src/featureX/` with components, services, types).
   - Shared utilities live under `src/shared/` (common types, helpers, API clients).

2. **Documentation & Plans** – `docs/` holds design docs, implementation plans, and architectural decisions.
   - Each major initiative gets its own sub‑folder (`docs/featureX/`).
   - `docs/plans/` stores bite‑sized task lists used by the `writing-plans` workflow.

3. **Memory Bank** – `.memory/` stores the structured project context that survives across sessions.
   - Core files: `00-description.md`, `01-brief.md`, `20-system.md`, `30-tech.md`, `40-active.md`, `50-progress.md`, `60-decisions.md`, `70-knowledge.md`.
   - The system automatically updates these files and their semantic index.

4. **Project Rules** – `.cursor/rules/` contains rule files that guide the AI’s behavior (e.g., style, safety, TDD enforcement).
   - Rules are referenced via `superpowers:*` skills and via `EnterPlanMode`/`ExitPlanMode`.

5. **Labs / Extras** – Additional folders such as `lab/`, `experiment/`, or `scripts/` hold disposable scripts, proof‑of‑concepts, and ad‑hoc utilities.

6. **Configuration** – Top‑level files like `astro.config.mjs`, `tsconfig.json`, `package.json`, and various CI/CD configuration files (`.github/workflows/*.yml`) define tooling, scripts, and pipeline behavior.

### Navigation Tips for New Instances

- **Start with the Memory Bank**: read `00-alpha.md` first then `00-description.md` → `20-system.md` → `30-tech.md` to grasp the overall vision, tech stack, and current focus.
- **Consult the Plan Folder** when you need a step‑by‑step implementation roadmap (`docs/plans/`).
- **Use the Rule Files** to understand enforced code‑style, TDD, and safety constraints (`.cursor/rules/`).
- **Explore `src/` Sparingly**: locate a feature’s folder first; inside you’ll find `components/`, `services/`, and `types/` that map directly to the architecture diagram in the design docs.
- **Leverage Scripts**: all routine actions (install, dev, test, lint, format) are wrapper scripts in `package.json`; invoking them through `pnpm` ensures proper environment setup.

## Typical Workflow for Implementation

1. **Read the relevant documentation** (`docs/plans/<initiative>/` or `docs/<area>/`).
2. **Create a new task branch** (`git checkout -b feature/<short‑desc>`).
3. **Run the appropriate script** (`pnpm dev` for live reload, `pnpm test` for verification).
4. **Make incremental changes** – each change should be accompanied by a failing test (`pnpm test` will confirm).
5. **Commit often** (prefer small, focused commits).
6. **Run `pnpm lint` and `pnpm format`** before pushing.
7. **Open a PR** and request a code‑review (`superpowers:requesting-code-review`).
8. **Iterate** based on review feedback, then merge.

## Red‑Flag Checklist (When in Doubt)

- **Missing `pnpm install`?** – Always run it after pulling a new branch.
- **No failing tests?** – Do not proceed to merge; run `pnpm test` first.
- **Unstyled code?** – Run `pnpm format` and `pnpm lint` before committing.
- **Large monolithic commit?** – Split into logical, reviewable units.
- **Unclear requirements?** – Use `AskUserQuestion` to clarify before coding.

Following these conventions will keep the repository navigable, the codebase consistent, and the AI agents productive.