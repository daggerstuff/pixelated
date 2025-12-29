# Decision Log

> **Builds on**: All previous memory files  
> **Focus**: Significant Choices

---

## Architecture Decisions

### ADR-0001: Core Architecture (Accepted)

**Date**: 2024-01-15  
**Status**: Accepted  
**Context**: Need for robust, scalable, secure architecture with HIPAA compliance

**Decision**: Microservices-based architecture with:
- Frontend: Astro 5.x + React 19
- API Layer: REST + WebSocket
- Core Services: Auth, AI, Analytics
- Data Layer: MongoDB Atlas, PostgreSQL (Supabase), Redis
- Infrastructure: Multi-cloud (AWS/Azure/GCP), Kubernetes

**Rationale**:
- High scalability through microservices
- Better security through service isolation
- Flexible deployment options
- Clear separation of concerns

**Alternatives Considered**:
- Monolithic: Rejected (scalability limitations)
- Serverless-only: Rejected (cold start concerns)
- Traditional three-tier: Rejected (scalability concerns)

**Impact**: Foundation for entire system architecture

---

### Package Manager Decision (Accepted)

**Date**: Project Start  
**Status**: Accepted  
**Context**: Need for consistent, fast package management

**Decision**: 
- **Node.js**: `pnpm` ONLY (never npm/yarn)
- **Python**: `uv` ONLY (never pip/conda/venv)

**Rationale**:
- pnpm: Faster, disk-efficient, strict dependency resolution
- uv: Modern Python package manager, faster than pip
- Consistency across team and CI/CD

**Impact**: All scripts, documentation, and workflows use these tools exclusively

---

### TypeScript Strict Mode (Accepted)

**Date**: Project Start  
**Status**: Accepted  
**Context**: Need for type safety and code quality

**Decision**: Enable TypeScript strict mode with:
- No implicit any
- Strict null checks
- Strict function types
- No unused locals/parameters

**Rationale**:
- Catches errors at compile time
- Improves code quality
- Better IDE support
- Reduces runtime errors

**Impact**: All code must pass strict type checking

---

### Code Style Standards (Accepted)

**Date**: Project Start  
**Status**: Accepted  
**Context**: Need for consistent code formatting

**Decision**: 
- 2 spaces indentation
- No semicolons
- Single quotes
- Trailing commas
- PascalCase for components/interfaces
- camelCase for variables/functions

**Rationale**:
- Consistency across codebase
- Easier code reviews
- Better readability
- Aligns with modern JavaScript/TypeScript practices

**Impact**: All code must follow these standards (enforced by linters)

---

### HIPAA Compliance Approach (Accepted)

**Date**: Project Start  
**Status**: Accepted  
**Context**: Legal requirement for handling PHI

**Decision**: HIPAA++ compliance with:
- End-to-end encryption
- At-rest encryption
- Fully Homomorphic Encryption (FHE) for sensitive operations
- 6-year audit log retention
- Automated compliance verification in CI/CD

**Rationale**:
- Legal requirement
- Builds user trust
- Competitive advantage
- Prevents costly violations

**Impact**: All data handling must comply with HIPAA requirements

---

### AI Model Integration Strategy (Accepted)

**Date**: 2024-05-06  
**Status**: Accepted  
**Context**: Need for specialized mental health AI models

**Decision**: MentalLLaMA integration with:
- Direct 7B and 13B model support
- PythonBridge for Python interop
- Containerized deployment
- Modular architecture for future model upgrades

**Rationale**:
- Specialized for mental health domain
- Better accuracy than general models
- Flexible architecture allows upgrades
- Containerization enables scaling

**Impact**: Foundation for all AI-powered features

---

### Database Strategy (Accepted)

**Date**: Project Start  
**Status**: Accepted  
**Context**: Need for flexible, scalable data storage

**Decision**: Multi-database approach:
- **MongoDB Atlas**: Primary database (document store)
- **PostgreSQL (Supabase)**: Relational data, authentication
- **Redis**: Caching and real-time data

**Rationale**:
- MongoDB: Flexible schema for evolving data
- PostgreSQL: Strong consistency for relational data
- Redis: Fast caching and real-time features
- Each database optimized for its use case

**Impact**: Data architecture supports both document and relational needs

---

### Authentication Strategy (Accepted)

**Date**: Project Start  
**Status**: Accepted  
**Context**: Need for secure, scalable authentication

**Decision**: Multi-provider authentication:
- **Better Auth**: Primary authentication library
- **Azure AD**: Enterprise authentication
- **Supabase Auth**: User authentication
- JWT token management

**Rationale**:
- Better Auth: Modern, flexible authentication
- Azure AD: Enterprise integration
- Supabase Auth: User management
- JWT: Stateless, scalable tokens

**Impact**: Supports both individual and enterprise users

---

### Testing Strategy (Accepted)

**Date**: Project Start  
**Status**: Accepted  
**Context**: Need for comprehensive testing

**Decision**: Multi-level testing approach:
- **Unit Tests**: Vitest for component/function testing
- **Integration Tests**: Vitest for service integration
- **E2E Tests**: Playwright for user flows
- **Security Tests**: Automated security scanning

**Rationale**:
- Comprehensive coverage
- Catches issues at different levels
- Prevents regressions
- Ensures quality

**Impact**: All features must have appropriate test coverage

---

### Deployment Strategy (Accepted)

**Date**: Project Start  
**Status**: Accepted  
**Context**: Need for reliable, scalable deployment

**Decision**: Multi-cloud deployment:
- **Primary**: AWS
- **Secondary**: Azure
- **Tertiary**: GCP
- **CDN**: Cloudflare
- **Orchestration**: Kubernetes

**Rationale**:
- Redundancy and failover
- Avoid vendor lock-in
- Optimize costs
- Global performance

**Impact**: System can deploy to multiple cloud providers

---

## Repository / Documentation Decisions

### ADR-0002: Dual Memory System with Single Source of Truth (Accepted)

**Date**: 2025-12-15  
**Status**: Accepted  
**Context**: Two memory systems exist in the repo (`.memory/` and `memory-bank/`) and were drifting.

**Decision**:
- `.memory/` is the **authoritative** memory bank (core 00–70 files).
- `memory-bank/` is a **mirrored**/secondary memory bank for continuity and historical entries.

**Rationale**:
- `.memory` matches the mandated core-file workflow (00–70).
- `memory-bank` contains valuable historical entries but is easier to drift.

**Impact**:
- Updates should be applied to `.memory` first, then mirrored into `memory-bank`.

---

### ADR-0003: Do Not Commit Large Installer Binaries (Accepted)

**Date**: 2025-12-15  
**Status**: Accepted  
**Context**: NGC CLI installer binaries were present under `ngc_cli_v4.10.0/`.

**Decision**:
- Do not version large installer binaries in git.
- Prefer scripted downloads or artifact storage when needed.

**Rationale**:
- Keeps repo size manageable.
- Reduces supply-chain and licensing risk.

**Impact**:
- Ensure `.gitignore` and documentation steer users to install via scripts or official sources.

---

## Pending Decisions

### Performance Optimization Approach

**Date**: December 2025  
**Status**: Under Discussion  
**Context**: Need to achieve sub-500ms latency

**Options**:
1. Aggressive caching strategy
2. Query optimization
3. Architecture changes
4. Combination approach

**Impact**: Will determine how to achieve performance targets

---

### Supabase RPC Functions

**Date**: December 2025  
**Status**: Under Discussion  
**Context**: Complex nested updates need atomicity

**Options**:
1. Implement RPC functions for atomic operations
2. Use transactions with careful error handling
3. Redesign data model to simplify updates

**Impact**: Will affect how complex data operations are handled

---

*Last Updated: December 2025*
