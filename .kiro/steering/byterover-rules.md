---
inclusion: always
---

# ByteRover Knowledge Management Guidelines

## Knowledge Retrieval Protocol

**CRITICAL**: Always use `byterover-retrieve-knowledge` tool before starting any task to:
- Gather relevant context and historical information
- Understand previous decisions and implementations
- Avoid duplicating existing work
- Maintain consistency with established patterns

## Knowledge Storage Protocol

**REQUIRED**: Use `byterover-store-knowledge` tool after successful task completion to:
- Document critical implementation details
- Store architectural decisions and rationale
- Record lessons learned and best practices
- Preserve context for future development

## Implementation Guidelines

### Pre-Task Knowledge Retrieval
- Query for relevant domain knowledge before coding
- Search for existing patterns and conventions
- Understand project history and context
- Identify potential conflicts or dependencies

### Post-Task Knowledge Storage
- Document new patterns or architectural decisions
- Store troubleshooting information and solutions
- Record performance optimizations and their impact
- Capture security considerations and compliance notes

### Knowledge Categories to Prioritize
- **Security & Privacy**: HIPAA compliance, FHE implementation, bias detection
- **Performance**: Sub-50ms response time optimizations, memory management
- **Architecture**: Microservice patterns, AI/ML integration approaches
- **Development**: Code conventions, testing strategies, deployment procedures

## Quality Standards

- Store knowledge with clear, descriptive titles
- Include relevant code examples and configuration snippets
- Document both successful approaches and failed attempts
- Maintain searchable keywords for future retrieval