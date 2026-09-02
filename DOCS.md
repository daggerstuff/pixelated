# Documentation Index

> The `docs/` directory is a **git submodule**. If it appears empty after cloning, run:
> ```bash
> git submodule update --init --recursive
> ```

This index maps all 27 subdirectories inside `docs/` so you can find what you need without browsing blindly.

---

## Getting Started

| Directory | Contents |
| :--- | :--- |
| [`docs/getting-started/`](docs/getting-started/) | Onboarding guides, first-run checklists, environment setup |
| [`docs/quickstart.mdx`](docs/quickstart.mdx) | Fuma Docs quickstart page |
| [`docs/index.mdx`](docs/index.mdx) | Fuma Docs landing page |

## Architecture & Design

| Directory | Contents |
| :--- | :--- |
| [`docs/architecture/`](docs/architecture/) | System design documents, component diagrams, data flow |
| [`docs/adr/`](docs/adr/) | Architecture Decision Records (ADRs) |
| [`docs/concepts/`](docs/concepts/) | Core domain concepts and mental models |
| [`docs/platform/`](docs/platform/) | Platform-level design and infrastructure docs |
| [`docs/rfc/`](docs/rfc/) | Request for Comments — proposed changes and specifications |

## API & Reference

| Directory | Contents |
| :--- | :--- |
| [`docs/api/`](docs/api/) | API design docs and OpenAPI specs |
| [`docs/api-reference/`](docs/api-reference/) | Auto-generated API reference |
| [`docs/reference/`](docs/reference/) | General reference material and cheat sheets |

## Development

| Directory | Contents |
| :--- | :--- |
| [`docs/developers/`](docs/developers/) | Developer guides, coding standards, contribution workflows |
| [`docs/guides/`](docs/guides/) | Step-by-step tutorials for common tasks |
| [`docs/database/`](docs/database/) | Schema docs, migration guides, ER diagrams |

## Compliance & Security

| Directory | Contents |
| :--- | :--- |
| [`docs/compliance/`](docs/compliance/) | HIPAA, GDPR, regulatory compliance frameworks |
| [`docs/clinical-validity/`](docs/clinical-validity/) | Clinical evaluation protocols and validation studies |
| [`docs/SECURITY.md`](docs/SECURITY.md) | Security policies and incident response |
| [`docs/THREAT_MODEL.md`](docs/THREAT_MODEL.md) | Threat model and attack surface analysis |

## Operations

| Directory | Contents |
| :--- | :--- |
| [`docs/operations/`](docs/operations/) | Runbooks, deployment procedures, SRE guides |
| [`docs/runbooks/`](docs/runbooks/) | Incident response and operational runbooks |
| [`docs/plans/`](docs/plans/) | Roadmaps, sprint plans, and project tracking |

## Knowledge & Memory

| Directory | Contents |
| :--- | :--- |
| [`docs/knowledge/`](docs/knowledge/) | Knowledge base articles and domain expertise |
| [`docs/memory/`](docs/memory/) | Memory system architecture and Foresight MCP docs |
| [`docs/product/`](docs/product/) | Product specs, PRDs, and feature requirements |

## Enterprise & Tooling

| Directory | Contents |
| :--- | :--- |
| [`docs/enterprise/`](docs/enterprise/) | Enterprise deployment and integration guides |
| [`docs/linear-audit/`](docs/linear-audit/) | Linear workspace audit ETL pipeline (data quality) |
| [`docs/superpowers/`](docs/superpowers/) | Advanced usage patterns and power-user features |

## Additional

| Directory | Contents |
| :--- | :--- |
| [`docs/products/`](docs/products/) | Product catalog and comparison docs |
| [`docs/images/`](docs/images/) | Image assets used in documentation |
| [`docs/logo/`](docs/logo/) | Logo files and brand assets |
| [`docs/tests/`](docs/tests/) | Documentation test fixtures and snapshots |

---

## Fuma Docs

The `docs/` submodule uses [Fuma Docs](https://fumadocs.vercel.app/) for its documentation portal. The configuration lives in [`docs/docs.json`](docs/docs.json). To serve locally:

```bash
cd docs
uv pip install -e ".[dev]"
# Follow Fuma Docs CLI instructions in docs/docs.json
```

---

## Key Files

| File | Purpose |
| :--- | :--- |
| [`docs/README.md`](docs/README.md) | Docs submodule README (Linear audit pipeline focus) |
| [`docs/TRUTH.md`](docs/TRUTH.md) | Source-of-truth principles and data integrity rules |
| [`docs/LICENSE`](docs/LICENSE) | Documentation license (MIT) |

---

<br />

<code>© 2026 Pixelated Empathy. All rights reserved.</code>
