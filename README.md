<div align="center">
  <img src="public/android-chrome-512x512.png" alt="Pixelated Empathy Logo" width="140" />

  <br />

  # Pixelated Empathy

  **Pioneering the digital frontier of mental health.**

  <br />

  <p align="center">
    <a href="https://pixelatedempathy.com"><img src="https://img.shields.io/badge/Focus-Clinical%20AI-2E3440?style=for-the-badge" alt="Focus"></a>
    <a href="https://pixelatedempathy.com/contact"><img src="https://img.shields.io/badge/Status-Early%20Access-A3BE8C?style=for-the-badge" alt="Status"></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/License-Proprietary-BF616A?style=for-the-badge" alt="License"></a>
  </p>
</div>

<br />

## The Vision

Pixelated Empathy is fundamentally reshaping the mental health landscape. Historically, the clinical world
has pushed back against integrating deeply with the digital realm—often out of valid concerns for safety,
empathy, and privacy.

We are here to bridge that gap in a highly positive and beneficial way. By merging clinical rigor with
advanced, carefully aligned AI, we create environments where high-stakes, human-centered teams can
practice, analyze, and evolve their emotional intelligence before stepping into real-world scenarios.

Our goal moving forward is to scale deep, genuine empathy through digital platforms without losing the
profoundly human essence of care. We believe that by thoughtfully bringing therapeutic principles into
the digital realm, we can unlock new paradigms for training, healing, and connection.

---

## Quick Start

### Prerequisites

| Requirement | Version | Check |
|---|---|---|
| Node.js | >= 24 | `node --version` |
| pnpm | 11.24.0 | `pnpm --version` |
| Python | 3.12+ | `python3 --version` |
| uv | latest | `uv --version` |
| PostgreSQL | 17+ | `psql --version` |
| Redis | 7+ | `redis-cli --version` |
| Docker | latest | `docker --version` |

### Setup

```bash
# 1. Clone with submodules (or init them after cloning)
git clone --recursive https://github.com/daggerstuff/pixelated.git
cd pixelated

# If already cloned without --recursive:
git submodule update --init --recursive

# 2. Install dependencies
pnpm install

# 3. Start the dev server
pnpm dev
```

The app runs at **http://localhost:5173**.

> **Submodule Note:** This repo uses three git submodules (`ai/`, `foresight/`, `docs/`).
> After any clone or pull, run `git submodule update --init --recursive` to sync them.
> Without this step, those directories will be empty — including all 1,969 docs files.

### All Services

To run the full stack (web + AI services + bias detection + analytics + worker):

```bash
pnpm dev:all-services
```

See [WALKTHROUGH.md](WALKTHROUGH.md) for the complete developer guide.

---

## The Ecosystem

This platform operates as a cohesive unit across four primary repositories. Together, they form the
secure, intelligent backbone of our clinical AI engine:

| Repository | Role |
|---|---|
| **[pixelated](https://github.com/daggerstuff/pixelated)** (Main Core) | Primary orchestrator: application surfaces, clinical dashboards, API routes, shared product logic. |
| **[ai](ai/)** (Cognitive Engine) | Model research and training: inference, emotional signal analysis, clinical validity pipelines. |
| **[foresight](foresight/)** (Continuity & Memory) | Persistent contextual memory for AI agents across longitudinal therapeutic simulations. |
| **[docs](docs/)** (Knowledge Base) | HIPAA compliance, security posture, clinical feedback loops, architecture decisions. |

`ai/`, `foresight/`, and `docs/` are **git submodules** — run `git submodule update --init --recursive`
after cloning to populate them.

---

## Project Structure

```
pixelated/
├── apps/
│   ├── web/                    # Main Astro 6 + React 19 application
│   └── business-strategy-cms/  # Business strategy CMS
├── ai/                         # Submodule: AI inference & training (Python)
├── foresight/                  # Submodule: Foresight MCP memory server (Python)
├── docs/                       # Submodule: Documentation knowledge base
├── agents/                     # AI agent packages (advisor, content, eve, intake, pipeline)
├── packages/                   # Shared workspace packages
├── config/                     # Vitest, Playwright, and other configs
├── content/                    # Astro content collections
├── data/                       # Seed data and fixtures
├── infra/                      # Infrastructure (Docker, K8s)
├── scripts/                    # DevOps and utility scripts
└── tests/                      # Integration and E2E tests
```

---

## Development

### Common Commands

```bash
pnpm dev                  # Start dev server (port 5173)
pnpm dev:all-services     # Start all services concurrently
pnpm build                # Production build
pnpm lint                 # Lint (oxlint, type-aware)
pnpm format               # Format code (oxfmt + prettier)
pnpm test:unit            # Unit tests (Vitest)
pnpm test:integration     # Integration tests
pnpm e2e                  # End-to-end tests (Playwright)
pnpm e2e:ui               # Interactive E2E
```

### Python (ai/ and foresight/ submodules)

```bash
uv run pytest             # Run Python tests
uv run ruff check .       # Lint Python
uv run ruff format .      # Format Python
```

### Submodule Management

```bash
git submodule update --init --recursive   # Init after fresh clone
pnpm submodules:sync                      # Re-sync after pull
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend / SSR | Astro 6 + React 19 (TypeScript, Tailwind CSS) |
| Backend / AI | FastAPI / Express / Flask (Python 3.12+ via `uv`) |
| Database | PostgreSQL 17 + pgvector |
| Caching | Redis |
| State | Zustand |
| Package Manager | pnpm 11.24.0 |
| Runtime | Node.js >= 24 |

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for branch naming, commit conventions, testing, and security rules.
See [WALKTHROUGH.md](WALKTHROUGH.md) for the full developer walkthrough.

### Key Rules

- **No error suppression**: Never use `@ts-ignore`, `@ts-nocheck`, `# noqa`, or `# type: ignore`
- **No credentials in code**: Never commit API keys, passwords, or patient data
- **Lint before push**: Run `pnpm lint` and `pnpm format:check` before pushing
- **AI assistants**: See `AGENTS.md` for AI coding assistant conventions

---

## Documentation

The `docs/` submodule contains 1,969 files across 27 subdirectories. See [`DOCS.md`](DOCS.md) for a full index of all subdirectories, or browse the key areas below:

- **[Getting Started](docs/getting-started/)** — Onboarding guides
- **[Architecture](docs/architecture/)** — System design and ADRs
- **[API Reference](docs/api-reference/)** — API documentation
- **[Compliance](docs/compliance/)** — HIPAA, security, threat models
- **[Clinical Validity](docs/clinical-validity/)** — Clinical evaluation protocols
- **[Database](docs/database/)** — Schema and migration docs
- **[Operations](docs/operations/)** — Runbooks and deployment guides
- **[Guides](docs/guides/)** — Developer tutorials

> Run `git submodule update --init --recursive` first if `docs/` is empty.

---

## Security

Report vulnerabilities to [security@pixelatedempathy.com](mailto:security@pixelatedempathy.com).

See [docs/SECURITY.md](docs/SECURITY.md) and [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md) for details.

---

<br />

<div align="center">
  <b>Pixelated Empathy is proprietary software.</b><br><br>
  <a href="https://pixelatedempathy.com">Website</a> •
  <a href="https://pixelatedempathy.com/contact">Enterprise Access</a> •
  <a href="https://pixelatedempathy.com/case-studies">Case Studies</a> •
  <a href="https://pixelatedempathy.com/team">Our Team</a>

  <br><br>
  <code>© 2026 Pixelated Empathy. All rights reserved.</code>
</div>
