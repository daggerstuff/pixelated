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

## Architecture Decisions

### ADR-0004: Psychology Knowledge Base Enhancement (Accepted)

**Date**: December 2025
**Status**: Accepted
**Context**: Need for comprehensive psychology knowledge base to enhance AI training and therapeutic scenarios

**Decision**: Enhanced psychology knowledge base from 1,101 to 10,960 concepts through:
- Integration of xmu_psych_books dataset with 13 psychology-related books
- Integration of psychology-10k dataset with 9,846 therapeutic conversation examples
- Creation of custom processors for both datasets
- Update of Tier6KnowledgeLoader to handle enhanced JSON knowledge base files

**Rationale**:
- Significantly expanded therapeutic knowledge base with diverse content
- Added real library book references and therapeutic conversation examples
- Enhanced AI's ability to understand and respond to therapeutic scenarios
- Prepared comprehensive training data for improved model performance

**Impact**: Foundation for enhanced AI-powered therapeutic training scenarios

---

### ADR-0005: Performance Optimization Approach for Sub-500ms Latency (Recommended)

**Date**: December 2025
**Status**: Recommended
**Context**: The clinical platform currently experiences 850ms response latency, significantly impacting user experience. The target is to reduce this to sub-500ms latency.

**Decision**: Implement a **Combination Approach** that addresses multiple layers of the system architecture:

1. **Asynchronous Processing Architecture**
   - Implement event-driven architecture with message queues
   - Separate real-time critical operations from background processing
   - Decompose services for specialized functions

2. **Enhanced Multi-Tier Caching Strategy**
   - Implement L1 (in-memory), L2 (distributed), and L3 (CDN) caching
   - Use intelligent cache warming with predictive preloading
   - Cache AI responses for common therapeutic scenarios

3. **AI Service Optimization**
   - Deploy multiple MentalLLaMA model instances with load balancing
   - Implement hybrid approach with rule-based shortcuts for common cases
   - Use edge computing for faster inference

4. **Database Architecture Enhancements**
   - Implement horizontal and vertical data partitioning
   - Deploy read replicas for MongoDB and PostgreSQL
   - Optimize connection pooling and query caching

**Rationale**:
- Single-point optimizations (caching alone, query optimization alone) are insufficient to achieve the 40%+ latency reduction needed
- The current 850ms latency likely stems from multiple contributing factors that require a holistic approach
- A combination approach addresses bottlenecks at all layers of the system:
  - Frontend (progressive loading, client-side caching)
  - Network (CDN, edge computing, protocol optimization)
  - API Layer (asynchronous processing, intelligent routing)
  - AI Services (model parallelization, hybrid approaches)
  - Data Layer (partitioning, read replicas, optimized queries)
  - Caching (multi-tier strategy)

**Implementation Plan**:
1. **Phase 1 (Weeks 1-2)**: Implement enhanced caching strategy and database read replicas
2. **Phase 2 (Weeks 3-4)**: Deploy AI model parallelization and hybrid approaches
3. **Phase 3 (Weeks 5-6)**: Implement asynchronous processing architecture
4. **Phase 4 (Weeks 7-8)**: Optimize frontend and network layers

**Expected Impact**:
- 40-50% reduction in response latency (850ms → 425-510ms)
- Improved system scalability and reliability
- Better user experience with faster response times
- Reduced infrastructure costs through more efficient resource utilization

**Success Metrics**:
- Average response time < 500ms
- 95th percentile response time < 750ms
- System throughput increased by 30%
- Error rate reduced by 50%

---

## Pending Decisions

### Performance Optimization Approach

**Date**: December 2025
**Status**: DECISION MADE - See ADR-0005
**Context**: Need to achieve sub-500ms latency

**Resolution**: Combination approach recommended in ADR-0005

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
