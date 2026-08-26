---
name: astro-palette-full-theme-design
description:
  Hybrid transition to astro-palette theme (palette + optional layout, keep 15
  existing layouts)
metadata:
  type: project
---

Approach B (hybrid): adopt astro-palette CSS vars + optional components, keep
existing Astro pages/layouts.

- Palette: 18 palettes (`herdr` default), `data-palette="..."`, vars: `--bg`,
  `--ink`, `--accent`, `--line`, `--radius-lg/md/sm`, `--max`.
- Typography: Inter (`--body`), JetBrains Mono (`--mono`), preserve Archivo
  Black (`--np-font-display`) via override.
- Layout: import `astro-palette` `style.css` in `BaseLayout.astro`; optional
  `Layout.astro` for new pages. Existing 15 layouts preserved.
- Homepage: sync `index.astro` + `np-landing.css` to new tokens; keep
  hero/chat-demo/track content.
- Risk: AGPL-3.0 source; only import CSS tokens (not vendoring full component
  code) avoids license contamination.

**Why:** lowest blast radius while achieving full theme adoption. **How to
apply:** update `np-tokens.css` to map to astro-palette vars; add palette
switcher; adjust `BaseLayout` import order.
