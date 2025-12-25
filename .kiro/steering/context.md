---
inclusion: always
---
# Context Guidelines

## AI Assistant Behavior

### Automatic Tool Usage
- **Context7**: Always use Context7 MCP tools for code generation, setup/configuration steps, or library/API documentation
- **Proactive Research**: Automatically resolve library IDs and get documentation without explicit requests
- **Browser Use**: Use Browser Use knowledge base for browser automation and testing questions

### Memory Bank Integration
- **Always read memory files first**: Load `.memory/00-description.md` through `.memory/70-knowledge.md` at session start
- **Exception**: Only skip memory loading when `mem:fix` command is explicitly used
- **Context continuity**: Rely on memory bank for project context and learned intelligence

## Development Context

### Project Type
- **Mental Health AI Platform**: Empathy-driven technology for therapeutic training
- **HIPAA Compliance**: All development must maintain healthcare data protection standards
- **Ethical AI**: Bias detection and fairness monitoring are core requirements

### Key Constraints
- **Package Managers**: `pnpm` for Node.js, `uv` for Python (strictly enforced)
- **Type Safety**: Strict TypeScript, no `any` types without justification
- **Security First**: All inputs treated as sensitive, comprehensive validation required
- **Accessibility**: WCAG 2.1 AA compliance is mandatory, not optional

### Architecture Context
- **Monorepo**: Frontend (Astro/React) + AI services (Python) + shared utilities
- **Microservices**: Independent scaling of AI, analytics, and core services
- **Real-time**: WebSocket connections for live training sessions
- **Privacy**: Fully homomorphic encryption (FHE) for sensitive computations

## Common Patterns

### File Organization
- Use `@/` imports for internal modules
- Co-locate related files (components, tests, styles)
- Follow established naming conventions (PascalCase components, camelCase utilities)

### Error Handling
- Graceful degradation for AI services
- Comprehensive logging without exposing PII
- Crisis signal detection and appropriate escalation

### Testing Strategy
- Test-driven development for critical paths
- Comprehensive coverage for AI bias detection
- Security testing for all data handling paths