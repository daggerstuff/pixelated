# AGENTS.md

> **AI Agent Instructions** — Working with the Pixelated Empathy codebase.
>
> 🎭 _"We don't just process conversations. We understand them."_

---

## Getting Started

```bash
# Environment
uv sync                          # Install Python deps
pnpm install                     # Install frontend deps

# Development
# (see pyproject.toml for Python tools, package.json for Node tools)
```

---

## Project Overview

**Pixelated Empathy** — AI-powered bias detection and mental health platform. Analyzes conversational dynamics, emotional patterns, and therapeutic interactions to provide actionable intelligence.

**Tech Stack**: Python 3.11+ · Flask · MongoDB · Redis · PyTorch · Transformers · spaCy · scikit-learn · Astro · React

---

## Key Directories

| Path | Purpose |
|---|---|
| `src/` | Backend source (Flask app, routes, models, services) |
| `ai/` | ML/AI: models, training, datasets, inference |
| `tests/` | Test suite |
| `site/` | Frontend (Astro/React) |
| `scripts/` | Utility scripts |
| `docs/` | Documentation |
| `k8s/` | Kubernetes manifests |
| `data/` | Data files, datasets |

---

## Python Conventions

| Aspect | Standard |
|---|---|
| **Python** | >=3.11, <3.14 |
| **Build** | setuptools |
| **Lint** | ruff (line-length: 100) + flake8 + black |
| **Type** | mypy + pyright |
| **Test** | pytest |
| **Format** | black + isort |

---

## Important Notes

- `.env` contains secrets — never commit
- Working tree must stay clean between tool invocations
- See `docs/` for architecture, design, and planning docs
