# Skills Index (Hub-and-Spoke Lazy Loading)

*Generated: 2026-04-02 19:30:46 · Updated: 2026-05-23*
*Total skills: 139 | Populated: 139 | Empty/missing: 0*

## Purpose

This index enables **lazy loading** of skill definitions. Instead of loading all skill files at startup (which consumes 70-100K tokens), only this lightweight index is loaded initially. Individual skill details are loaded on-demand when referenced.

## Lazy Loading Directive

**When a skill is invoked:**
1. Check this index for the skill name and path
2. Load only THAT skill's SKILL.md file (typical: ~2-5K tokens)
3. Cache the loaded skill for session reuse

**Expected token reduction:**
- Startup: Index only (~5-10K tokens) vs all skills (~70-100K tokens)
- Savings: **60-70% reduction** in initial context consumption

## Skills Catalog

### Populated Skills (with documentation)

- **ab-test-setup** (`unspecified` · v4.1.0-fractal)
  > Structured guide for setting up A/B tests with mandatory gates for hypothesis, metrics, and execution readiness.
  > Path: `.agents/skills/ab-test-setup/SKILL.md`

- **git-lint** (`pixelated` · v1.0.0)
  > Run oxlint+prettier (TS/JS) and ruff check+format (Python) on all changed files (staged + unstaged) across all 4 repos. Trigger: `/git:lint` or "lint changed files".
  > Path: `.agent/skills/git-lint/SKILL.md`

- **git-push** (`pixelated` · v1.0.0)
  > Intelligently group, stage, commit, and push all 4 repos (submodules first, then main) with semantic commit message generation. Trigger: `/git:push` or "commit and push everything".
  > Path: `.agent/skills/git-push/SKILL.md`

- **accessibility-compliance-accessibility-audit** (`unspecified` · v4.1.0-fractal)
  > You are an accessibility expert specializing in WCAG compliance, inclusive design, and assistive technology compatibi...
  > Path: `.agents/skills/accessibility-compliance-accessibility-audit/SKILL.md`

- **address-github-comments** (`unspecified` · v4.1.0-fractal)
  > Use when you need to address review or issue comments on an open GitHub Pull Request using the gh CLI.
  > Path: `.agents/skills/address-github-comments/SKILL.md`

- **agent-development** (`unspecified` · vunversioned)
  > Comprehensive guide for developing Letta agents, including architecture selection, memory design, model selection, an...
  > Path: `.agents/skills/agent-development/SKILL.md`

- **agent-manager-skill** (`unspecified` · vunversioned)
  > Manage multiple local CLI agents via tmux sessions (start/stop/monitor/assign) with cron-friendly scheduling.
  > Path: `.agents/skills/agent-manager-skill/SKILL.md`

- **agent-memory-mcp** (`unspecified` · vunversioned)
  > A hybrid memory system that provides persistent, searchable knowledge management for AI agents (Architecture, Pattern...
  > Path: `.agents/skills/agent-memory-mcp/SKILL.md`

- **agent-orchestration** (`unspecified` · v4.1.0-fractal)
  > Multi-agent orchestration and state management.
  > Path: `.agents/skills/agent-orchestration/SKILL.md`

- **agent-tool-builder** (`unspecified` · vunversioned)
  > Tools are how AI agents interact with the world. A well-designed tool is the difference between an agent that works a...
  > Path: `.agents/skills/agent-tool-builder/SKILL.md`

- **agents-sdk** (`unspecified` · vunversioned)
  > Build AI agents on Cloudflare Workers using the Agents SDK. Load when creating stateful agents, durable workflows, re...
  > Path: `.agents/skills/agents-sdk/SKILL.md`

- **ai-engineer** (`unspecified` · vunversioned)
  > >
  > Path: `.agents/skills/ai-engineer/SKILL.md`

- **ai-product** (`unspecified` · vunversioned)
  > Every product will be AI-powered. The question is whether you'll build it right or ship a demo that falls apart in pr...
  > Path: `.agents/skills/ai-product/SKILL.md`

- **api-design-principles** (`unspecified` · v4.1.0-fractal)
  > Master REST and GraphQL API design principles to build intuitive, scalable, and maintainable APIs that delight develo...
  > Path: `.agents/skills/api-design-principles/SKILL.md`

- **api-documenter** (`unspecified` · vunversioned)
  > >
  > Path: `.agents/skills/api-documenter/SKILL.md`

- **api-fuzzing-bug-bounty** (`unspecified` · v4.1.0-fractal)
  > This skill should be used when the user asks to "test API security", "fuzz APIs", "find IDOR vulnerabilities", "test ...
  > Path: `.agents/skills/api-fuzzing-bug-bounty/SKILL.md`

- **api-patterns** (`unspecified` · v4.1.0-fractal)
  > API design principles and decision-making.
  > Path: `.agents/skills/api-patterns/SKILL.md`

- **architecture-decision-records** (`unspecified` · v4.1.0-fractal)
  > Write and maintain Architecture Decision Records (ADRs) following best practices for technical decision documentation...
  > Path: `.agents/skills/architecture-decision-records/SKILL.md`

- **architecture-patterns** (`unspecified` · v4.1.0-fractal)
  > Implement proven backend architecture-patterns patterns including Clean Architecture, Hexagonal Architecture, and Dom...
  > Path: `.agents/skills/architecture-patterns/SKILL.md`

- **auth-implementation-patterns** (`unspecified` · v4.1.0-fractal)
  > Master authentication and authorization patterns including JWT, OAuth2, session management, and RBAC to build secure,...
  > Path: `.agents/skills/auth-implementation-patterns/SKILL.md`

- **backend-dev-guidelines** (`unspecified` · v4.1.0-fractal)
  > Opinionated backend development standards for Node.js + Express + TypeScript microservices. Covers layered architectu...
  > Path: `.agents/skills/backend-dev-guidelines/SKILL.md`

- **bash-defensive-patterns** (`unspecified` · v4.1.0-fractal)
  > Master defensive Bash programming techniques for production-grade scripts. Use when writing robust shell scripts, CI/...
  > Path: `.agents/skills/bash-defensive-patterns/SKILL.md`

- **bash-linux** (`unspecified` · v4.1.0-fractal)
  > Bash/Linux terminal patterns and critical commands.
  > Path: `.agents/skills/bash-linux/SKILL.md`

- **building-ai-agent-on-cloudflare** (`unspecified` · vunversioned)
  > |
  > Path: `.agents/skills/building-ai-agent-on-cloudflare/SKILL.md`

- **clean-code** (`unspecified` · v4.1.0-fractal)
  > Pragmatic coding standards - concise, direct, no over-engineering, no unnecessary comments
  > Path: `.agents/skills/clean-code/SKILL.md`

- **cloud-architect** (`opus` · v4.1.0-fractal)
  > Expert cloud architect specializing in AWS/Azure/GCP multi-cloud
  > Path: `.agents/skills/cloud-architect/SKILL.md`

- **cloudflare** (`unspecified` · vunversioned)
  > Comprehensive Cloudflare platform skill covering Workers, Pages, storage (KV, D1, R2), AI (Workers AI, Vectorize, Age...
  > Path: `.agents/skills/cloudflare/SKILL.md`

- **code-review-checklist** (`unspecified` · v4.1.0-fractal)
  > Code review guidelines covering quality, security, and best practices.
  > Path: `.agents/skills/code-review-checklist/SKILL.md`

- **code-review-excellence** (`unspecified` · v4.1.0-fractal)
  > Master effective code review practices to provide constructive feedback, catch bugs early, and foster knowledge shari...
  > Path: `.agents/skills/code-review-excellence/SKILL.md`

- **context7-auto-research** (`unspecified` · v4.1.0-fractal)
  > Automatically fetch latest library/framework documentation for Claude Code via Context7 API
  > Path: `.agents/skills/context7-auto-research/SKILL.md`

- **crewai** (`unspecified` · vunversioned)
  > Expert in CrewAI - the leading role-based multi-agent framework used by 60% of Fortune 500 companies. Covers agent de...
  > Path: `.agents/skills/crewai/SKILL.md`

- **database-design** (`unspecified` · v4.1.0-fractal)
  > Database design principles and decision-making.
  > Path: `.agents/skills/database-design/SKILL.md`

- **database-migration** (`unspecified` · vunversioned)
  > >
  > Path: `.agents/skills/database-migration/SKILL.md`

- **debugging-strategies** (`unspecified` · v4.1.0-fractal)
  > Master systematic debugging techniques, profiling tools, and root cause analysis to efficiently track down bugs acros...
  > Path: `.agents/skills/debugging-strategies/SKILL.md`

- **devops-troubleshooter** (`sonnet` · v4.1.0-fractal)
  > Expert DevOps troubleshooter specializing in rapid incident
  > Path: `.agents/skills/devops-troubleshooter/SKILL.md`

- **distributed-debugging-debug-trace** (`unspecified` · v4.1.0-fractal)
  > You are a debugging expert specializing in setting up comprehensive debugging environments, distributed tracing, and ...
  > Path: `.agents/skills/distributed-debugging-debug-trace/SKILL.md`

- **docker-expert** (`unspecified` · v4.1.0-fractal)
  > Docker containerization expert with deep knowledge of multi-stage builds, image optimization, container security, Doc...
  > Path: `.agents/skills/docker-expert/SKILL.md`

- **documentation-templates** (`unspecified` · v4.1.0-fractal)
  > Documentation templates and structure guidelines. README, API docs, code comments.
  > Path: `.agents/skills/documentation-templates/SKILL.md`

- **e2e-testing-patterns** (`unspecified` · v4.1.0-fractal)
  > Master end-to-end testing with Playwright and Cypress to build reliable test suites that catch bugs, improve confiden...
  > Path: `.agents/skills/e2e-testing-patterns/SKILL.md`

- **error-handling-patterns** (`unspecified` · v4.1.0-fractal)
  > Master error handling patterns across languages including exceptions, Result types, error propagation, and graceful d...
  > Path: `.agents/skills/error-handling-patterns/SKILL.md`

- **exa-search** (`unspecified` · vunversioned)
  > Semantic search, similar content discovery, and structured research using Exa API
  > Path: `.agents/skills/exa-search/SKILL.md`

- **fastapi-templates** (`unspecified` · v4.1.0-fractal)
  > Create production-ready FastAPI projects with async patterns, dependency injection, and comprehensive error handling....
  > Path: `.agents/skills/fastapi-templates/SKILL.md`

- **frontend-design** (`unspecified` · v4.1.0-fractal)
  > Design thinking and decision-making for web UI.
  > Path: `.agents/skills/frontend-design/SKILL.md`

- **frontend-dev-guidelines** (`unspecified` · v4.1.0-fractal)
  > Opinionated frontend development standards for modern React + TypeScript applications. Covers Suspense-first data fet...
  > Path: `.agents/skills/frontend-dev-guidelines/SKILL.md`

- **frontend-mobile-development-component-scaffold** (`unspecified` · v4.1.0-fractal)
  > You are a React component architecture-patterns expert specializing in scaffolding production-ready, accessible, and ...
  > Path: `.agents/skills/frontend-mobile-development-component-scaffold/SKILL.md`

- **frontend-slides** (`unspecified` · vunversioned)
  > Create stunning, animation-rich HTML presentations from scratch or by converting PowerPoint files. Use when the user ...
  > Path: `.agents/skills/frontend-slides/SKILL.md`

- **git-advanced-workflows** (`unspecified` · v4.1.0-fractal)
  > Master advanced Git workflows including rebasing, cherry-picking, bisect, worktrees, and reflog to maintain clean his...
  > Path: `.agents/skills/git-advanced-workflows/SKILL.md`

- **git-collaboration-master** (`unspecified` · vunversioned)
  > >
  > Path: `.agents/skills/git-collaboration-master/SKILL.md`

- **github-mcp** (`unspecified` · v4.1.0-fractal)
  > Official GitHub Model Context Protocol Server for repository management.
  > Path: `.agents/skills/github-mcp/SKILL.md`

- **github-workflow-automation** (`unspecified` · v4.1.0-fractal)
  > Automate GitHub workflows with AI assistance. Includes PR reviews, issue triage, CI/CD integration, and Git operation...
  > Path: `.agents/skills/github-workflow-automation/SKILL.md`

- **grafana-dashboards** (`unspecified` · vunversioned)
  > Create and manage production Grafana dashboards for real-time visualization of system and application metrics. Use wh...
  > Path: `.agents/skills/grafana-dashboards/SKILL.md`

- **hybrid-search-implementation** (`unspecified` · vunversioned)
  > Combine vector and keyword search for improved retrieval. Use when implementing RAG systems, building search engines,...
  > Path: `.agents/skills/hybrid-search-implementation/SKILL.md`

- **incident-responder** (`unspecified` · vunversioned)
  > >
  > Path: `.agents/skills/incident-responder/SKILL.md`

- **javascript-typescript-typescript-scaffold** (`unspecified` · v4.1.0-fractal)
  > You are a TypeScript project architecture-patterns expert specializing in scaffolding production-ready Node.js and fr...
  > Path: `.agents/skills/javascript-typescript-typescript-scaffold/SKILL.md`

- **k8s-security-policies** (`unspecified` · v4.1.0-fractal)
  > Implement Kubernetes security policies including NetworkPolicy, PodSecurityPolicy, and RBAC for production-grade secu...
  > Path: `.agents/skills/k8s-security-policies/SKILL.md`

- **langgraph** (`unspecified` · vunversioned)
  > Expert in LangGraph - the production-grade framework for building stateful, multi-actor AI applications. Covers graph...
  > Path: `.agents/skills/langgraph/SKILL.md`

- **lint-and-validate** (`unspecified` · vunversioned)
  > Automatic quality control, linting, and static analysis procedures. Use after every code modification to ensure synta...
  > Path: `.agents/skills/lint-and-validate/SKILL.md`

- **linux-shell-scripting** (`unspecified` · v1.1)
  > This skill should be used when the user asks to "create bash scripts", "automate Linux tasks", "monitor system resour...
  > Path: `.agents/skills/linux-shell-scripting/SKILL.md`

- **machine-learning-ops-ml-pipeline** (`unspecified` · vunversioned)
  > Design and implement a complete ML pipeline for: $ARGUMENTS
  > Path: `.agents/skills/machine-learning-ops-ml-pipeline/SKILL.md`

- **mcp-builder** (`unspecified` · vunversioned)
  > MCP (Model Context Protocol) server building principles. Tool design, resource patterns, best practices.
  > Path: `.agents/skills/mcp-builder/SKILL.md`

- **memory-systems** (`unspecified` · vunversioned)
  > Design short-term, long-term, and graph-based memory architectures
  > Path: `.agents/skills/memory-systems/SKILL.md`

- **mermaid-expert** (`haiku` · vunversioned)
  > Create Mermaid diagrams for flowcharts, sequences, ERDs, and
  > Path: `.agents/skills/mermaid-expert/SKILL.md`

- **ml-engineer** (`inherit` · vunversioned)
  > Build production ML systems with PyTorch 2.x, TensorFlow, and
  > Path: `.agents/skills/ml-engineer/SKILL.md`

- **ml-pipeline-workflow** (`unspecified` · v4.1.0-fractal)
  > Build end-to-end MLOps pipelines from data preparation through model training, validation, and production deployment....
  > Path: `.agents/skills/ml-pipeline-workflow/SKILL.md`

- **mlops-engineer** (`inherit` · vunversioned)
  > Build comprehensive ML pipelines, experiment tracking, and model
  > Path: `.agents/skills/mlops-engineer/SKILL.md`

- **modern-web-performance** (`unspecified` · v4.1.0-fractal)
  > High-Performance Web Engineering.
  > Path: `.agents/skills/modern-web-performance/SKILL.md`

- **monorepo-architect** (`unspecified` · vunversioned)
  > Expert in monorepo architecture, build systems, and dependency management at scale. Masters Nx, Turborepo, Bazel, and...
  > Path: `.agents/skills/monorepo-architect/SKILL.md`

- **monorepo-management** (`unspecified` · vunversioned)
  > Master monorepo management with Turborepo, Nx, and pnpm workspaces to build efficient, scalable multi-package reposit...
  > Path: `.agents/skills/monorepo-management/SKILL.md`

- **multi-agent-patterns** (`unspecified` · vunversioned)
  > Master orchestrator, peer-to-peer, and hierarchical multi-agent architectures
  > Path: `.agents/skills/multi-agent-patterns/SKILL.md`

- **neon-postgres** (`unspecified` · vunversioned)
  > Expert patterns for Neon serverless Postgres, branching, connection pooling, and Prisma/Drizzle integration Use when:...
  > Path: `.agents/skills/neon-postgres/SKILL.md`

- **nextjs-app-router-patterns** (`unspecified` · v4.1.0-fractal)
  > Master Next.js 14+ App Router with Server Components, streaming, parallel routes, and advanced data fetching. Use whe...
  > Path: `.agents/skills/nextjs-app-router-patterns/SKILL.md`

- **nextjs-best-practices** (`unspecified` · v4.1.0-fractal)
  > Next.js App Router principles. Server Components, data fetching, routing patterns.
  > Path: `.agents/skills/nextjs-best-practices/SKILL.md`

- **nodejs-backend-patterns** (`unspecified` · v4.1.0-fractal)
  > Build production-ready Node.js backend services with Express/Fastify, implementing middleware patterns, error handlin...
  > Path: `.agents/skills/nodejs-backend-patterns/SKILL.md`

- **nodejs-best-practices** (`unspecified` · v4.1.0-fractal)
  > Node.js development principles and decision-making.
  > Path: `.agents/skills/nodejs-best-practices/SKILL.md`

- **observability-engineer** (`inherit` · vunversioned)
  > Build production-ready monitoring, logging, and tracing systems.
  > Path: `.agents/skills/observability-engineer/SKILL.md`

- **openapi-spec-generation** (`unspecified` · v4.1.0-fractal)
  > Generate and maintain OpenAPI 3.1 specifications from code, design-first specs, and validation patterns. Use when cre...
  > Path: `.agents/skills/openapi-spec-generation/SKILL.md`

- **performance-engineer** (`unspecified` · vunversioned)
  > >
  > Path: `.agents/skills/performance-engineer/SKILL.md`

- **performance-profiling** (`unspecified` · v4.1.0-fractal)
  > Performance profiling principles. Measurement, analysis, and optimization techniques.
  > Path: `.agents/skills/performance-profiling/SKILL.md`

- **performance-testing-review-ai-review** (`unspecified` · v4.1.0-fractal)
  > You are an expert AI-powered code review specialist combining automated static analysis, intelligent pattern recognit...
  > Path: `.agents/skills/performance-testing-review-ai-review/SKILL.md`

- **performance-testing-review-multi-agent-review** (`unspecified` · v4.1.0-fractal)
  > Use when working with performance testing review multi agent review
  > Path: `.agents/skills/performance-testing-review-multi-agent-review/SKILL.md`

- **personal-tool-builder** (`unspecified` · vunversioned)
  > Expert in building custom tools that solve your own problems first. The best products often start as personal tools -...
  > Path: `.agents/skills/personal-tool-builder/SKILL.md`

- **planning-with-files** (`unspecified` · v4.1.0-fractal)
  > Implements Manus-style file-based planning for complex tasks. Creates task_plan.md, findings.md, and progress.md. Use...
  > Path: `.agents/skills/planning-with-files/SKILL.md`

- **playwright-skill** (`unspecified` · vunversioned)
  > Complete browser automation with Playwright. Auto-detects dev servers, writes clean test scripts to /tmp. Test pages,...
  > Path: `.agents/skills/playwright-skill/SKILL.md`

- **postgres-best-practices** (`unspecified` · v1.0.0)
  > Postgres performance optimization and best practices from Supabase. Use this skill when writing, reviewing, or optimi...
  > Path: `.agents/skills/postgres-best-practices/SKILL.md`

- **prometheus-configuration** (`unspecified` · vunversioned)
  > Set up Prometheus for comprehensive metric collection, storage, and monitoring of infrastructure and applications. Us...
  > Path: `.agents/skills/prometheus-configuration/SKILL.md`

- **prompt-caching** (`unspecified` · vunversioned)
  > Caching strategies for LLM prompts including Anthropic prompt caching, response caching, and CAG (Cache Augmented Gen...
  > Path: `.agents/skills/prompt-caching/SKILL.md`

- **prompt-engineering** (`unspecified` · vunversioned)
  > Expert guide on prompt engineering patterns, best practices, and optimization techniques. Use when user wants to impr...
  > Path: `.agents/skills/prompt-engineering/SKILL.md`

- **python-patterns** (`unspecified` · v4.1.0-fractal)
  > Python development principles and decision-making.
  > Path: `.agents/skills/python-patterns/SKILL.md`

- **python-performance-optimization** (`unspecified` · v4.1.0-fractal)
  > Profile and optimize Python code using cProfile, memory profilers, and performance best practices. Use when debugging...
  > Path: `.agents/skills/python-performance-optimization/SKILL.md`

- **radix-ui-design-system** (`unspecified` · vunversioned)
  > Build accessible design systems with Radix UI primitives. Headless component customization, theming strategies, and c...
  > Path: `.agents/skills/radix-ui-design-system/SKILL.md`

- **rag-engineer** (`unspecified` · v4.1.0-fractal)
  > Expert in building Retrieval-Augmented Generation systems. Masters embedding models, vector databases, chunking strat...
  > Path: `.agents/skills/rag-engineer/SKILL.md`

- **rag-implementation** (`unspecified` · vunversioned)
  > Build Retrieval-Augmented Generation (RAG) systems for LLM applications with vector databases and semantic search. Us...
  > Path: `.agents/skills/rag-implementation/SKILL.md`

- **react-best-practices** (`unspecified` · v4.1.0-fractal)
  > React & Next.js engineering standards.
  > Path: `.agents/skills/react-best-practices/SKILL.md`

- **react-patterns** (`unspecified` · v4.1.0-fractal)
  > Modern React patterns and principles. Hooks, composition, performance, TypeScript best practices.
  > Path: `.agents/skills/react-patterns/SKILL.md`

- **react-state-management** (`unspecified` · v4.1.0-fractal)
  > Master modern React state management with Redux Toolkit, Zustand, Jotai, and React Query. Use when setting up global ...
  > Path: `.agents/skills/react-state-management/SKILL.md`

- **reference-builder** (`haiku` · vunversioned)
  > Creates exhaustive technical references and API documentation.
  > Path: `.agents/skills/reference-builder/SKILL.md`

- **research-engineer** (`unspecified` · vunversioned)
  > An uncompromising Academic Research Engineer. Operates with absolute scientific rigor, objective criticism, and zero ...
  > Path: `.agents/skills/research-engineer/SKILL.md`

- **saga-orchestration** (`unspecified` · vunversioned)
  > Implement saga patterns for distributed transactions and cross-aggregate workflows. Use when coordinating multi-step ...
  > Path: `.agents/skills/saga-orchestration/SKILL.md`

- **screen-reader-testing** (`unspecified` · v4.1.0-fractal)
  > Test web applications with screen readers including VoiceOver, NVDA, and JAWS. Use when validating screen reader comp...
  > Path: `.agents/skills/screen-reader-testing/SKILL.md`

- **search-specialist** (`haiku` · v4.1.0-fractal)
  > Expert web researcher using advanced search techniques and
  > Path: `.agents/skills/search-specialist/SKILL.md`

- **security-auditor** (`unspecified` · vunversioned)
  > >
  > Path: `.agents/skills/security-auditor/SKILL.md`

- **security-compliance-compliance-check** (`unspecified` · v4.1.0-fractal)
  > You are a compliance expert specializing in regulatory requirements for software systems including GDPR, HIPAA, SOC2,...
  > Path: `.agents/skills/security-compliance-compliance-check/SKILL.md`

- **security-requirement-extraction** (`unspecified` · v4.1.0-fractal)
  > Derive security requirements from threat models and business context. Use when translating threats into actionable re...
  > Path: `.agents/skills/security-requirement-extraction/SKILL.md`

- **security-scanning-security-dependencies** (`unspecified` · v4.1.0-fractal)
  > You are a security expert specializing in dependency vulnerability analysis, SBOM generation, and supply chain securi...
  > Path: `.agents/skills/security-scanning-security-dependencies/SKILL.md`

- **security-scanning-security-hardening** (`unspecified` · v4.1.0-fractal)
  > Coordinate multi-layer security scanning and hardening across application, infrastructure, and compliance controls.
  > Path: `.agents/skills/security-scanning-security-hardening/SKILL.md`

- **security-scanning-security-sast** (`unspecified` · v4.1.0-fractal)
  > Static Application Security Testing (SAST) for code vulnerability
  > Path: `.agents/skills/security-scanning-security-sast/SKILL.md`

- **shellcheck-configuration** (`unspecified` · vunversioned)
  > Master ShellCheck static analysis configuration and usage for shell script quality. Use when setting up linting infra...
  > Path: `.agents/skills/shellcheck-configuration/SKILL.md`

- **similarity-search-patterns** (`unspecified` · v4.1.0-fractal)
  > Implement efficient similarity search with vector databases. Use when building semantic search, implementing nearest ...
  > Path: `.agents/skills/similarity-search-patterns/SKILL.md`

- **slo-implementation** (`unspecified` · vunversioned)
  > Define and implement Service Level Indicators (SLIs) and Service Level Objectives (SLOs) with error budgets and alert...
  > Path: `.agents/skills/slo-implementation/SKILL.md`

- **software-architecture** (`unspecified` · v4.1.0-fractal)
  > Guide for quality focused software architecture. This skill should be used when users want to write code, design arch...
  > Path: `.agents/skills/software-architecture/SKILL.md`

- **sql-optimization-patterns** (`unspecified` · v4.1.0-fractal)
  > Master SQL query optimization, indexing strategies, and EXPLAIN analysis to dramatically improve database performance...
  > Path: `.agents/skills/sql-optimization-patterns/SKILL.md`

- **stitch-ui-design** (`unspecified` · vunversioned)
  > Expert guide for creating effective prompts for Google Stitch AI UI design tool. Use when user wants to design UI/UX ...
  > Path: `.agents/skills/stitch-ui-design/SKILL.md`

- **strategic-planning** (`unspecified` · vunversioned)
  > Analyzes the founder's business context to deliver the 3 highest-impact next moves for growth (marketing or sales). A...
  > Path: `.agents/skills/strategic-planning/SKILL.md`

- **subagent-driven-development** (`unspecified` · vunversioned)
  > Use when executing implementation plans with independent tasks in the current session
  > Path: `.agents/skills/subagent-driven-development/SKILL.md`

- **systematic-debugging** (`unspecified` · v4.1.0-fractal)
  > 4-phase systematic debugging methodology with root cause analysis and evidence-based verification.
  > Path: `.agents/skills/systematic-debugging/SKILL.md`

- **tailwind-design-system** (`unspecified` · v4.1.0-fractal)
  > Build scalable design systems with Tailwind CSS, design tokens, component libraries, and responsive patterns. Use whe...
  > Path: `.agents/skills/tailwind-design-system/SKILL.md`

- **tailwind-patterns** (`unspecified` · v4.1.0-fractal)
  > Tailwind CSS v4 principles and modern design tokens.
  > Path: `.agents/skills/tailwind-patterns/SKILL.md`

- **tdd-workflow** (`unspecified` · v4.1.0-fractal)
  > Test-Driven Development workflow principles. RED-GREEN-REFACTOR cycle.
  > Path: `.agents/skills/tdd-workflow/SKILL.md`

- **terraform-specialist** (`opus` · v4.1.0-fractal)
  > Expert Terraform/OpenTofu specialist mastering advanced IaC
  > Path: `.agents/skills/terraform-specialist/SKILL.md`

- **test-fixing** (`unspecified` · v4.1.0-fractal)
  > Run tests and systematically fix all failing tests using smart error grouping. Use when user asks to fix failing test...
  > Path: `.agents/skills/test-fixing/SKILL.md`

- **testing-patterns** (`unspecified` · v4.1.0-fractal)
  > Testing patterns and principles. Unit, integration, mocking strategies.
  > Path: `.agents/skills/testing-patterns/SKILL.md`

- **typescript-advanced-types** (`unspecified` · v4.1.0-fractal)
  > Master TypeScript's advanced type system including generics, conditional types, mapped types, template literals, and ...
  > Path: `.agents/skills/typescript-advanced-types/SKILL.md`

- **typescript-expert** (`unspecified` · v4.1.0-fractal)
  > >-
  > Path: `.agents/skills/typescript-expert/SKILL.md`

- **ui-skills** (`unspecified` · vunversioned)
  > Opinionated, evolving constraints to guide agents when building interfaces
  > Path: `.agents/skills/ui-skills/SKILL.md`

- **ui-ux-designer** (`sonnet` · v4.1.0-fractal)
  > Create interface designs, wireframes, and design systems. Masters
  > Path: `.agents/skills/ui-ux-designer/SKILL.md`

- **ui-ux-pro-max** (`unspecified` · vunversioned)
  > UI/UX design intelligence. 50 styles, 21 palettes, 50 font pairings, 20 charts, 9 stacks (React, Next.js, Vue, Svelte...
  > Path: `.agents/skills/ui-ux-pro-max/SKILL.md`

- **ui-visual-validator** (`sonnet` · vunversioned)
  > Rigorous visual validation expert specializing in UI testing,
  > Path: `.agents/skills/ui-visual-validator/SKILL.md`

- **using-git-worktrees** (`unspecified` · v4.1.0-fractal)
  > Use when starting feature work that needs isolation from current workspace or before executing implementation plans -...
  > Path: `.agents/skills/using-git-worktrees/SKILL.md`

- **uv-package-manager** (`unspecified` · vunversioned)
  > Master the uv package manager for fast Python dependency management, virtual environments, and modern Python project ...
  > Path: `.agents/skills/uv-package-manager/SKILL.md`

- **vector-database-engineer** (`unspecified` · v4.1.0-fractal)
  > Expert in vector databases, embedding strategies, and semantic search implementation. Masters Pinecone, Weaviate, Qdr...
  > Path: `.agents/skills/vector-database-engineer/SKILL.md`

- **vector-index-tuning** (`unspecified` · vunversioned)
  > Optimize vector index performance for latency, recall, and memory. Use when tuning HNSW parameters, selecting quantiz...
  > Path: `.agents/skills/vector-index-tuning/SKILL.md`

- **vercel-deploy-claimable** (`unspecified` · vunversioned)
  > Deploy applications and websites to Vercel. Use this skill when the user requests deployment actions such as 'Deploy ...
  > Path: `.agents/skills/vercel-deploy-claimable/SKILL.md`

- **verification-before-completion** (`unspecified` · vunversioned)
  > Use when about to claim work is complete, fixed, or passing, before committing or creating PRs - requires running ver...
  > Path: `.agents/skills/verification-before-completion/SKILL.md`

- **voice-ai-development** (`unspecified` · vunversioned)
  > Expert in building voice AI applications - from real-time voice agents to voice-enabled apps. Covers OpenAI Realtime ...
  > Path: `.agents/skills/voice-ai-development/SKILL.md`

- **wcag-audit-patterns** (`unspecified` · v4.1.0-fractal)
  > Conduct WCAG 2.2 accessibility audits with automated testing, manual verification, and remediation guidance. Use when...
  > Path: `.agents/skills/wcag-audit-patterns/SKILL.md`

- **web-artifacts-builder** (`unspecified` · vunversioned)
  > Suite of tools for creating elaborate, multi-component claude.ai HTML artifacts using modern frontend web technologie...
  > Path: `.agents/skills/web-artifacts-builder/SKILL.md`

- **web-design-guidelines** (`unspecified` · v4.1.0-fractal)
  > Review UI code for Web Interface Guidelines compliance.
  > Path: `.agents/skills/web-design-guidelines/SKILL.md`

- **web-performance-optimization** (`unspecified` · v4.1.0-fractal)
  > Optimize website and web application performance including loading speed, Core Web Vitals, bundle size, caching strat...
  > Path: `.agents/skills/web-performance-optimization/SKILL.md`

- **workflow-orchestration-patterns** (`unspecified` · v4.1.0-fractal)
  > Design durable workflows with Temporal for distributed systems. Covers workflow vs activity separation, saga patterns...
  > Path: `.agents/skills/workflow-orchestration-patterns/SKILL.md`

## Implementation Notes

This index replaces the eager loading pattern in `START_HERE.md`. The startup sequence should:
1. Load ONLY this index file (12-15KB maximum)
2. When a skill is requested via `task(load_skills=[...])` or `skill` tool, load the specific SKILL.md files from the paths listed
3. Cache loaded skills in memory for the session duration
4. If a skill is not in this index, fall back to scanning the directory (rare; for new skills not yet indexed)

**No changes required** to individual SKILL.md files — this index is the hub, the SKILL.md files are the spokes.

---

*End of Skills Index*