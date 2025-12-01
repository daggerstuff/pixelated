---
trigger: always_on
---

# Spec-Driven Workflow

## When to Use Specs

Use Kiro specs (`.kiro/specs/`) for:
- New features or capabilities
- Breaking changes
- Architecture decisions
- Complex refactoring
- Anything requiring design discussion

## Spec Structure

```
.kiro/specs/feature-name/
├── requirements.md  # What needs to be built
├── design.md       # How it will be built (optional)
└── tasks.md        # Implementation checklist
```

## Requirements Template

```markdown
# Feature Name Requirements

## Purpose & Scope
[Clear description of what and why]

## Requirements

### REQ-001: Requirement Title
**Priority**: High/Medium/Low
**Description**: [Detailed requirement]

#### Scenario: Happy Path
Given [context]
When [action]
Then [expected outcome]

#### Scenario: Edge Case
Given [edge case context]
When [action]
Then [expected handling]

## Constraints
- CON-001: [Technical or business constraint]

## Dependencies
- DEP-001: [External dependency or prerequisite]
```

## Design Template (Optional)

```markdown
# Feature Name Design

## Architecture Overview
[High-level architecture diagram or description]

## Component Design
[Detailed component specifications]

## Data Models
[Database schemas, types, interfaces]

## API Contracts
[API endpoints, request/response formats]

## Security Considerations
[Security measures and threat mitigation]

## Performance Considerations
[Performance requirements and optimizations]
```

## Tasks Template

```markdown
# Feature Name Tasks

## Phase 1: Foundation
- [ ] TASK-001: Set up project structure
- [ ] TASK-002: Create base types and interfaces
- [ ] TASK-003: Implement core logic

## Phase 2: Integration
- [ ] TASK-004: Connect to external services
- [ ] TASK-005: Add error handling
- [ ] TASK-006: Write tests

## Phase 3: Polish
- [ ] TASK-007: Add documentation
- [ ] TASK-008: Performance optimization
- [ ] TASK-009: Security review
```

## Workflow

1. **Create spec**: Define requirements and design
2. **Review**: Get feedback from team
3. **Implement**: Work through tasks
4. **Validate**: Ensure requirements met
5. **Archive**: Move to `.kiro/specs/archive/` when complete

## OpenSpec Integration

For major changes, use OpenSpec workflow:
- Consult `@/openspec/AGENTS.md` for process
- Create proposals in `openspec/changes/`
- Follow validation and approval process
