# Astro-Palette Full Theme Transition Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transition the site's full theme system (tokens, typography, layout
base, homepage) to astro-palette (hybrid approach B), preserving existing 15
layouts and page content.

**Architecture:** Hybrid B — import astro-palette's `public/css/style.css` as
base token layer in `BaseLayout.astro`, remap `np-tokens.css` variables to
astro-palette names (`--bg`, `--ink`, `--accent`, `--line`, `--radius-*`,
`--max`), preserve `--np-font-display` (Archivo Black) as override, add
`data-palette` switcher. Existing 15 Astro layouts untouched except import/order
updates; `Layout.astro` from astro-palette adopted optionally for new pages.

**Tech Stack:** Astro 7.1.5, UnoCSS, vanilla CSS vars (astro-palette), no
framework change, AGPL-3.0 import-only (no vendored component code to avoid
contamination).

## Global Constraints

- Astro version: `^7.1.5` (keep exact).
- License: import-only CSS from astro-palette; do not copy `.astro` component
  source.
- Preserve existing 15 layouts (`src/layouts/`) and all 48 pages in
  `src/pages/`.
- Preserve zero-chroma grayscale option: allow selecting a zero-chroma palette
  (`herdr` dark/light mapped to grayscale) alongside chromatic 17 palettes.
- Radius: adopt astro-palette `--radius-sm/md/lg` (2/4/6px) for new/theme
  elements; do not force 0px onto existing component classes (`np-landing.css`)
  unless explicitly migrated.
- Fonts: Inter (`--body`), JetBrains Mono (`--mono`), keep Archivo Black
  override (`--np-font-display`).
- No suppression comments (`@ts-ignore`, `# noqa`) allowed.
- No secrets/PII added.

---

## File Structure

**Modify:**

- `src/styles/np-tokens.css` — remap to astro-palette vars; add 18 palette
  definitions under `[data-palette]` selectors.
- `src/styles/tokens.css` — align legacy `--token-*` aliases to new palette vars
  (compat layer).
- `src/layouts/BaseLayout.astro` — import astro-palette `style.css` before
  `np-tokens.css`; add palette switcher script.
- `src/pages/index.astro` — sync theme classes to new palette vars; keep
  hero/chat-demo/track content.
- `src/styles/np-landing.css` — adjust `.np-hero`, `.np-btn-primary` etc. to
  reference new var names (`--bg`, `--ink`, `--accent`, `--line`).

**Create (optional for adoption):**

- `src/components/Layout.astro` (optional adopt from astro-palette — only import
  structure, not full content copy; if adopted, reference astro-palette pattern
  but rewrite to avoid AGPL contamination of component code).
- `public/css/style.css` reference import only via CDN/local copy allowed (CSS
  only, no `.astro` source copied).

**No change:** all other pages/layouts unless explicitly listed.

---

### Task 1: Import astro-palette base CSS into BaseLayout

**Files:**

- Modify: `src/layouts/BaseLayout.astro`
- Modify: `astro.config.mjs` (if needed for additional static file serving)

**Interfaces:**

- Consumes: existing `BaseLayout` import block (`np-tokens.css`,
  `marketing.css`, `fm-fusion.css`)
- Produces: updated import order with `astro-palette/style.css` first

- [ ] **Step 1:** Read current `src/layouts/BaseLayout.astro` import block.
- [ ] **Step 2:** Add import/link to astro-palette base CSS
      (`public/css/style.css` copied/imported as static file, or CDN link in
      `<head>`). Ensure it loads before `np-tokens.css`.
- [ ] **Step 3:** Update `<html>` tag to support `data-palette="herdr"` (default
      dark) plus existing `data-theme="dark"` / light.
- [ ] **Step 4:** Verify build (`pnpm build` or `astro build`) passes with new
      import.
- [ ] **Step 5:** Commit: `theme: import astro-palette base CSS in BaseLayout`

---

### Task 2: Remap np-tokens.css to astro-palette variables

**Files:**

- Modify: `src/styles/np-tokens.css`
- Modify: `src/styles/tokens.css` (compat aliases)

**Interfaces:**

- Consumes: current `np-tokens.css` (`--np-bg`, `--np-surface`, `--np-text`,
  etc.)
- Produces: remapped vars mapped to `--bg`, `--ink`, `--surface`, `--muted`,
  `--accent`, `--line`, `--radius-sm/md/lg`, plus 18 `[data-palette="..."]`
  blocks

- [ ] **Step 1:** Map `--np-bg` → `--bg`, `--np-text` → `--ink`, `--np-muted` →
      `--muted`, `--np-mid` → `--line-strong` or custom `--line`, `--np-hover` →
      `--line` / `--surface`, `--np-elevated` → `--surface-elevated` (define if
      missing).
- [ ] **Step 2:** Define 18 palette blocks (`herdr`, `catppuccin`, `terminal`,
      etc.) using exact CSS var values from astro-palette `style.css` (37KB).
      Keep zero-chroma grayscale option as a mapped grayscale palette (e.g.,
      `herdr` mapped to grayscale `oklch` values matching current `--np-*`).
- [ ] **Step 3:** Preserve legacy `--token-*` aliases (`--accent-primary` →
      `--accent`) in `tokens.css` for backward compatibility.
- [ ] **Step 4:** Verify CSS syntax; run
      `cat src/styles/np-tokens.css | head -n 30` to confirm mapping.
- [ ] **Step 5:** Commit:
      `theme: remap np-tokens.css to astro-palette vars + 18 palettes`

---

### Task 3: Add palette switcher (runtime theme selection)

**Files:**

- Modify: `src/layouts/BaseLayout.astro` (add switcher UI/script)
- Modify: `src/pages/style-guide.astro` (add palette demo section if exists)

**Interfaces:**

- Consumes: `data-palette` attribute; `localStorage` key for theme
- Produces: selectable 18 palettes with `herdr` default; preserves
  `localStorage('theme')` for dark/light

- [ ] **Step 1:** Add a palette switcher component (dropdown or row of buttons)
      to `BaseLayout.astro` footer/header area, referencing `data-palette`
      values.
- [ ] **Step 2:** Write minimal JS: `localStorage.setItem('palette', value)`;
      apply `document.documentElement.setAttribute('data-palette', value)`;
      dispatch event if needed.
- [ ] **Step 3:** Ensure dark/light (`data-theme`) continues to work
      independently (astro-palette supports both via palette definitions).
- [ ] **Step 4:** Test in browser (dev server) that switching palette changes
      colors; confirm no console errors.
- [ ] **Step 5:** Commit:
      `theme: add 18-palette switcher with localStorage persistence`

---

### Task 4: Sync homepage (index.astro + np-landing.css) to new tokens

**Files:**

- Modify: `src/pages/index.astro`
- Modify: `src/styles/np-landing.css`
- Modify: `src/lib/content/hero.ts` (if token references present)

**Interfaces:**

- Consumes: new `--bg`, `--ink`, `--accent`, `--line`, `--radius-*`, `--max`
- Produces: homepage renders with astro-palette tokens without content loss

- [ ] **Step 1:** Read `np-landing.css`; replace direct color references
      (`#10b981` emerald, `#a44f33`, grayscale hexes) with `--accent`, `--ink`,
      `--bg`, `--surface`. Keep component class names (`.np-hero`,
      `.np-btn-primary`) unchanged.
- [ ] **Step 2:** Update `.np-btn-primary` to use `--accent` / `--bg` with
      `--radius-sm` (2px). If existing classes rely on `border-radius: 0px`, add
      override class `.np-flat` for 0px to preserve NP flat-doctrine where
      needed.
- [ ] **Step 3:** Update `index.astro`: confirm `<Head>` imports and theme class
      references align; add `data-palette` attribute initialization from
      `localStorage`.
- [ ] **Step 4:** Check hero/chat-demo content (`heroContent`,
      `workflowContent`, `ctaContent` from `src/lib/content/`) — no token
      dependency expected; verify no broken references.
- [ ] **Step 5:** Run `pnpm build`; confirm homepage renders; commit:
      `theme: sync homepage/index and np-landing.css to new palette tokens`

---

### Task 5: Optional — adopt astro-palette Layout.astro pattern (new pages only)

**Files:**

- Create: `src/components/Layout.astro` (optional, only if user wants adoption)
- Modify: `src/pages/style-guide.astro` (optional demo)

**Interfaces:**

- Produces: optional new layout component; existing layouts untouched

Note: only adopt component structure, not copy source code from astro-palette
(AGPL). Rewrite with own markup.

- [ ] **Step 1:** Read astro-palette `Layout.astro` structure (nav, search,
      theme switch) from repo docs; rewrite in `src/components/Layout.astro`
      using same patterns but original markup (no copied `.astro` source lines).
- [ ] **Step 2:** Import into a test page (e.g., `style-guide.astro`)
      optionally; verify no build errors.
- [ ] **Step 3:** If adopted: commit
      `theme: optional Layout component adopted (rewritten, AGPL-safe)`. If
      skipped: skip commit; document in plan that adoption deferred.

---

## Verification

- Build: `pnpm build`
- Dev test: `pnpm dev`, visit `http://localhost:4321`, switch palettes, confirm
  colors change; visit homepage (`/`), confirm hero/chat-demo renders.
- No errors in terminal; no `@ts-ignore` or suppression added.
- Check `docs/superpowers/specs/` spec file exists; plan saved.

---

Plan complete and saved to
`docs/superpowers/plans/2026-08-09-astro-palette-full-theme-plan.md`. Two
execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task,
review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans,
batch execution with checkpoints

Which approach? If subagent-driven: I will invoke
superpowers:subagent-driven-development for Task 1.
