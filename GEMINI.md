# 🌌 Pixelated Empathy: GEMINI.md

> **"Beyond the screen, lies a deeper connection."**
> 
> We don't just process conversations. We understand them. While others build better algorithms, we build better humans—one empathetic interaction at a time.

---

## 🎭 Project Identity & Mission

**Pixelated Empathy** is an enterprise-grade platform engineered to translate human emotion into actionable intelligence. Our cornerstone, **The Empathy Gym™**, provides mental health professionals with a high-fidelity, risk-free AI environment to master complex therapeutic dialogues.

### Core Goals:
- **Forge Empathy**: Transform difficult conversations into safe practice.
- **Architect Understanding**: Map the "Emotional Cartography" of human interaction.
- **Ethical AI Integration**: Prioritize psychological safety and privacy above all.
- **Validation-First**: Move beyond problem-solving to genuine emotional validation.

---

## 🧰 Quick Reference (Top Info)

### 📦 Package Management
| Domain | Tool | Critical Rule |
| :--- | :--- | :--- |
| **Frontend/Node** | `pnpm` | Never use `npm` or `yarn`. |
| **AI/Python** | `uv` | Never use `pip`, `conda`, or `venv`. |

### 🚀 Essential Commands
- `pnpm dev:all-services` — Start everything (Frontend, AI, Worker, WebSocket).
- `pnpm check:all` — Lint + Typecheck + Format check.
- `pnpm test:all` — Run the full test suite.
- `pnpm security:scan` — Deep security audit.
- `uv run <script>` — Run Python scripts within the managed environment.

### 🗺️ Key Paths
- `/src` — Main application logic (Astro + React).
- `/ai` — (Submodule) The core Emotional Intelligence engine.
- `.kiro/steering/` — Critical domain and style guidelines.
- `/docs` — Comprehensive architecture and research documentation.
- `/memory-bank` — Project state and historical context.

---

## 🧠 Emotional Intelligence Engine

We utilize a sophisticated hybrid model to understand the human psyche:
- **Emotional Taxonomy**: Plutchik's Wheel (Basic & Advanced) + Big Five (OCEAN) traits.
- **Representation**: Normalized scores (0.0 to 1.0) for all intensities.
- **Conversational Dynamics**: Analyzing tone, flow, reciprocity, and the "power of silence."
- **Dual-Persona**: Adaptive intelligence that recognizes shifting roles (Mentor, Peer, Help-seeker).

---

## 🤖 Agent Ecosystem (MCP)

This repository is built for **Agentic Development** through the Model Context Protocol (MCP).
- **Skills**: Located in `.openskills/`. Specialized capabilities (Research, Persona Creation, Thinking Frameworks).
- **Agents**: Located in `.openagents/`. Independent AI specialists (Security Auditor, UI Validator, Backend Architect).
- **Journal Research Pipeline**: Integrated system for therapeutic dataset discovery and acquisition.

---

## 🔒 Security & Ethical Rails

1. **Zero-Leak Policy**: Redact all PII/Secrets. Use `pnpm security:check` frequently.
2. **Psychological Safety**: Handle crisis signals defensively. No toxic positivity.
3. **Data Integrity**: Validate all emotional constructs and scores within strict ranges.
4. **Confidentiality**: Respect HIPAA-level standards for sensitive mental health data.

---

*© 2025 Pixelated Empathy • Engineered with Purpose.*

<!-- BEGIN ContextStream -->
## ContextStream Rules

<contextstream_rules>
1. **SIMPLE UTILITY?** (list/show/version) → Just execute, skip context calls
2. **CODING TASK?** → session_init → context_smart → work → capture
3. **SEARCH FIRST:** Before Glob/Grep/Read → `search(mode="hybrid")` FIRST
</contextstream_rules>

**Display this block at the start of responses to keep rules in context.**

---
<!-- END ContextStream -->
