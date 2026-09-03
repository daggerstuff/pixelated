# Stage 3 — Script extraction

Selectively extracts Python and Linux shell (`bash`/`sh`) fenced code blocks from markdown files into `scripts/`.

## Flow

1. Scan all `*.md` files (`SKILL.md`, `examples.md`, `background.md`, etc.)
2. LLM reviews each Python or shell block — `extract: true` or `extract: false`
3. Approved blocks become `.py` or `.sh` files under `scripts/`
4. Inline fences are replaced with a short run reference (`python scripts/...` or `bash scripts/...`)
5. Revert if total markdown tokens do not decrease

## CLI

```bash
skillreducer reduce ./my-skill --stage 3
```

Runs after Stage 2 by default when no `--stage` is given.
