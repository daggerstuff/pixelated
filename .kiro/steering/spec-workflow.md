# Spec-Driven Workflow

## Overview

Pixelated Empathy follows a Spec-driven development process to ensure that all changes are well-reasoned, empathetic, and technically sound before implementation begins. This process is particularly critical for features involving emotional intelligence, PII handling, or core architecture.

## When to Use Specs

Use the Spec-Driven Workflow for:
- New features or major capabilities
- Breaking changes or significant refactoring
- Architecture decisions (ADRs)
- Changes involving sensitive mental health data
- Anything requiring design discussion or consensus

## Spec Structure

Specs should be located in `.kiro/specs/<feature-name>/` and typically include:

1. **`requirements.md`**: What needs to be built and why.
2. **`design.md`**: How it will be built (optional for smaller tasks).
3. **`tasks.md`**: Implementation checklist.

## Implementation Workflow

### 1. Planning & Design
- Create a new directory in `.kiro/specs/`.
- Use the `writing-plans` skill to generate a detailed implementation plan.
- The plan MUST include TDD steps, exact file paths, and verification commands.

### 2. Execution Options
Choose one of the two following execution paths:

#### Option A: Subagent-Driven (Recommended for complex features)
- Stay in the current session.
- Use the `subagent-driven-development` skill.
- Dispatch a fresh subagent for each task in the plan.
- Perform code review after each task using the `requesting-code-review` skill.

#### Option B: Parallel Session
- Use the `executing-plans` skill in a separate session/worktree.
- Better for batch execution while maintaining focus in the main session.

### 3. Verification & Completion
- After all tasks are complete, run `pnpm check:all` and `pnpm test:all`.
- Use the `finishing-a-development-branch` skill to verify the work and prepare for merge.
- Archive the spec by moving it to `.kiro/specs/archive/` (optional, based on project state).

## Key Principles

- **TDD First**: Always write the failing test before implementing logic.
- **Zero Semicolons**: Follow the project's TS/JS style strictly.
- **Privacy First**: Ensure no PII or secrets are logged or exposed.
- **Empathy Centered**: Validate that the implementation respects the emotional intelligence guidelines.

## OpenSpec Integration

For major cross-repository changes, consult `openspec/AGENTS.md` and follow the broader proposal process.
