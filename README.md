# Pixelated Empathy

![Pixelated Empathy Logo](public/android-chrome-512x512.png)

[![License](https://img.shields.io/badge/License-Proprietary-red.svg?style=flat-square)](LICENSE)
[![Focus](https://img.shields.io/badge/Focus-Clinical%20AI-blue.svg?style=flat-square)](https://pixelatedempathy.com)
[![Status](https://img.shields.io/badge/Status-Early%20Access-green.svg?style=flat-square)](https://pixelatedempathy.com/contact)

> We believe every high-stakes conversation should have a safe place to improve.

Pixelated Empathy is a **clinical AI platform** for practicing, analyzing, and
improving emotionally complex conversations.

Our mission is to help organizations and practitioners build stronger, safer,
more empathic communication through applied AI—especially where outcomes affect
human wellbeing.

---

## 🚀 What this repository is

This repo is the core workspace for the Pixelated Empathy product direction:

- **AI services** (`ai/`): training, inference, and emotional intelligence models
- **Product application** (`src/`): Astro + React web and API surfaces
- **Operational tooling** (`scripts/`): pipelines, automation, and developer workflows
- **Research workflow interface** (`/journal-research`): dataset discovery and curation
- **Integration interfaces**: MCP and service connectors used by partner tools

If you are looking for blockchain or on-chain components, those run in separate
repositories and integrate with this core stack.

## 🎯 What problem we are solving

Most AI tooling can parse text; much less can interpret *why* a conversation
changes direction, escalates, calms down, or leaves someone unsupported.

Pixelated Empathy focuses on:

- Simulating and evaluating realistic therapeutic and support scenarios
- Making emotional dynamics visible without overloading teams with noise
- Turning difficult conversations into measurable coaching moments
- Supporting training, review, and iteration before real-world impact

## 🧠 Core principles

- **Human-centered first**: emotional context, timing, and relational cues matter as
  much as words.
- **Safe rehearsal**: teams can practice rare, high-impact interactions in a
  protected environment.
- **Interpretability over opacity**: outputs are designed to inform decisions, not
  replace professional judgment.
- **Modular design**: each layer can evolve independently while sharing a common
  conversation intelligence foundation.

## 📚 Journal Dataset Research Pipeline

Pixelated Empathy includes a dedicated pipeline for sourcing and evaluating
research datasets:

- **Web interface** for human-guided review in `/journal-research`
- **MCP server** for agent-based orchestration
- **CLI tools** for automation workflows
- **Backend research engine** for discovery, scoring, and integration planning

Detailed process documentation:
[Journal Dataset Research Pipeline Documentation](ai/sourcing/journal/docs/README.md)

## 🧱 Repository map

- `ai/` — ML models, inference, and core emotional analysis logic
- `src/` — frontend, API, and app integration code
- `public/` — assets and visual identity
- `scripts/` — operational utilities and repeatable task entry points

## 🔒 Trust and quality commitments

- Clear architectural boundaries between research, runtime, and product surface
- Emphasis on reliability and operational safety in high-stakes contexts
- Documentation-first approach for collaborators and reviewers
- Progressive accessibility and readability updates to keep the repo easy to
  understand for new contributors

## 🌐 Explore the mission

- [Company website](https://pixelatedempathy.com)
- [Request enterprise access](https://pixelatedempathy.com/contact)
- [View case studies](https://pixelatedempathy.com/case-studies)
- [Meet the team](https://pixelatedempathy.com/team)

## 📝 Notes for readers

This README is intentionally informational and strategic. It is written to answer:
"Who are we?", "What are we building?", and "Why does this work matter?" before
you look for implementation details.

---

Built with: Astro, React, Node.js, TypeScript, MongoDB, Redis, and modern test
and browser tooling.

© 2026 Pixelated Empathy. Engineered with purpose.
