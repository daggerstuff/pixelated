<!-- OPENSPEC:START -->
# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:
- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:
- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->

# Pixelated Empathy - AI Agent Guide

> **Mission**: Build empathy-driven technology that prioritizes human connection, psychological safety, and ethical AI.

## 🚀 Start Every Session

1. **Retrieve memory first**: `brv retrieve --query "context for task"`
2. **Check status**: `brv status`
3. **For major changes**: Consult `@/openspec/AGENTS.md`

## 📦 Package Managers (Critical)

**Node.js**: `pnpm` ONLY (never npm/yarn)
**Python**: `uv` ONLY (never pip/conda/venv)

```bash
# Node
pnpm dev                    # Start dev server
pnpm test:all              # Run all tests
pnpm check:all             # Lint + format + typecheck

# Python
uv install                 # Install dependencies
uv run python script.py    # Run scripts
uv run pytest tests/       # Run tests
```

## 📝 Code Conventions

**TypeScript/JavaScript**:
- Type-first imports with `@/` aliases
- 2 spaces, no semicolons, single quotes, trailing commas
- PascalCase: Components/interfaces, camelCase: vars/functions
- Strict types, branded types for critical values

**Project Structure**:
```
src/
├── components/  # Astro/React (PascalCase)
├── lib/        # Services (API, AI)
├── types/      # Type definitions
├── utils/      # Helpers (camelCase)
└── pages/      # Astro pages
```

**Requirements**: Node.js 24+, Python 3.11+, Docker

## 🧠 Memory Management

**Add learnings**: `brv add --section "Best Practices" --content "..."`
**Push updates**: `brv push` (prompt user first unless auto-approved)

**Sections**: Common Errors, Best Practices, Strategies, Testing, Code Style

## 🔒 Security & Ethics

1. Never expose sensitive data (redact API keys, tokens, PII)
2. Validate all input (especially emotion scores, conversation data)
3. This handles mental health data—respect privacy
4. Ensure AI personas don't perpetuate stereotypes
5. Features must not cause psychological harm

## 🎭 Domain Guidelines

**Emotional Intelligence**:
- Normalize emotion scores (0-1 range)
- Use established frameworks (Plutchik, Big Five)
- Validate psychological constructs

**Conversation Analysis**:
- Respect context and history
- Handle edge cases (silence, crisis signals)
- Consider cultural/linguistic variations

## 🚫 Don't

1. Skip memory retrieval
2. Use wrong package managers
3. Ignore type errors
4. Commit without testing (`pnpm check:all`)
5. Over-engineer (start minimal)
6. Bypass security validation

## 📚 Resources

**Core Guides**:
- **#[[file:.kiro/steering/code-style.md]]**: Detailed style guide
- **#[[file:.kiro/steering/security-ethics.md]]**: Security & ethics deep-dive
- **#[[file:.kiro/steering/clean-code-principles.md]]**: Clean code patterns

**Domain-Specific**:
- **#[[file:.kiro/steering/domain-emotional-ai.md]]**: Emotional AI guidelines
- **#[[file:.kiro/steering/testing-strategy.md]]**: Testing best practices

**Workflows**:
- **#[[file:.kiro/steering/spec-workflow.md]]**: Spec-driven development
- **openspec/AGENTS.md**: OpenSpec process
- **Playbook**: `.brv/playbook.json`

---

*Building technology that helps humans connect more deeply.*