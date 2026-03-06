# Business Strategy CMS

Business Strategy Expansion & CMS system for the Pixelated Empathy platform.
Manages strategy documents, AI review, and edge-case mapping.

## Development

- **Lint:** `pnpm lint`
- **Typecheck:** `pnpm typecheck`
- **Run:** `pnpm dev`

Run `pnpm lint` and `pnpm typecheck` before running the strategy import script.
Import is valid when both pass.

## Strategy import

The import script syncs Markdown from the
[business-strategy](../business-strategy/) folder into the CMS (MongoDB).
It now includes **all** `.md` files under that folder, including:

- Root-level strategy docs (`01-executive-summary.md`, `02-market-analysis.md`, etc.)
- **outreach/** (e.g. `stanford-pilot-proposal.md`, `follow-up-templates.md`)
- **pilot-operations/** (e.g. `operational-checklist.md`)

Root `README.md` is skipped. Documents are upserted by `source_file` (path
relative to `business-strategy/`) for idempotency.

**Run import (from repo root):**

```bash
cd business-strategy-cms && pnpm exec tsx scripts/import-strategy.ts
```

Ensure `pnpm lint` and `pnpm typecheck` pass in `business-strategy-cms` before
running the import.

After a successful run, the script writes `.last-strategy-import.json` (sources
and timestamp). The API exposes `GET /strategy/sources` and the strategy
dashboard includes `source_file` per document for editor reference.

## OVHCloud storage

See [OVHCloud-Setup.md](OVHCloud-Setup.md) for Object Storage (S3-compatible)
configuration.
