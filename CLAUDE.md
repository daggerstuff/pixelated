# Pixelated Empathy - AI Assistant Guide

> **Mission**: Build empathy-driven technology that prioritizes human connection, psychological safety, and ethical AI.

## 🚀 Start Every Session

1. **Retrieve memory first**: `brv retrieve --query "context for task"`
2. **Check status**: `brv status`
3. **For major changes**: Consult `@/openspec/AGENTS.md`

## 📦 Package Managers (Critical)

**Node.js**: `pnpm` ONLY (never npm/yarn)  
**Python**: `uv` ONLY (never pip/conda/venv)

```bash
# Quick start
pnpm install && uv install
pnpm dev                    # Frontend dev server
pnpm dev:all-services       # All services
pnpm test:all              # Run all tests
pnpm check:all             # Lint + format + typecheck
```

## 📝 Code Conventions

**TypeScript/JavaScript:**
- Type-first imports with `@/` aliases
- 2 spaces, no semicolons, single quotes, trailing commas
- PascalCase: Components/interfaces, camelCase: vars/functions
- Strict types, branded types for critical values
- Never use `any` without justification

**Python:**
- Use `uv` for all package management
- Follow PEP 8, type hints required

**Detailed style guide**: **#[[file:.kiro/steering/code-style.md]]**

## 🧠 Memory Management (ByteRover)

**Always start sessions with:**
```bash
brv retrieve --query "context for current task"
brv status
```

**During work:**
```bash
brv add --section "Best Practices" --content "Specific actionable insight"
```

**After completing work:**
```bash
brv push  # Prompt user first unless auto-approved
```

**Common Sections**: Common Errors, Best Practices, Strategies, Testing, Code Style

## 🔒 Security & Ethics

1. **Never expose sensitive data** (redact API keys, tokens, PII)
2. **Validate all input** (especially emotion scores 0-1 range, conversation data)
3. **Mental health data privacy** - Respect confidentiality, follow HIPAA where applicable
4. **AI ethics** - No stereotypes, no psychological harm, validate constructs
5. **Handle edge cases** - Crisis signals, silence, cultural variations

**Security checks**: `pnpm security:check`, `pnpm security:scan`, `pnpm test:security`  
**Deep dive**: **#[[file:.kiro/steering/security-ethics.md]]**

## 🎭 Domain Guidelines

**Emotional Intelligence:**
- Normalize emotion scores (0-1 range)
- Use established frameworks (Plutchik, Big Five)
- Validate psychological constructs

**Conversation Analysis:**
- Respect context and history
- Handle edge cases (silence, crisis signals)
- Consider cultural/linguistic variations

**Detailed guidelines**: **#[[file:.kiro/steering/domain-emotional-ai.md]]**

## 🚫 Common Pitfalls

1. ❌ Wrong package managers (`npm`/`yarn` instead of `pnpm`, `pip`/`conda` instead of `uv`)
2. ❌ Skipping memory retrieval (`brv retrieve` at session start)
3. ❌ Type safety violations (using `any`, ignoring type errors)
4. ❌ Missing validation (emotion scores, user input, edge cases)
5. ❌ Over-engineering (start minimal, iterate)
6. ❌ Bypassing security validation

## 🔄 Workflow Patterns

**New Feature:**
1. `brv retrieve --query "feature name"`
2. Check `openspec/AGENTS.md` for major changes
3. Write tests first (TDD)
4. Implement → `pnpm check:all && pnpm test:all`
5. `brv add` learnings → `brv push`

**Debugging:**
1. `brv retrieve --query "error description"`
2. Check `.brv/playbook.json` for related files
3. Document solution: `brv add --section "Common Errors"`

**Testing**: **#[[file:.kiro/steering/testing-strategy.md]]**  
**Spec workflow**: **#[[file:.kiro/steering/spec-workflow.md]]**

## 📚 Key Documentation

**Core Guides:**
- **#[[file:.kiro/steering/code-style.md]]**: Detailed style guide
- **#[[file:.kiro/steering/security-ethics.md]]**: Security & ethics deep-dive
- **#[[file:.kiro/steering/clean-code-principles.md]]**: Clean code patterns

**Domain-Specific:**
- **#[[file:.kiro/steering/domain-emotional-ai.md]]**: Emotional AI guidelines
- **#[[file:.kiro/steering/testing-strategy.md]]**: Testing best practices

**Workflows:**
- **#[[file:.kiro/steering/spec-workflow.md]]**: Spec-driven development
- `AGENTS.md`: AI agent workflow guide
- **Playbook**: `.brv/playbook.json`

## 🎯 Mission Reminder

> **We don't just process conversations. We understand them.**

This platform handles sensitive mental health data. Every decision should prioritize:
- **Psychological safety**
- **Ethical AI practices**
- **Privacy and confidentiality**
- **Genuine human connection**

---

*Building technology that helps humans connect more deeply.*
- 2<!-- BEGIN BYTEROVER RULES -->

# Workflow Instruction

You are a coding agent focused on one codebase. Use the brv CLI to manage working context.
Core Rules:

- Start from memory. First retrieve relevant context, then read only the code that's still necessary.
- Keep a local context tree. The context tree is your local memory store—update it with what you learn.

## Context Tree Guideline

- Be specific (“Use React Query for data fetching in web modules”).
- Be actionable (clear instruction a future agent/dev can apply).
- Be contextual (mention module/service, constraints, links to source).
- Include source (file + lines or commit) when possible.

## CLI Usage Notes

- Use --help on any command to discover flags. Provide exact arguments for the scenario.

---
# ByteRover CLI Command Reference

## Memory Commands

### `brv curate`

**Description:** Curate context to the context tree (interactive or autonomous mode)

**Arguments:**

- `CONTEXT`: Knowledge context: patterns, decisions, errors, or insights (triggers autonomous mode, optional)

**Good examples of context:**

- "Auth uses JWT with 24h expiry. Tokens stored in httpOnly cookies via authMiddleware.ts"
- "API rate limit is 100 req/min per user. Implemented using Redis with sliding window in rateLimiter.ts"

**Bad examples:**

- "Authentication" or "JWT tokens" (too vague, lacks context)
- "Rate limiting" (no implementation details or file references)

**Examples:**

```bash
# Interactive mode (manually choose domain/topic)
brv curate

# Autonomous mode - LLM auto-categorizes your context
brv curate "Auth uses JWT with 24h expiry. Tokens stored in httpOnly cookies via authMiddleware.ts"
```

**Behavior:**

- Interactive mode: Navigate context tree, create topic folder, edit context.md
- Autonomous mode: LLM automatically categorizes and places context in appropriate location

**Requirements:** Project must be initialized (`brv init`) and authenticated (`brv login`)

---

### `brv query`

**Description:** Query and retrieve information from the context tree

**Arguments:**

- `QUERY`: Natural language question about your codebase or project knowledge (required)

**Good examples of queries:**

- "How is user authentication implemented?"
- "What are the API rate limits and where are they enforced?"

**Bad examples:**

- "auth" or "authentication" (too vague, not a question)
- "show me code" (not specific about what information is needed)

**Examples:**

```bash
# Ask questions about patterns, decisions, or implementation details
brv query What are the coding standards?
brv query How is authentication implemented?
```

**Behavior:**

- Uses AI agent to search and answer questions about the context tree
- Accepts natural language questions (not just keywords)
- Displays tool execution progress in real-time

**Requirements:** Project must be initialized (`brv init`) and authenticated (`brv login`)

---

## Best Practices

### Efficient Workflow

1. **Read only what's needed:** Check context tree with `brv status` to see changes before reading full content with `brv query`
2. **Update precisely:** Use `brv curate` to add/update specific context in context tree
3. **Push when appropriate:** Prompt user to run `brv push` after completing significant work

### Context tree Management

- Use `brv curate` to directly add/update context in the context tree

---
Generated by ByteRover CLI for Claude Code
<!-- END BYTEROVER RULES -->