# AGENTS.md — Modern Ops in Pixelated

## Mission
- Build empathetic, production-ready features with zero tolerance for privacy leaks.
- Move fast without breaking safety rails or style conventions.

## Tooling (in use)
- Node/JS/TS: `pnpm` only. Common tasks: `pnpm dev`, `pnpm dev:all-services`, `pnpm check:all`, `pnpm test:all`, `pnpm security:check`, `pnpm security:scan`, `pnpm test:security`.
- Python: `uv` only (never pip/conda). Respect type hints and PEP 8.
- Git hygiene: avoid destructive resets; keep branches small and focused.

## Code Style (in use)
- TS/JS: 2 spaces, no semicolons, single quotes, trailing commas, strict types; avoid `any`.
- Python: typed, small pure functions where possible.
- Follow `CLAUDE.md` and `.kiro/steering/code-style.md` when applicable.

## Privacy & Safety (in use)
- Treat all inputs as sensitive; do not log secrets/PII.
- Validate emotion scores (0–1), lengths, locales; handle crisis/edge signals defensively (see `security-ethics.md`).
- Respect feature flags/config-driven behavior; no silent behavior changes.

## Delivery Expectations
- Add/extend tests with behavior changes; keep diffs reviewable.
- Run `pnpm check:all` and `pnpm test:all` before claiming done (and relevant security checks when touching risk areas).
- Remove dead code and debug noise; keep accessibility intact (focus order, aria labels, contrast).

## Collaboration
- State intent before big edits; confirm assumptions quickly.
- Offer options with trade-offs when uncertain; pick the safest/highest-signal path.
- Record important learnings in the project knowledge base after finishing work.

## Quick Checklist (per task)
- Branch clean, git status clean enough to stage.
- Implementation matches style guides; no forbidden tooling (`npm`/`yarn`/`pip`).
- Tests/lints/security checks run as applicable; summarize change, risk, and how to verify.
<!-- PRPM_MANIFEST_START -->

<skills_system priority="1">
<usage>
When users ask you to perform tasks, check if any of the available skills below can help complete the task more effectively. Skills provide specialized capabilities and domain knowledge.

How to use skills (loaded into main context):
- Use the <path> from the skill entry below
- Invoke: Bash("cat <path>")
- The skill content will load into your current context
- Example: Bash("cat .openskills/backend-architect/SKILL.md")

Usage notes:
- Skills share your context window
- Do not invoke a skill that is already loaded in your context
</usage>

<available_skills>

<skill activation="lazy">
<name>thinking-framework</name>
<description>Systematic problem-solving using 14 proven thinking methodologies - 5 Why, SWOT, First Principles, Design Thinking, TRIZ, SCAMPER, Pareto, PDCA, DMAIC, and more</description>
<path>.openskills/thinking-framework/SKILL.md</path>
</skill>

<skill activation="lazy">
<name>web-research</name>
<description>Comprehensive web research framework with source credibility assessment, and structured investigation workflows</description>
<path>.openskills/web-research/SKILL.md</path>
</skill>

<skill activation="lazy">
<name>agent-builder-skill</name>
<description>Use when creating, improving, or troubleshooting Claude Code subagents. Expert guidance on agent design, system prompts, tool access, model selection, and delegation patterns for building specialized AI assistants.</description>
<path>.openskills/agent-builder-skill/SKILL.md</path>
</skill>

<skill activation="lazy">
<name>market-strategy</name>
<description>Strategic market analysis framework for competitive positioning, market entry, and business strategy development</description>
<path>.openskills/market-strategy/SKILL.md</path>
</skill>

<skill activation="lazy">
<name>ai-persona-creator</name>
<description>Use when analyzing stakeholder psychology for negotiations, proposals, or persuasion. Creates research-backed personas revealing hidden motivations through 7 psychological frameworks (Kahneman, Cialdini, Voss, Navarro, Ariely, Evolution, Organization).</description>
<path>.openskills/ai-persona-creator/SKILL.md</path>
</skill>

<skill activation="lazy">
<name>cloudflare</name>
<description>Guide for building applications on Cloudflare&apos;s edge platform. Use when implementing serverless functions (Workers), edge databases (D1), storage (R2, KV), real-time apps (Durable Objects), AI features (Workers AI, AI Gateway), static sites (Pages), or any edge computing solutions.</description>
<path>.openskills/cloudflare/SKILL.md</path>
</skill>

<skill activation="lazy">
<name>file-organizer</name>
<description>Intelligently organizes your files and folders across your computer by understanding context, finding duplicates, suggesting better structures, and automating cleanup tasks. Reduces cognitive load and keeps your digital workspace tidy without manual effort.</description>
<path>.openskills/file-organizer/SKILL.md</path>
</skill>

<skill activation="lazy">
<name>claude-skills-ai-sdk-core</name>
<description>Backend AI functionality with Vercel AI SDK v5 - text generation, structured output with Zod,
tool calling, and agents. Multi-provider support for OpenAI, Anthropic, Google, and Cloudflare Workers AI.</description>
<path>.openskills/claude-skills-ai-sdk-core/SKILL.md</path>
</skill>

<skill activation="lazy">
<name>egregora-jules-api</name>
<description>Delegate asynchronous coding tasks to Jules (Google&apos;s AI coding agent) to maximize efficiency. Use for code reviews, refactoring, adding tests, bug fixes, and documentation. Proactively suggest Jules delegation when appropriate. Invoke when user asks to interact with Jules, create sessions, check task status, or when tasks are suitable for async delegation.</description>
<path>.openskills/egregora-jules-api/SKILL.md</path>
</skill>

<skill activation="lazy">
<name>skills-claude-social-proof-mastery-skill</name>
<description>Master social proof psychology for marketing influence. Use for: testimonial strategies, case study frameworks, user-generated content (UGC), social validation tactics, review systems, community proof, bandwagon effects, social pressure mechanics, &quot;everyone except you&quot; pattern, countdown + social momentum, in-group vs out-group framing, public leaderboards, negative reference groups, conformity bias, exclusion anxiety, competitive pressure, and measuring social proof ROI. Also use for Thai keywords &quot;ทุกคนทำแล้ว&quot;, &quot;คนอื่นทำแล้ว&quot;, &quot;เหลือแค่คุณ&quot;, &quot;คู่แข่งใช้แล้ว&quot;, &quot;อย่าตกขบวน&quot;, &quot;กลุ่มผู้นำ&quot;, &quot;Leaderboard&quot;, &quot;อันดับ&quot;, &quot;Top 10&quot;, &quot;อย่าเป็นคนสุดท้าย&quot;, &quot;ทุกคนซื้อ&quot;, &quot;คนดู&quot;, &quot;กำลังซื้อ&quot;.</description>
<path>.openskills/skills-claude-social-proof-mastery-skill/SKILL.md</path>
</skill>

<skill activation="lazy">
<name>claude-config-ai-llm-development</name>
<description>Apply modern AI/LLM development best practices: staying current on models, prompt/context engineering, architecture patterns, stack decisions, evaluation, and production deployment. Use when building AI features, selecting models, writing prompts, reviewing LLM code, or discussing AI architecture.</description>
<path>.openskills/claude-config-ai-llm-development/SKILL.md</path>
</skill>

<skill activation="lazy">
<name>claude-user-memory-pattern-recognition-skill-md</name>
<description>Systematic methodology for identifying, capturing, and documenting reusable patterns from implementations. Enables automatic learning and knowledge-core.md updates. Claude invokes this after successful implementations to preserve institutional knowledge.</description>
<path>.openskills/claude-user-memory-pattern-recognition-skill-md/SKILL.md</path>
</skill>

<skill activation="lazy">
<name>llmemory-hybrid-search</name>
<description>Use when building search systems that need both semantic similarity and keyword matching - covers combining vector and BM25 search with Reciprocal Rank Fusion, alpha tuning for search weight control, and optimizing retrieval quality</description>
<path>.openskills/llmemory-hybrid-search/SKILL.md</path>
</skill>

<skill activation="lazy">
<name>skill-subagent-driven-development</name>
<description>Use when executing implementation plans with independent tasks in the current session - dispatches fresh subagent for each task with code review between tasks, enabling fast iteration with quality gates</description>
<path>.openskills/skill-subagent-driven-development/SKILL.md</path>
</skill>

<skill activation="lazy">
<name>skill-condition-based-waiting</name>
<description>Use when tests have race conditions, timing dependencies, or inconsistent pass/fail behavior - replaces arbitrary timeouts with condition polling to wait for actual state changes, eliminating flaky tests from timing guesses</description>
<path>.openskills/skill-condition-based-waiting/SKILL.md</path>
</skill>

<skill activation="lazy">
<name>pulumi-troubleshooting-skill</name>
<description>Comprehensive guide to troubleshooting common Pulumi TypeScript errors, infrastructure issues, and best practices</description>
<path>.openskills/pulumi-troubleshooting-skill/SKILL.md</path>
</skill>

<skill activation="lazy">
<name>self-improving</name>
<description>Use when starting infrastructure, testing, deployment, or framework-specific tasks - automatically searches PRPM registry for relevant expertise packages and suggests installation to enhance capabilities for the current task</description>
<path>.openskills/self-improving/SKILL.md</path>
</skill>

</available_skills>
</skills_system>

<agents_system priority="1">
<usage>
Agents are specialized AI assistants that run in independent contexts for complex multi-step tasks.

How to use agents (spawned with independent context):
- The <path> from the agent entry contains the agent definition file
- The agent definition will be automatically loaded into the subagent's context
- Invoke: Task(subagent_type="<agent-name>", prompt="task description")
- The agent runs in a separate context and returns results
- Example: Task(subagent_type="code-reviewer", prompt="Review the authentication code in auth.ts")

Usage notes:
- Agents have independent context windows
- Each agent invocation is stateless
- Agents are spawned as subprocesses via the Task tool
- The agent's AGENT.md file is loaded into the subagent's context automatically
</usage>

<available_agents>

<agent activation="lazy">
<name>ui-visual-validator</name>
<description>Rigorous visual validation expert specializing in UI testing, design system compliance, and accessibility verification. Masters screenshot analysis, visual regression testing, and component validation. Use PROACTIVELY to verify UI modifications have achieved their intended goals through comprehensive visual analysis.</description>
<path>.openagents/ui-visual-validator/AGENT.md</path>
</agent>

<agent activation="lazy">
<name>django-pro</name>
<description>Master Django 5.x with async views, DRF, Celery, and Django Channels. Build scalable web applications with proper architecture, testing, and deployment. Use PROACTIVELY for Django development, ORM optimization, or complex Django patterns.</description>
<path>.openagents/django-pro/AGENT.md</path>
</agent>

<agent activation="lazy">
<name>fastapi-pro</name>
<description>Build high-performance async APIs with FastAPI, SQLAlchemy 2.0, and Pydantic V2. Master microservices, WebSockets, and modern Python async patterns. Use PROACTIVELY for FastAPI development, async optimization, or API architecture.</description>
<path>.openagents/fastapi-pro/AGENT.md</path>
</agent>

<agent activation="lazy">
<name>api-documenter</name>
<description>Master API documentation with OpenAPI 3.1, AI-powered tools, and modern developer experience practices. Create interactive docs, generate SDKs, and build comprehensive developer portals. Use PROACTIVELY for API documentation or developer portal creation.</description>
<path>.openagents/api-documenter/AGENT.md</path>
</agent>

<agent activation="lazy">
<name>frontend-developer</name>
<description>Build React components, implement responsive layouts, and handle client-side state management. Masters React 19, Next.js 15, and modern frontend architecture. Optimizes performance and ensures accessibility. Use PROACTIVELY when creating UI components or fixing frontend issues.</description>
<path>.openagents/frontend-developer/AGENT.md</path>
</agent>

<agent activation="lazy">
<name>observability-engineer</name>
<description>Build production-ready monitoring, logging, and tracing systems. Implements comprehensive observability strategies, SLI/SLO management, and incident response workflows. Use PROACTIVELY for monitoring infrastructure, performance optimization, or production reliability.</description>
<path>.openagents/observability-engineer/AGENT.md</path>
</agent>

<agent activation="lazy">
<name>backend-security-coder</name>
<description>Expert in secure backend coding practices specializing in input validation, authentication, and API security. Use PROACTIVELY for backend security implementations or security code reviews.</description>
<path>.openagents/backend-security-coder/AGENT.md</path>
</agent>

<agent activation="lazy">
<name>graphql-architect</name>
<description>Master modern GraphQL with federation, performance optimization, and enterprise security. Build scalable schemas, implement advanced caching, and design real-time systems. Use PROACTIVELY for GraphQL architecture or performance optimization.</description>
<path>.openagents/graphql-architect/AGENT.md</path>
</agent>

<agent activation="lazy">
<name>tdd-orchestrator</name>
<description>Master TDD orchestrator specializing in red-green-refactor discipline, multi-agent workflow coordination, and comprehensive test-driven development practices. Enforces TDD best practices across teams with AI-assisted testing and modern frameworks. Use PROACTIVELY for TDD implementation and governance.</description>
<path>.openagents/tdd-orchestrator/AGENT.md</path>
</agent>

<agent activation="lazy">
<name>blockchain-developer</name>
<description>Build production-ready Web3 applications, smart contracts, and decentralized systems. Implements DeFi protocols, NFT platforms, DAOs, and enterprise blockchain integrations. Use PROACTIVELY for smart contracts, Web3 apps, DeFi protocols, or blockchain infrastructure.</description>
<path>.openagents/blockchain-developer/AGENT.md</path>
</agent>

<agent activation="lazy">
<name>devops-troubleshooter</name>
<description>Expert DevOps troubleshooter specializing in rapid incident response, advanced debugging, and modern observability. Masters log analysis, distributed tracing, Kubernetes debugging, performance optimization, and root cause analysis. Handles production outages, system reliability, and preventive monitoring. Use PROACTIVELY for debugging, incident response, or system troubleshooting.</description>
<path>.openagents/devops-troubleshooter/AGENT.md</path>
</agent>

<agent activation="lazy">
<name>business-analyst</name>
<description>Master modern business analysis with AI-powered analytics, real-time dashboards, and data-driven insights. Build comprehensive KPI frameworks, predictive models, and strategic recommendations. Use PROACTIVELY for business intelligence or strategic analysis.</description>
<path>.openagents/business-analyst/AGENT.md</path>
</agent>

<agent activation="lazy">
<name>architect-review</name>
<description>Master software architect specializing in modern architecture patterns, clean architecture, microservices, event-driven systems, and DDD. Reviews system designs and code changes for architectural integrity, scalability, and maintainability. Use PROACTIVELY for architectural decisions.</description>
<path>.openagents/architect-review/AGENT.md</path>
</agent>

<agent activation="lazy">
<name>code-reviewer</name>
<description>Elite code review expert specializing in modern AI-powered code analysis, security vulnerabilities, performance optimization, and production reliability. Masters static analysis tools, security scanning, and configuration review with 2024/2025 best practices. Use PROACTIVELY for code quality assurance.</description>
<path>.openagents/code-reviewer/AGENT.md</path>
</agent>

<agent activation="lazy">
<name>security-auditor</name>
<description>Expert security auditor specializing in DevSecOps, comprehensive cybersecurity, and compliance frameworks. Masters vulnerability assessment, threat modeling, secure authentication (OAuth2/OIDC), OWASP standards, cloud security, and security automation. Handles DevSecOps integration, compliance (GDPR/HIPAA/SOC2), and incident response. Use PROACTIVELY for security audits, DevSecOps, or compliance implementation.</description>
<path>.openagents/security-auditor/AGENT.md</path>
</agent>

<agent activation="lazy">
<name>context-manager</name>
<description>Elite AI context engineering specialist mastering dynamic context management, vector databases, knowledge graphs, and intelligent memory systems. Orchestrates context across multi-agent workflows, enterprise AI systems, and long-running projects with 2024/2025 best practices. Use PROACTIVELY for complex AI orchestration.</description>
<path>.openagents/context-manager/AGENT.md</path>
</agent>

<agent activation="lazy">
<name>ai-engineer</name>
<description>Build production-ready LLM applications, advanced RAG systems, and intelligent agents. Implements vector search, multimodal AI, agent orchestration, and enterprise AI integrations. Use PROACTIVELY for LLM features, chatbots, AI agents, or AI-powered applications.</description>
<path>.openagents/ai-engineer/AGENT.md</path>
</agent>

<agent activation="lazy">
<name>prompt-engineer</name>
<description>Expert prompt engineer specializing in advanced prompting techniques, LLM optimization, and AI system design. Masters chain-of-thought, constitutional AI, and production prompt strategies. Use when building AI features, improving agent performance, or crafting system prompts.</description>
<path>.openagents/prompt-engineer/AGENT.md</path>
</agent>

<agent activation="lazy">
<name>cloud-architect</name>
<description>Expert cloud architect specializing in AWS/Azure/GCP multi-cloud infrastructure design, advanced IaC (Terraform/OpenTofu/CDK), FinOps cost optimization, and modern architectural patterns. Masters serverless, microservices, security, compliance, and disaster recovery. Use PROACTIVELY for cloud architecture, cost optimization, migration planning, or multi-cloud strategies.</description>
<path>.openagents/cloud-architect/AGENT.md</path>
</agent>

<agent activation="lazy">
<name>hybrid-cloud-architect</name>
<description>Expert hybrid cloud architect specializing in complex multi-cloud solutions across AWS/Azure/GCP and private clouds (OpenStack/VMware). Masters hybrid connectivity, workload placement optimization, edge computing, and cross-cloud automation. Handles compliance, cost optimization, disaster recovery, and migration strategies. Use PROACTIVELY for hybrid architecture, multi-cloud strategy, or complex infrastructure integration.</description>
<path>.openagents/hybrid-cloud-architect/AGENT.md</path>
</agent>

<agent activation="lazy">
<name>network-engineer</name>
<description>Expert network engineer specializing in modern cloud networking, security architectures, and performance optimization. Masters multi-cloud connectivity, service mesh, zero-trust networking, SSL/TLS, global load balancing, and advanced troubleshooting. Handles CDN optimization, network automation, and compliance. Use PROACTIVELY for network design, connectivity issues, or performance optimization.</description>
<path>.openagents/network-engineer/AGENT.md</path>
</agent>

<agent activation="lazy">
<name>terraform-specialist</name>
<description>Expert Terraform/OpenTofu specialist mastering advanced IaC automation, state management, and enterprise infrastructure patterns. Handles complex module design, multi-cloud deployments, GitOps workflows, policy as code, and CI/CD integration. Covers migration strategies, security best practices, and modern IaC ecosystems. Use PROACTIVELY for advanced IaC, state management, or infrastructure automation.</description>
<path>.openagents/terraform-specialist/AGENT.md</path>
</agent>

<agent activation="lazy">
<name>kubernetes-architect</name>
<description>Expert Kubernetes architect specializing in cloud-native infrastructure, advanced GitOps workflows (ArgoCD/Flux), and enterprise container orchestration. Masters EKS/AKS/GKE, service mesh (Istio/Linkerd), progressive delivery, multi-tenancy, and platform engineering. Handles security, observability, cost optimization, and developer experience. Use PROACTIVELY for K8s architecture, GitOps implementation, or cloud-native platform design.</description>
<path>.openagents/kubernetes-architect/AGENT.md</path>
</agent>

<agent activation="lazy">
<name>backend-architect</name>
<description>Expert backend architect specializing in scalable API design, microservices architecture, and distributed systems. Masters REST/GraphQL/gRPC APIs, event-driven architectures, service mesh patterns, and modern backend frameworks. Handles service boundary definition, inter-service communication, resilience patterns, and observability. Use PROACTIVELY when creating new backend services or APIs.</description>
<path>.openagents/backend-architect/AGENT.md</path>
</agent>

<agent activation="lazy">
<name>data-engineer</name>
<description>Build scalable data pipelines, modern data warehouses, and real-time streaming architectures. Implements Apache Spark, dbt, Airflow, and cloud-native data platforms. Use PROACTIVELY for data pipeline design, analytics infrastructure, or modern data stack implementation.</description>
<path>.openagents/data-engineer/AGENT.md</path>
</agent>

<agent activation="lazy">
<name>performance-engineer</name>
<description>Expert performance engineer specializing in modern observability, application optimization, and scalable system performance. Masters OpenTelemetry, distributed tracing, load testing, multi-tier caching, Core Web Vitals, and performance monitoring. Handles end-to-end optimization, real user monitoring, and scalability patterns. Use PROACTIVELY for performance optimization, observability, or scalability challenges.</description>
<path>.openagents/performance-engineer/AGENT.md</path>
</agent>

<agent activation="lazy">
<name>python-pro</name>
<description>Master Python 3.12+ with modern features, async programming, performance optimization, and production-ready practices. Expert in the latest Python ecosystem including uv, ruff, pydantic, and FastAPI. Use PROACTIVELY for Python development, optimization, or advanced Python patterns.</description>
<path>.openagents/python-pro/AGENT.md</path>
</agent>

<agent activation="lazy">
<name>tech-debt</name>
<description>tech-debt command from camoneart/claude-code</description>
<path>.openagents/tech-debt/AGENT.md</path>
</agent>

<agent activation="lazy">
<name>data-scientist</name>
<description>Expert data scientist for advanced analytics, machine learning, and statistical modeling. Handles complex data analysis, predictive modeling, and business intelligence. Use PROACTIVELY for data analysis tasks, ML modeling, statistical analysis, and data-driven insights.</description>
<path>.openagents/data-scientist/AGENT.md</path>
</agent>

<agent activation="lazy">
<name>mlops-engineer</name>
<description>Build comprehensive ML pipelines, experiment tracking, and model registries with MLflow, Kubeflow, and modern MLOps tools. Implements automated training, deployment, and monitoring across cloud platforms. Use PROACTIVELY for ML infrastructure, experiment management, or pipeline automation.</description>
<path>.openagents/mlops-engineer/AGENT.md</path>
</agent>

<agent activation="lazy">
<name>ml-engineer</name>
<description>Build production ML systems with PyTorch 2.x, TensorFlow, and modern ML frameworks. Implements model serving, feature engineering, A/B testing, and monitoring. Use PROACTIVELY for ML model deployment, inference optimization, or production ML infrastructure.</description>
<path>.openagents/ml-engineer/AGENT.md</path>
</agent>

<agent activation="lazy">
<name>deployment-engineer</name>
<description>Expert deployment engineer specializing in modern CI/CD pipelines, GitOps workflows, and advanced deployment automation. Masters GitHub Actions, ArgoCD/Flux, progressive delivery, container security, and platform engineering. Handles zero-downtime deployments, security scanning, and developer experience optimization. Use PROACTIVELY for CI/CD design, GitOps implementation, or deployment automation.</description>
<path>.openagents/deployment-engineer/AGENT.md</path>
</agent>

</available_agents>
</agents_system>

<!-- PRPM_MANIFEST_END -->
