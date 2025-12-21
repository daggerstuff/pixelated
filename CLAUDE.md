# Pixelated Empathy - AI Assistant Guide

> **Mission**: Build empathy-driven technology that prioritizes human connection, psychological safety, and ethical AI.

## 🚀 Start Every Session

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

**Detailed style guide**: [code-style.md](.agent/steering/code-style.md)

**Common Sections**: Common Errors, Best Practices, Strategies, Testing, Code Style

## 🔒 Security & Ethics

1. **Never expose sensitive data** (redact API keys, tokens, PII)
2. **Validate all input** (especially emotion scores 0-1 range, conversation data)
3. **Mental health data privacy** - Respect confidentiality, follow HIPAA where applicable
4. **AI ethics** - No stereotypes, no psychological harm, validate constructs
5. **Handle edge cases** - Crisis signals, silence, cultural variations

**Security checks**: `pnpm security:check`, `pnpm security:scan`, `pnpm test:security`
**Deep dive**: [security-ethics.md](.agent/steering/security-ethics.md)

## 🎭 Domain Guidelines

**Emotional Intelligence:**
- Normalize emotion scores (0-1 range)
- Use established frameworks (Plutchik, Big Five)
- Validate psychological constructs

**Conversation Analysis:**
- Respect context and history
- Handle edge cases (silence, crisis signals)
- Consider cultural/linguistic variations

**Detailed guidelines**: [domain-emotional-ai.md](.agent/steering/domain-emotional-ai.md)

## 🚫 Common Pitfalls

1. ❌ Wrong package managers (`npm`/`yarn` instead of `pnpm`, `pip`/`conda` instead of `uv`)
3. ❌ Type safety violations (using `any`, ignoring type errors)
4. ❌ Missing validation (emotion scores, user input, edge cases)
5. ❌ Over-engineering (start minimal, iterate)
6. ❌ Bypassing security validation

## 🔄 Workflow Patterns

**New Feature:**
2. Check `openspec/AGENTS.md` for major changes
3. Write tests first (TDD)
4. Implement → `pnpm check:all && pnpm test:all`

**Testing**: [testing-strategy.md](.cursor/steering/testing-strategy.md)  
**Spec workflow**: [spec-workflow.md](.cursor/steering/spec-workflow.md)

## 📚 Key Documentation

**Core Guides:**
- [code-style.md](.agent/steering/code-style.md): Detailed style guide
- [security-ethics.md](.agent/steering/security-ethics.md): Security & ethics deep-dive
- [clean-code-principles.md](.agent/steering/clean-code-principles.md): Clean code patterns

**Domain-Specific:**
- [domain-emotional-ai.md](.agent/steering/domain-emotional-ai.md): Emotional AI guidelines
- [testing-strategy.md](.agent/steering/testing-strategy.md): Testing best practices

**Workflows:**
- [spec-workflow.md](.agent/steering/spec-workflow.md): Spec-driven development
- `AGENTS.md`: AI agent workflow guide

## 🎯 Mission Reminder

> **We don't just process conversations. We understand them.**

This platform handles sensitive mental health data. Every decision should prioritize:
- **Psychological safety**
- **Ethical AI practices**
- **Privacy and confidentiality**
- **Genuine human connection**

[code-style.md]: .agent/steering/code-style.md
[security-ethics.md]: .agent/steering/security-ethics.md
[clean-code-principles.md]: .agent/steering/clean-code-principles.md
[domain-emotional-ai.md]: .agent/steering/domain-emotional-ai.md
[testing-strategy.md]: .agent/steering/testing-strategy.md
[spec-workflow.md]: .agent/steering/spec-workflow.md