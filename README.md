# Pixelated Empathy

![Pixelated Empathy Logo](public/android-chrome-512x512.png)

[![License](https://img.shields.io/badge/License-Proprietary-red.svg?style=flat-square)](LICENSE)
[![Focus](https://img.shields.io/badge/Focus-Clinical%20AI-blue.svg?style=flat-square)](https://pixelatedempathy.com)
[![Status](https://img.shields.io/badge/Status-Early%20Access-green.svg?style=flat-square)](https://pixelatedempathy.com/contact)

> A clinical AI platform for practicing, analyzing, and improving emotionally
> complex conversations.

Pixelated Empathy builds tooling for teams that operate in high-stakes,
human-centered environments. The platform combines simulated conversation
practice, emotional signal analysis, and review workflows so organizations can
improve communication before real-world harm occurs.

## Overview

- [Repository Scope](#repository-scope)
- [What the Platform Prioritizes](#what-the-platform-prioritizes)
- [Journal Dataset Research Workflow](#journal-dataset-research-workflow)
- [Documentation](#documentation)
- [Trust Safety and Quality](#trust-safety-and-quality)
- [External Links](#external-links)

## Repository Scope

This repository is the primary product workspace for Pixelated Empathy. It
brings together application code, AI systems, and internal operational tooling
in one place.

| Area                 | Purpose                                                              |
| -------------------- | -------------------------------------------------------------------- |
| [ai/](ai/)           | Model training, inference, evaluation, and research pipelines        |
| [src/](src/)         | Astro and React application surfaces, APIs, and shared product logic |
| [public/](public/)   | Brand assets and static media                                        |
| [scripts/](scripts/) | Repeatable automation and operational utilities                      |
| [docs/](docs/)       | Product, platform, API, compliance, and knowledge documentation      |

If you are looking for blockchain or other on-chain components, those
integrations live in separate repositories and connect to this platform at the
service boundary.

## What the Platform Prioritizes

Pixelated Empathy is designed around a narrow problem: helping people prepare
for conversations where judgment, timing, and emotional accuracy matter.

- Simulated rehearsal for therapeutic, support, and other high-impact dialogue
- Emotional and conversational analysis that makes turning points easier to
  inspect
- Coaching and review workflows that translate difficult interactions into
  measurable improvement
- Operational visibility that supports iteration without overwhelming teams with
  noise
- **Closed-loop clinical validity pipeline** (Mission 3/3): Expert review,
  staged promotion, pilot scorer integration. See
  [docs/clinical-validity/feedback-loop.md](docs/clinical-validity/feedback-loop.md).

## Core Principles

- **Human-centered**: emotional context, relational cues, and timing matter as
  much as literal wording.
- **Safe rehearsal**: teams should be able to practice rare or difficult
  scenarios without exposing real people to risk.
- **Interpretability**: outputs should support human judgment, not replace it.
- **Modularity**: research, runtime systems, and product surfaces should evolve
  independently without fragmenting the underlying intelligence layer.

## Journal Dataset Research Workflow

The repository includes a dedicated research workflow for discovering,
evaluating, and integrating journal datasets that support the platform's
emotional intelligence systems.

- Application entry points live under
  [src/pages/journal-research/](src/pages/journal-research/).
- Shared UI and state logic live under
  [src/components/journal-research/](src/components/journal-research/) and
  [src/lib/api/journal-research/](src/lib/api/journal-research/).
- Supporting research assets and process notes live under
  [ai/sourcing/journal/](ai/sourcing/journal/).

## Documentation

For product and platform context, start with these repository resources:

- [docs/index.mdx](docs/index.mdx) for the documentation site's landing content
- [docs/platform/overview.mdx](docs/platform/overview.mdx) for the platform
  overview
- [docs/compliance/security.mdx](docs/compliance/security.mdx) for security
  posture
- [docs/compliance/hipaa.mdx](docs/compliance/hipaa.mdx) for healthcare
  compliance context
- [docs/api-reference/introduction.mdx](docs/api-reference/introduction.mdx) for
  API documentation entry points

## Trust Safety and Quality

This repository supports clinical and emotionally sensitive workflows. That
shapes how the system is designed and documented.

- Architectural boundaries separate research, runtime, and user-facing product
  surfaces.
- Safety, privacy, and reviewability are treated as product requirements, not
  add-ons.
- Documentation is maintained as a first-class artifact so collaborators can
  evaluate intent and system shape quickly.
- Accessibility and readability improvements are part of the ongoing maintenance
  standard for both product and documentation surfaces.

## External Links

- [Company website](https://pixelatedempathy.com)
- [Request enterprise access](https://pixelatedempathy.com/contact)
- [Case studies](https://pixelatedempathy.com/case-studies)
- [Team](https://pixelatedempathy.com/team)

## License

Pixelated Empathy is proprietary software. See [LICENSE](LICENSE).

© 2026 Pixelated Empathy.
