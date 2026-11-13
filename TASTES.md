# TASTES.md

Aesthetic guidelines and design constraints for Pixelated Empathy.

> **Doctrine in effect:** Neutral Precision — "The Quiet Instrument." This file
> reflects what is actually shipping, not an aspirational brand. If you change
> the design system, change this file in the same PR.

---

## 1. Visual & Color System ("Neutral Precision")

Two registers, one ramp. Product surfaces stay zero-chroma. Public surfaces add
**exactly two** signal tokens, merged in from the Supernova Recovery drafting
sheet (2026-11-05). The palette is defined once, in `src/styles/np-tokens.css`.

### Surfaces

- **Bg Primary / ground**: `#0b0b0c` — page canvas, a dark room rather than a void
- **Surface / panel**: `#121214` — cards, containers, the transcript proof object
- **Elevated / raised panel**: `#18181b` — pane heads, modals, supervisor rows
- **Void**: `#0e0e10` — recessed strips, code wells, tick plates
- **Borders / dividers**: `#1c1c21` hairline, `#2a2a30` panel, `#3a3a42` figure
  and input frames

### Text

- **Text Primary / drafting white**: `#e8e6df` (dark) / `#16160f` (light)
- **Text Secondary / Muted**: `#8b8b94` — labels, captions
- **Text Mid**: `#9a9aa3` — spec body copy
- **Dim**: `#7f7f88` — dimension text, passive annotations

### Accent — the Two-Signal Rule

Two tokens, no more:

- **`--np-cyan` `#55d6e0`** — structure. Centerline, stencil punches, dimension
  rules, ghost-cell grid, list marks, hover, focus. Cyan is a line, never a
  filled plate behind body copy.
- **`--np-amber` `#ffb000`** — the single irreversible action on a surface
  (primary CTA). One per view. Never a status colour, never a heading, never
  decoration.

Light mode re-maps them to `#0a6e78` / `#8a5a00` so text-bearing uses clear AA.
Any third hue is out of scope: propose it as a token before using it. The legacy
`--accent-primary` alias now resolves to `--np-cyan`.

Product surfaces (dashboard, chat, therapy, admin) remain zero-chroma. A
clinical surface that needs a semantic signal (e.g. crisis / risk) must be
tokenized in a separate pass — do not reach for a literal.

---

## 2. Typography

Three families, three jobs. No fourth family without a real contrast reason.

- **Display / Heading**: Big Shoulders Display — hero and section headings.
  Weight 800, uppercase, tracking `0.01em`, leading `0.9`. `text-wrap: balance`
  on hero and section titles. Space Grotesk Variable remains the app fallback.
- **Body / Paragraph**: Instrument Sans Variable — product reading, transcript
  dialog, form copy. Weight 400, line-height `1.55`, `text-wrap: pretty` on
  ledes. Public-surface ledes and card copy switch to the spec face below.
- **Spec / Label**: IBM Plex Mono — public-surface ledes, card copy, stencils,
  dimensions, ticks, buttons, timestamps. Weight 400–500, all caps with
  `0.12em–0.2em` tracking when used as a label.
- **App mono**: Spline Sans Mono Variable — code blocks, raw data, supervisor
  annotations inside the product. Never a decorative label costume.

Measure: 62–68ch on spec copy, 20ch max on condensed display. The condensed
face buys vertical room — do not compensate by enlarging the headline.

---

## 3. Structural Constraints (Technical Brutalism)

- **Flat Over Round**: Strict minimal border-radius. Default `0px` everywhere.
  Pill shapes, rounded buttons, and gradient blobs are out of scope.
- **No Heavy Shadows**: Never soft diffuse box-shadows for elevation. Rely
  on 1px border outlines and the surface ramp (`--np-bg` → `--np-surface` →
  `--np-elevated` → `--np-void`). The one sanctioned shadow is the drafting
  plate: a hard offset with zero blur (`--np-shadow-plate`), public surfaces
  only.
- **Grid Exposure**: Page-level grids use thin `--np-line` rules and the 18px
  cyan blueprint grid (`--np-grid-unit`) masked to fade out. The dashed cyan
  centerline (`.np-centerline`, rendered once by `BaseLayout`) is the page
  datum — one per page, never two.
- **Drawing primitives**: stencil, dimension row, head rule, ghost cell, plate,
  figure, tick, crop marks, revision block. Specified once, in `DESIGN.md`
  under drafting primitives, but not yet committed as CSS; until it lands,
  build containers from the NP tokens.
- **Component Shape**: Cards are content-shaped (discrete, scannable).
  One card inside another is never right; flatten with type and dividers
  instead. Wrappers that exist only to add margin should be deleted.

---

## 4. Interaction & Motion

- **Hover states**: 150ms `var(--np-ease)`. On cards and CTAs, a `1px`
  background lift (`var(--np-surface)`) and a `translateY(-1px)` on the
  primary button. No permanent elevation on any non-hovered control.
- **Focus rings**: 2px solid `var(--np-cyan)` with 3px offset, on **all**
  interactive surfaces — nav, theme toggle, form fields, buttons, marketing
  CTAs. This is a hard constraint, not a default. 1px focus rings are a
  regression to fix.
- **Touch targets**: Minimum 44×44px (48×48px comfortable). The visual element
  can be smaller; the hit area must be 44px. The shared header toggle is 44×44.
- **Reduced motion**: Every animated surface must include a
  `@media (prefers-reduced-motion: reduce)` block that drops transition
  duration to `0.01ms`. Do not ship motion without the fallback.
- **Form fields**: ≥16px font-size on inputs/textareas under 640px to prevent
  iOS Safari auto-zoom on focus. `font-size: 1rem` minimum.

---

## 5. Stylesheet Layout

Four CSS files, four jobs. Do not collapse them.

- **`src/styles/np-tokens.css`** — Token source of truth: palette, type, space,
  radii, motion, z-index, light/dark theme, and the two signal tokens. The
  `:root` and `[data-theme=light]` blocks. Legacy compatibility aliases
  (`--accent-primary`, `--accent-primary-rgb`, `--font-body`, `--ease-out`).
- **Drafting layer** — specified in `DESIGN.md`, not committed: there is no
  `np-drafting.css` in the tree and nothing imports it. The centerline,
  stencil, dimension row, head rule, ghost cell, plate, figure, tick, crop
  marks, revision block and stroke mark are the intended primitives when it
  lands.
- **`src/styles/np-landing.css`** — Homepage (`/`) styles. Loaded only by
  `src/pages/index.astro`. Layout only: it must **not** redeclare palette or
  type tokens (it used to, including a Monocraft display override).
- **`src/styles/marketing.css`** — The 7 marketing pages (`/features`, `/trust`,
  `/about`, `/press`, `/team`, `/company`, `/contact`). Loaded by
  `src/layouts/BaseLayout.astro`. Defines `.marketing-hero`, `.marketing-title`,
  `.marketing-input`, `.marketing-button`, `.marketing-cta-band`, etc.
- **`src/styles/fm-fusion.css`** — Self-contained FM hairline-grid layer
  used by `FmHairlineGrid`, `FmChip`, `FmEyebrow` components on `/features`.
  Loaded by `BaseLayout.astro` alongside `marketing.css`.

**Dead code (do not delete without sign-off):**

- `src/styles/homepage.css` — decorative system with radial gradients and
  `backdrop-filter: blur`. Has zero importers as of the most recent audit.
  Imported by some compiled outputs only. Documented here so future
  contributors do not re-import it.
- `src/styles/variables.css` — orange-accent, light-first legacy. Not
  imported by any marketing page; importing it globally would override the
  NP zero-chroma rule on `html { background-color } !important`. Keep as a
  reference, do not import.

**Do not import `variables.css` from `BaseLayout.astro`.** It uses
`!important` on `html { background-color }` and `body { background-color }`
and a global link underline animation, which would override the NP chrome.

---

## 6. Page-Surface Rules

- **Homepage** (`/`): brand register. A drawing sheet: stencil zone codes
  (`Sheet 01–05`), condensed uppercase hero, dimension row under the h1, the
  clinical workstation framed as `Fig. 01`, single amber action, ticker row,
  and a revision-block footer (project / sheet / rev / scale).
- **Marketing pages**: brand register with a 2-tier scale. Condensed h1, mono
  lede, spec cards with a cyan hover border. Each page carries a per-page proof
  object in the hero (4 capability tracks for /features, 3 trust topics for
  /trust, founder card for /team, etc.) — not a generic 3-up stats grid.
- **Contact** (`/contact`): Configure register. Hero proof object previews
  the form (what to bring); the form is below in a `marketing-card` with
  visible 1px borders, 16px font, 2px cyan focus ring.
- **Nav**: sheet index numbers (`01`–`05`) in mono beside each label; the
  current page keeps its blinking block cursor. Brand carries the
  continuous-stroke mark.

---

## 7. Drift to Refuse

- Any hue outside the two sanctioned signals (cyan, amber) on a public
  surface. No orange, blue, green, or purple without a tokenized decision.
- Gradient hero blobs, glassmorphism, pill buttons, centered-icon-card rows.
- Lorem ipsum, "Welcome to [Product]" copy, exclamation points.
- Display fonts in product labels. Mono in display headlines.
- Cyan used as a filled plate behind body copy, or amber used for anything
  other than the single primary action.
- "AI-y" decorative motifs (gradient rings, animated cursor arrows, glowing
  borders).
- The "Dark Metal" orange doctrine from the prior TASTES.md — superseded.
  Do not reintroduce `#ff8533` or any other chromatic accent without a
  deliberate product decision.
