# Rules System Documentation

This document explains how coding rules and AI assistant guidelines are organized across Cursor and Warp.

## Overview

The project maintains a unified rule system that works across multiple AI coding assistants (Cursor, Warp, Claude, etc.) while allowing tool-specific customizations.

## Rule Files Structure

```
pixelated/
├── .cursorrules              # Cursor IDE primary rules (links to WARP.md)
├── WARP.md                   # Warp primary rules (comprehensive)
├── CLAUDE.md                 # Claude-specific guide (supplementary)
├── AGENTS.md                 # AI collaboration workflow (supplementary)
├── .cursor/
│   ├── rules/                # Cursor-specific skill files (.mdc format)
│   │   ├── skill-test-driven-development.mdc
│   │   ├── skill-systematic-debugging.mdc
│   │   ├── skill-verification-before-completion.mdc
│   │   ├── skill-root-cause-tracing.mdc
│   │   └── ... (35+ specialized skills)
│   └── steering/             # Additional guidance files
└── .warp/
    └── rules/                # Warp-specific rules (markdown format)
        ├── test-driven-development.md
        ├── systematic-debugging.md
        ├── verification-before-completion.md
        └── root-cause-tracing.md
```

## Primary Rule Files

### WARP.md (Primary)
**Purpose**: Comprehensive project rules for Warp AI assistant  
**Audience**: Warp users, primary reference for all rules  
**Content**:
- Mission and project overview
- Package manager requirements (pnpm, uv)
- Testing commands and strategies
- Build and deployment workflows
- Architecture overview
- Security and ethics guidelines
- AI assistant workflow patterns
- Code conventions
- Common pitfalls
- Development workflow

**When to use**: Primary reference for all AI assistants working on this project

### .cursorrules (Bridge)
**Purpose**: Bridge file linking Cursor to WARP.md  
**Audience**: Cursor IDE users  
**Content**:
- Quick reference to essential commands
- Links to WARP.md as primary reference
- Critical security reminders
- Basic workflow patterns

**When to use**: Cursor IDE will automatically load this file

### CLAUDE.md (Supplementary)
**Purpose**: Claude/Cursor-specific assistant guide  
**Audience**: Claude AI, Cursor users  
**Content**:
- Start session checklist
- Links to additional `.cursor/steering/` docs
- Domain-specific guidelines
- Workflow patterns

**When to use**: Reference for Claude-specific features or `.cursor/steering/` structure

### AGENTS.md (Supplementary)
**Purpose**: Modern ops and AI collaboration workflow  
**Audience**: All AI assistants  
**Content**:
- Quick checklist format
- Tooling requirements
- Privacy and safety guidelines
- Delivery expectations
- Collaboration patterns

**When to use**: Quick reference for task completion criteria

## Tool-Specific Rules

### Cursor Rules (.cursor/rules/*.mdc)
**Format**: MDC (Markdown with frontmatter)  
**Structure**:
```markdown
---
name: skill-name
description: When and how to use this skill
---

# Skill Title
[Detailed documentation]
```

**Available Skills**:
- Development workflows (TDD, debugging, verification)
- Architecture patterns (dispatching, subagents)
- Tool-specific guides (Playwright, TypeScript, Python)
- Cloud infrastructure (Kubernetes, Cloudflare, GitHub Actions)
- Code quality (reviewing, testing, finishing branches)

**When to reference**: When using Cursor IDE for specialized tasks

### Warp Rules (.warp/rules/*.md)
**Format**: Standard Markdown  
**Content**: Core workflow skills converted for Warp  
**Available Rules**:
- `test-driven-development.md`: TDD workflow
- `systematic-debugging.md`: Four-phase debugging
- `verification-before-completion.md`: Evidence-based completion
- `root-cause-tracing.md`: Backward tracing through call stacks

**When to reference**: Automatically loaded by Warp based on context

## Rule Precedence

When multiple rules conflict, follow this order (highest to lowest priority):

1. **Tool-specific rules** (`.warp/rules/` or `.cursor/rules/`)
2. **WARP.md** (primary comprehensive rules)
3. **AGENTS.md** (modern ops guidelines)
4. **CLAUDE.md** (supplementary guidance)

## Converting Rules Between Tools

### Cursor → Warp
1. Extract core concepts from `.cursor/rules/*.mdc`
2. Remove tool-specific formatting (frontmatter)
3. Convert to standard Markdown
4. Save to `.warp/rules/[skill-name].md`
5. Reference in WARP.md if broadly applicable

### Warp → Cursor
1. Add frontmatter with name and description
2. Keep Markdown content
3. Save as `.cursor/rules/[skill-name].mdc`
4. Reference in CLAUDE.md if needed

## Maintenance

### Adding New Rules
1. Determine primary audience (all tools vs. tool-specific)
2. For universal rules: Add to WARP.md
3. For tool-specific: Add to `.warp/rules/` or `.cursor/rules/`
4. Update this documentation

### Updating Rules
1. Check if rule exists in multiple places
2. Update WARP.md first (source of truth)
3. Sync to tool-specific versions if needed
4. Verify no conflicts with other rules

### Removing Rules
1. Check references in other rule files
2. Remove or update references
3. Archive rather than delete (move to `docs/archived-rules/`)

## Best Practices

1. **WARP.md is source of truth**: Always update WARP.md first for universal rules
2. **Avoid duplication**: Link to WARP.md rather than copying content
3. **Keep tools in sync**: When updating workflows, update both Cursor and Warp versions
4. **Document exceptions**: If a rule differs between tools, document why
5. **Test changes**: Verify rules work with actual AI assistants before committing

## Quick Reference

**I'm using Cursor**: Start with `.cursorrules`, reference WARP.md for details  
**I'm using Warp**: WARP.md is automatically loaded  
**I'm using Claude directly**: Reference CLAUDE.md and WARP.md  
**I need specialized skills**: Check `.cursor/rules/` or `.warp/rules/`  
**I'm adding a new rule**: Start with WARP.md, then add tool-specific versions

## Related Documentation

- [WARP.md](../../WARP.md): Primary comprehensive rules
- [CLAUDE.md](../../CLAUDE.md): Claude/Cursor guide
- [AGENTS.md](../../AGENTS.md): AI collaboration workflow
- [Warp Documentation](https://docs.warp.dev/features/ai/rules): Official Warp rules docs
