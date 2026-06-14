# Delta Analysis Framework
# Archived Planning Doc Review — Pixelated Empathy

## Purpose
Extract still-valid technical signal from deprecated planning documents before
they are fully superseded by Linear. Run this prompt once per archived file.

---

## System Context (inject once per session)

You are performing a **delta analysis** for Pixelated Empathy, a clinical AI
platform (Astro 6 + React 19 frontend, Express/FastAPI/Flask backends, MongoDB,
Redis, PostgreSQL). Work is now tracked in **Linear**. All planning docs have
been archived because they were scattered and may be stale.

**Current architecture anchors (do not treat as missing):**
- SSR via Astro 6 with React 19 islands
- MCP server layer (Foresight MCP) for agent continuity
- Multi-tenant SQLite context blocks
- Emotional intelligence / conversation analysis AI pipeline
- Training corpus pipeline (journal research, dataset sourcing)
- Vitest for unit/integration tests; Playwright for E2E
- pnpm + uv monorepo tooling

---

## Per-File Prompt (paste below each archived file's content)

```
ARCHIVED FILE: <filename>
ARCHIVED DATE: <date or "unknown">

<paste full file content here>
```

**Instructions:**

Perform a strict delta analysis. Apply these filters before extracting anything:

IGNORE:
- File paths, directory structures, or import paths that no longer exist
- Deprecated config references (old env vars, removed services, old package names)
- Historical status updates ("Phase 1 complete", "Done on 2025-xx-xx")
- Anything already shipped and visible in the current codebase
- Team/personnel assignments, meeting notes, or process commentary
- Redundant items already captured in a sibling archived file this session

EXTRACT only items that are:
1. An architectural upgrade, integration, or refactor that was designed but never shipped
2. A feature enhancement with clear user/clinical value that stalled
3. A systemic improvement (observability, security, performance, DX) that remains applicable

---

## Output Format (strict — no prose outside this structure)

For each qualifying finding:

- **Omitted Feature:** [Concise name]
- **Technical Description:** [1–3 sentences: what it is, how it was intended to work]
- **Integration Value:** [1–2 sentences: why it still matters to the current system]

If no qualifying items exist, output exactly:
> No actionable delta found in this file.

---

## Session Accumulator

After processing all files in a batch, append findings to this running list and
deduplicate by feature name. Present the final consolidated list sorted by
Integration Value (highest signal first).

| # | Omitted Feature | Technical Description | Integration Value |
|---|-----------------|-----------------------|-------------------|
| 1 | ...             | ...                   | ...               |

---

## Usage

```bash
# Process files one by one (recommended for token budget):
for f in ~/.agent/internal/ARCHIVED/*.md; do
  echo "=== $f ==="
  cat "$f"
  echo ""
  echo "--- run delta analysis per framework above ---"
  echo ""
done
```
