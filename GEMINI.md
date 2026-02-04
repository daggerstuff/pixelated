# 🌌 Pixelated Empathy: GEMINI.md

> **AI Coding Assistant Instructions** - This document guides AI tools (GitHub Copilot, Cursor, Claude, Gemini, etc.) on how to work with this codebase effectively.
>
> 🎭 *"We don't just process conversations. We understand them."*

---

## Project Overview

**Description**: Pixelated Empathy is an enterprise-grade platform engineered to translate human emotion into actionable intelligence. Our cornerstone, **The Empathy Gym™**, provides mental health professionals with a high-fidelity, risk-free AI environment to master complex therapeutic dialogues.

**Tech Stack**:

- **Framework**: Astro (v5+) + React 19
- **Language**: TypeScript (strict mode)
- **Build Tool**: Astro/Vite
- **Styling**: CSS Modules + Vanilla CSS
- **State Management**: Zustand + Nanostores
- **Routing**: Astro file-based routing
- **Data Fetching**: TanStack Query
- **Forms**: React Hook Form
- **Validation**: Zod
- **Testing**: Vitest + React Testing Library + Playwright
- **Package Manager**: pnpm (Node.js) / uv (Python)
- **AI/ML**: Python with uv, FastAPI, NeMo Curator
- **Containerization**: Docker Compose (primary), Kubernetes (future)

---

## ⛔ ABSOLUTE PROHIBITION: No Stubs or Filler

**Every implementation MUST be complete and production-ready.**

- ❌ No `pass`, `...`, `TODO`, `NotImplementedError`, `# FIXME`
- ❌ No placeholder returns (`return True`, `return []`, hardcoded dummies)
- ❌ No mock implementations disguised as real code
- ✅ If it can't be fully implemented, it must not be committed

---

## ⛔ ABSOLUTE PROHIBITION: No Ignore Comments to Silence Warnings

**Warnings are signals, not noise. Fix the root cause, don't silence it.**

- ❌ No `// eslint-disable`, `// @ts-ignore`, `# noqa`, etc. to bypass warnings
- ❌ No `// prettier-ignore`, `type: ignore`, or similar suppression comments
- ✅ Refactor and fix code to resolve the underlying issue
- ✅ If a warning is truly a false positive, document *why* with a detailed explanation

## Quick Start

```bash
# Setup (CRITICAL: Never use npm/yarn for Node, never use pip/conda for Python)
pnpm install          # Node dependencies
uv install            # Python dependencies

# Development
pnpm dev              # Frontend dev server
pnpm dev:all-services # All services (Frontend, AI, Worker, WebSocket)

# Build
pnpm build            # Production build
pnpm docker:up        # Docker Compose deployment

# Testing
pnpm test             # Unit tests
pnpm test:all         # Full test suite
pnpm e2e              # End-to-end tests

# Quality
pnpm lint             # Run linter
pnpm check:all        # Lint + Typecheck + Format check
pnpm security:scan    # Deep security audit

# Python
uv run <script>       # Run Python scripts
```

---

## Project Structure

```text
pixelated/
├── ai/                     # 🧠 Emotional Intelligence Engine (submodule)
│   ├── academic_sourcing/  # Journal research pipeline
│   ├── training/           # Model training & fine-tuning
│   └── core/               # Core AI modules
├── src/                    # 🎨 Main Application (Astro + React)
│   ├── @types/             # Project-specific TypeScript definitions
│   ├── api/                # API routes/handlers
│   ├── components/         # Reusable UI components
│   ├── config/             # Configuration files
│   ├── content-store/      # CMS content (MDX, blog posts)
│   ├── hooks/              # Custom React hooks
│   ├── layouts/            # Layout components
│   ├── lib/                # Core libraries & utilities
│   │   ├── ai/             # AI services & bias detection
│   │   ├── memory/         # Conversation memory (Mem0)
│   │   └── services/       # Backend services
│   ├── pages/              # Astro pages & routes
│   ├── simulator/          # Empathy Gym training simulator
│   ├── styles/             # Global styles & tokens
│   ├── types/              # TypeScript type definitions
│   └── utils/              # Utility functions
├── .kiro/steering/         # 📚 Domain & style guidelines
├── .openskills/            # 🛠️ AI agent skills
├── .openagents/            # 🤖 Specialized AI agents
├── docs/                   # 📖 Architecture & research docs
├── docker/                 # 🐳 Docker configurations
├── scripts/                # 🔧 Build & utility scripts
├── tests/                  # 🧪 Test suites
└── config/                 # ⚙️ Tool configurations
```

**Key Directory Purposes**:

| Directory | Purpose |
| --------- | ------- |
| `ai/` | Emotional Intelligence Engine - NeMo training, data pipelines, model fine-tuning |
| `src/lib/ai/` | AI services integration, bias detection, conversation analysis |
| `src/simulator/` | The Empathy Gym™ - therapeutic dialogue training |
| `src/components/` | Reusable UI components |
| `src/pages/` | Astro pages and routes |
| `.kiro/steering/` | **Critical** - Domain guidelines for emotional AI, code style, security |
| `docs/` | Architecture docs, research findings, API documentation |
| `tests/` | Unit, integration, and E2E tests |

---

## Code Conventions

### General Guidelines

- **Language**: Use TypeScript for all frontend/backend files
- **Components**: Use functional components with hooks
- **File Naming**: PascalCase for components, camelCase for utilities
- **Formatting**: 2 spaces, no semicolons, single quotes, trailing commas

### Component Structure

```tsx
import { useState } from 'react'
import type { EmotionScore } from '@/types'

interface EmotionCardProps {
  emotion: EmotionScore
  onAnalyze?: (id: string) => void
}

export function EmotionCard({ emotion, onAnalyze }: EmotionCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  // Validate emotion score is in valid range (0-1)
  const normalizedIntensity = Math.max(0, Math.min(1, emotion.intensity))

  return (
    <div className="emotion-card">
      {/* Component content */}
    </div>
  )
}
```

### Import Organization

```tsx
// 1. External dependencies
import { useState, useCallback } from 'react'

// 2. Internal modules (use path aliases)
import { EmotionAnalyzer } from '@/lib/ai/emotion-analyzer'
import { useConversation } from '@/hooks/useConversation'

// 3. Types (always use `type` imports)
import type { EmotionScore, ConversationContext } from '@/types'

// 4. Styles (if applicable)
import styles from './Component.module.css'
```

---

## Styling Approach

**Primary Method**: CSS Modules + Vanilla CSS

- One CSS module per component
- Use camelCase for class names
- Design system tokens in `src/styles/`
- **No TailwindCSS** unless explicitly requested

---

## State Management

**Approach**: Zustand + Nanostores (for Astro islands)

- Create stores in `src/lib/stores/`
- Keep stores focused and minimal
- Use selectors for derived state

---

## Data Fetching

**Method**: TanStack Query

- All API calls organized in services layer (`src/services/`)
- Use proper error handling and loading states
- Leverage TanStack Query for caching and optimistic updates

---

## 🧠 Emotional Intelligence Domain

### Core Frameworks

- **Emotional Taxonomy**: Plutchik's Wheel (Basic & Advanced) + Big Five (OCEAN)
- **Score Representation**: Normalized 0.0 to 1.0 for all intensities
- **Conversational Dynamics**: Tone, flow, reciprocity, silence patterns

### Critical Validation Rules

```typescript
// ALWAYS validate emotion scores
const validateEmotionScore = (score: number): number => {
  if (score < 0 || score > 1) {
    throw new Error(`Emotion score must be 0-1, got: ${score}`)
  }
  return score
}

// ALWAYS handle crisis signals
const hasCrisisSignal = (text: string): boolean => {
  // Check for self-harm, crisis keywords, etc.
  // See: src/lib/ai/crisis-detection/
}
```

### Key Domain Files

- `.kiro/steering/domain-emotional-ai.md` - Emotional AI guidelines
- `.kiro/steering/security-ethics.md` - Security & ethics deep-dive
- `docs/guides/EMPATHY_RESPONSE_STYLE.md` - Response style guide

---

## Testing

**Framework**: Vitest + React Testing Library + Playwright

### Conventions

- Test file location: Co-located with components (`Component.test.tsx`)
- Focus on user behavior and integration tests
- Run `pnpm test:all` before committing

### Test Commands

```bash
pnpm test              # Unit tests (Vitest)
pnpm test:unit         # Unit tests with coverage
pnpm test:integration  # Integration tests
pnpm test:security     # Security-specific tests
pnpm test:hipaa        # HIPAA compliance tests
pnpm e2e               # End-to-end tests (Playwright)
pnpm e2e:ui            # Playwright UI mode
```

---

## Environment Variables

**Location**: `.env.local` (never commit - use `.env.example` as template)

Key variables:

```bash
# Core
NODE_ENV=development
PORT=4321

# Database
MONGODB_URI=mongodb+srv://...
DATABASE_URL=postgresql://...
REDIS_URL=redis://localhost:6379/0

# AI Services
MEM0_API_KEY=your-mem0-api-key
MEM0_ENABLED=true

# Security
JWT_SECRET=your-jwt-secret
ENCRYPTION_KEY=your-encryption-key-32-chars

# Features
FEATURE_AI_INSIGHTS=true
FEATURE_CRISIS_DETECTION=true
```

**Note**: Never commit `.env.local` - use `.env.example` as template

---

## Available Scripts

### Development

- `pnpm dev` - Start Astro dev server
- `pnpm dev:all-services` - Start all services (Frontend, AI, Worker, WebSocket, Academic Sourcing)
- `pnpm dev:bias-detection` - Start bias detection service
- `pnpm dev:ai-service` - Start AI service
- `pnpm dev:websocket` - Start WebSocket server
- `pnpm dev:academic-sourcing` - Start academic journal sourcing API

### Build & Deploy

- `pnpm build` - Production build
- `pnpm build:cloudflare` - Build for Cloudflare Workers
- `pnpm docker:up` - Deploy with Docker Compose
- `pnpm docker:down` - Stop Docker services
- `pnpm deploy` - Deploy to staging
- `pnpm deploy:prod` - Deploy to production

### Testing Scripts

- `pnpm test` - Run unit tests
- `pnpm test:all` - Run complete test suite
- `pnpm test:coverage` - Tests with coverage
- `pnpm e2e` - End-to-end tests
- `pnpm test:security` - Security tests
- `pnpm test:hipaa` - HIPAA compliance tests

### Quality & Security

- `pnpm lint` - Run linter
- `pnpm lint:fix` - Fix linting issues
- `pnpm typecheck` - TypeScript type checking
- `pnpm check:all` - Lint + Typecheck + Format
- `pnpm security:scan` - Deep security audit
- `pnpm security:check` - Check for credentials

### AI & Data

- `pnpm test:evals` - Run AI evaluation tests
- `pnpm merge-datasets` - Merge training datasets
- `pnpm prepare-openai` - Prepare data for OpenAI fine-tuning
- `pnpm prepare-huggingface` - Prepare data for HuggingFace

### Python (uv)

- `uv run <script>` - Run Python scripts
- `uv run pytest` - Run Python tests
- `uv run uvicorn ai.academic_sourcing.api.main:app --reload` - Start FastAPI

---

## Path Aliases

Configured in `tsconfig.json`:

| Alias | Path |
| ----- | ---- |
| `@/*` | `./src/*` |
| `~/*` | `./src/*` |
| `@lib/*` | `./src/lib/*` |
| `@components/*` | `./src/components/*` |
| `@layouts/*` | `./src/layouts/*` |
| `@utils/*` | `./src/utils/*` |
| `@types/*` | `./src/types/*` |

---

## 🔒 Security & Ethics Requirements

### Zero-Leak Policy

1. **Never expose** API keys, tokens, PII, or mental health data
2. **Always validate** inputs (especially emotion scores 0-1 range)
3. **Run checks frequently**: `pnpm security:check` and `pnpm security:scan`

### Psychological Safety

1. Handle crisis signals defensively - never ignore potential harm indicators
2. No toxic positivity - validate emotions authentically
3. Consider cultural and linguistic variations
4. Respect HIPAA-level confidentiality standards

### Pre-Commit Checklist

- [ ] No hardcoded secrets or PII
- [ ] Emotion scores validated (0-1 range)
- [ ] Crisis detection patterns tested
- [ ] Security checks pass

---

## AI Assistant Guidelines

### When Generating Code

1. **Follow existing patterns**: Match the style in the codebase
2. **Use strict type safety**: Always use TypeScript types, avoid `any`
3. **Use path aliases**: Import using `@/`, `@lib/`, etc.
4. **Match styling approach**: Use CSS Modules
5. **Validate emotional data**: Always normalize scores to 0-1 range
6. **Handle edge cases**: Crisis signals, silence, cultural variations

### When Working with Emotional AI

1. **Read domain guidelines first**: Check `.kiro/steering/domain-emotional-ai.md`
2. **Use established frameworks**: Plutchik's Wheel, Big Five (OCEAN)
3. **Normalize all scores**: 0.0 to 1.0 range, always
4. **Handle crisis signals**: Check `src/lib/ai/crisis-detection/`
5. **Validate psychological constructs**: Use established research

### When Refactoring

1. Preserve functionality
2. Maintain type safety
3. Update related tests
4. Follow established conventions
5. Run `pnpm check:all` before committing

### Critical Rules

```text
❌ NEVER use npm or yarn (use pnpm)
❌ NEVER use pip, conda, or venv (use uv)
❌ NEVER commit .env files or secrets
❌ NEVER ignore potential crisis signals
❌ NEVER use emotion scores outside 0-1 range
❌ NEVER bypass security validation

✅ ALWAYS validate emotional data
✅ ALWAYS handle edge cases (silence, crisis)
✅ ALWAYS use path aliases (@/, @lib/, etc.)
✅ ALWAYS run tests before committing
✅ ALWAYS check for security issues
```

---

## Skills System

Skills extend AI capabilities for specialized tasks. Load a skill using:

```bash
cat <path>
```

### Available Skills

| Skill | Description | Path |
| ----- | ----------- | ---- |
| `skill-using-superpowers` | Mandatory workflows for finding and using skills | `.openskills/skill-using-superpowers/SKILL.md` |
| `skill-brainstorming` | Refine ideas through structured Socratic questioning | `.openskills/skill-brainstorming/SKILL.md` |
| `skill-writing-plans` | Create implementation plans with exact file paths | `.openskills/skill-writing-plans/SKILL.md` |
| `skill-executing-plans` | Execute plans in controlled batches with review | `.openskills/skill-executing-plans/SKILL.md` |
| `skill-test-driven-development` | Write tests first, watch fail, write minimal code | `.openskills/skill-test-driven-development/SKILL.md` |
| `skill-systematic-debugging` | Four-phase debugging framework | `.openskills/skill-systematic-debugging/SKILL.md` |
| `skill-requesting-code-review` | Dispatch code-reviewer subagent | `.openskills/skill-requesting-code-review/SKILL.md` |
| `skill-receiving-code-review` | Technical rigor for code review feedback | `.openskills/skill-receiving-code-review/SKILL.md` |
| `skill-verification-before-completion` | Run verification before claiming success | `.openskills/skill-verification-before-completion/SKILL.md` |
| `skill-using-git-worktrees` | Create isolated git worktrees | `.openskills/skill-using-git-worktrees/SKILL.md` |
| `skill-dispatching-parallel-agents` | Dispatch multiple agents for independent problems | `.openskills/skill-dispatching-parallel-agents/SKILL.md` |
| `skill-root-cause-tracing` | Trace bugs backward through call stack | `.openskills/skill-root-cause-tracing/SKILL.md` |
| `skill-defense-in-depth` | Validate at every layer | `.openskills/skill-defense-in-depth/SKILL.md` |
| `skill-testing-anti-patterns` | Prevent testing mock behavior | `.openskills/skill-testing-anti-patterns/SKILL.md` |
| `skill-writing-skills` | Create new skills with TDD | `.openskills/skill-writing-skills/SKILL.md` |
| `skill-finishing-a-development-branch` | Complete development work with merge options | `.openskills/skill-finishing-a-development-branch/SKILL.md` |

---

## Agents System

Agents are specialized AI assistants that run in independent contexts for complex tasks.

### Available Agents

| Agent | Description | Path |
| ----- | ----------- | ---- |
| `backend-architect` | Scalable API design, microservices, distributed systems | `.openagents/backend-architect/AGENT.md` |
| `database-architect` | Data layer design, technology selection, schema modeling | `.openagents/database-architect/AGENT.md` |
| `database-optimizer` | Performance tuning, query optimization, caching | `.openagents/database-optimizer/AGENT.md` |
| `terraform-specialist` | IaC automation, state management, enterprise infrastructure | `.openagents/terraform-specialist/AGENT.md` |
| `cloud-architect` | AWS/Azure/GCP multi-cloud infrastructure | `.openagents/cloud-architect/AGENT.md` |
| `django-pro` | Django 5.x, async views, DRF, Celery, Channels | `.openagents/django-pro/AGENT.md` |
| `fastapi-pro` | FastAPI, SQLAlchemy 2.0, Pydantic V2, async patterns | `.openagents/fastapi-pro/AGENT.md` |

---

## Key Documentation

### Core Guides

- `.kiro/steering/code-style.md` - Detailed code style guide
- `.kiro/steering/security-ethics.md` - Security & ethics deep-dive
- `.kiro/steering/clean-code-principles.md` - Clean code patterns
- `.kiro/steering/testing-strategy.md` - Testing best practices

### Domain-Specific

- `.kiro/steering/domain-emotional-ai.md` - Emotional AI guidelines
- `docs/guides/EMPATHY_RESPONSE_STYLE.md` - Response style guide

### Architecture

- `docs/` - Architecture and research documentation
- `GEMINI.md` - Project identity and mission
- `README.md` - Project overview

---

---

## Interaction Protocol (Hooks)

- **Thread Start**: Check `supermemory` (project: `pixelated`) and `.ralph/progress.txt` for context on the current/upcoming task.
- **Thread End**: Log the completed task/milestone in `supermemory` (project: `pixelated`) and update `.ralph/progress.txt`.

---

## 🎯 Mission Reminder

> **We don't just process conversations. We understand them.**

This platform handles sensitive mental health data. Every decision should prioritize:

- 🛡️ **Psychological Safety** - Handle crisis signals, no toxic positivity
- 🔐 **Privacy & Confidentiality** - HIPAA-level standards
- 🧠 **Ethical AI Practices** - Validated psychological constructs
- 💜 **Genuine Human Connection** - Beyond algorithms, we build empathy

---

**Last Generated**: 2026-02-03
**Auto-generated from**: package.json, tsconfig.json, and project structure

> 💡 **Tip**: Always read `.kiro/steering/domain-emotional-ai.md` before working on AI-related features.

---

© 2026 Pixelated Empathy • Engineered with Purpose
