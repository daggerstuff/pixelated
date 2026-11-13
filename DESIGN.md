---
name: Pixelated Empathy
description:
  Clinical AI platform for therapist training and supervision. Dark-first
  neutral precision.
colors:
  ground: '#0b0b0c'
  panel: '#121214'
  raised-panel: '#18181b'
  drafting-white: '#e8e6df'
  rule: '#1c1c21'
  rule-strong: '#2a2a30'
  rule-figure: '#3a3a42'
  muted: '#8b8b94'
  signal-structure: '#55d6e0'
  signal-action: '#ffb000'
  paper-bg: '#f6f5f0'
  paper-ink: '#16160f'
typography:
  display:
    fontFamily: '"Big Shoulders Display", "Arial Narrow", system-ui, sans-serif'
    fontWeight: 800
    lineHeight: 0.9
    letterSpacing: 0.01em
  body:
    fontFamily: '"Instrument Sans Variable", system-ui, sans-serif'
    fontWeight: 400
    lineHeight: 1.55
  spec:
    fontFamily: '"IBM Plex Mono", "Spline Sans Mono Variable", ui-monospace, monospace'
    fontWeight: 500
    lineHeight: 1.7
rounded:
  sm: 0px
  md: 0px
  lg: 0px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  2xl: 72px
components:
  button-primary:
    backgroundColor: '#ffb000'
    textColor: '#12100a'
    rounded: 0px
    padding: 12px 24px
  button-ghost:
    backgroundColor: transparent
    textColor: '#e8e6df'
    rounded: 0px
    padding: 12px 24px
---

# Design System: Pixelated Empathy

## 1. Overview

### The redesign bar (owner directive, 2026-09-16)

The current in-flight redesign was rejected by the owner as "the same shit
under the same name." A re-theme is not a redesign. Swapping fonts, renaming
tokens, or re-skinning the existing component set while the layout,
information architecture, and interaction patterns stay identical fails.

**Any redesign work must change the structure**: how a page is organized, how
information is prioritized and traversed, what the surface does — not just
what it's called. Before proposing or shipping redesign work, be able to
answer in one sentence what the user will experience differently. If the
honest answer is "it looks the same, but cleaner," stop and rethink.

### Creative North Star: "The Quiet Instrument"

A clinical AI training platform designed for trust, not spectacle. Dark by
default, neutral by doctrine. Every pixel earns its place through clarity,
hierarchy, and restraint — never through decoration.

This system rejects the "Dark Metal" identity that preceded it (aggressive
near-black, electric orange, developer-tool energy) in favor of something
quieter: near-chroma-0 grays, precise typography, and the confidence that
content is the only color that matters. The interface should feel like a
well-made tool — present when needed, invisible when not.

The primary mode is dark, and always will be. Therapists and supervisors use
this platform in low-light environments (evening sessions, focused supervision,
late charting). A dark screen that recedes is more comfortable for extended use.
Light mode exists for accessibility and daytime context-switching, but it is the
secondary citizen — flatter, cooler, designed to be less visually interesting so
the dark mode remains the intended experience.

**Key Characteristics:**

- Zero-chroma product ramp (no hue); public sheets carry exactly two signals,
  cyan for structure and amber for the one irreversible action (§2)
- Typography carries the product voice — weight, size, and spacing replace hue;
  public sheets set Big Shoulders Display over IBM Plex Mono annotation
- Flat by design: 0px radius everywhere, no blurred shadows (the hard offset
  plate is the single flat exception)
- Dark-first: dark mode is the authored state; light mode is the paper fallback
- Motion is deliberate and minimal — state changes only, no choreography
- Content (client data, session notes, charts) is the color

### Amendment 2026-11-05 — the drafting-sheet merge

The public surfaces now borrow their drawing language from
**supernovarecovery.com** (the hackathon site). The clinical instrument stayed;
what changed is the sheet it is drawn on.

**What merged in:**

- **Ground and panel values** moved from flat `#1a1a1a`/`#242424` to a dark
  drafting room: `#0b0b0c` ground, `#121214` panel, `#18181b` raised panel,
  `#e8e6df` drafting white, and a three-step rule ramp
  (`#1c1c21` → `#2a2a30` → `#3a3a42`).
- **Display type** is now Big Shoulders Display, condensed and set 800 in
  uppercase, with leading at `0.9`. Space Grotesk stays as the app-level
  fallback. Mono (IBM Plex Mono) became the _spec voice_: labels, dimensions,
  ticks, and supporting body copy on public surfaces.
- **Two signals replace the zero-chroma rule** on public surfaces — see §2.
- **A drafting layer** (`src/styles/np-drafting.css`) adds the centerline,
  stencils, dimension rows, ghost cells, crop marks, and the hard offset plate.

**What did not change:** 0px radius, no soft shadows, no gradients or glass,
dark-first, 150ms state-only motion, 44px targets, 2px focus rings. The product
registers (dashboard, chat, therapy, admin) keep reading typography and the
neutral ramp — the drafting voice is scoped to public surfaces.

## 2. Colors

Two registers, one ramp. **Product surfaces** (dashboard, chat, therapy, admin)
stay zero-chroma: emphasis comes from value contrast, never hue. **Public
surfaces** (homepage, features, trust, about, press, team, company, contact)
add exactly two signal tokens on top of the same ramp — cyan for structure,
amber for the single irreversible action.

### Dark Mode (primary)

| Token    | Value     | Role                                 |
| -------- | --------- | ------------------------------------ |
| Body bg  | `#0b0b0c` | Primary canvas (drafting ground)     |
| Surface  | `#121214` | Cards, containers, secondary panels  |
| Elevated | `#18181b` | Modals, dropdowns, pane heads        |
| Void     | `#0e0e10` | Recessed strips, code wells          |
| Text     | `#e8e6df` | Body copy, headings (drafting white) |
| Muted    | `#8b8b94` | Labels, captions, placeholder text   |
| Mid      | `#9a9aa3` | Enhanced muted, spec copy            |
| Dim      | `#7f7f88` | Dimension text, passive annotations  |
| Line     | `#1c1c21` | Hairline rule, inter-section         |
| Line 2   | `#2a2a30` | Panel border, dimension rule         |
| Line 3   | `#3a3a42` | Inputs, figure frames, crop marks    |

### Light Mode (secondary)

Drafting paper: warm off-white ground, graphite ink, and darker signal values so
every accent still clears AA on paper.

| Token    | Value                 | Role                |
| -------- | --------------------- | ------------------- |
| Body bg  | `#f6f5f0`             | Primary canvas      |
| Surface  | `#eeede7`             | Cards, containers   |
| Elevated | `#e6e5de`             | Modals, dropdowns   |
| Text     | `#16160f`             | Body copy, headings |
| Muted    | `#5c5c55`             | Labels, captions    |
| Line     | `rgba(0, 0, 0, 0.10)` | Borders, dividers   |

### The Two-Signal Rule (public surfaces)

Colour enters a public surface through exactly two tokens:

- **`--np-cyan` `#55d6e0`** — structure. The dashed centerline, stencil
  punches, dimension rules, ghost-cell grid, list marks, hover, and focus.
  Cyan is a line, never a filled plate behind body copy.
- **`--np-amber` `#ffb000`** — the single irreversible action on a surface
  (the primary CTA). One per view. Amber is never a status colour, never a
  heading, never a decoration.

Light mode re-maps both to `#0a6e78` and `#8a5a00` so text-bearing uses clear AA.
Any third hue is out of scope and must be proposed as a token before use.

### The Zero-Chroma Rule (product surfaces)

No color enters the product chrome through design tokens. Not as an accent, not
as a background tint, not as a hover state. The only color in the interface is
the content the user brings (session data, client profiles, charts, evidence).
If a surface needs emphasis, use value contrast — a darker surface, a heavier
weight, a thicker rule. If it still needs color, something is wrong with the
information architecture.

### The register boundary (enforced in tokens)

The two registers are a token boundary, not a convention. `np-tokens.css`
declares the neutral defaults on `:root` — `--accent-primary: var(--np-mid)`,
`--focus-ring` on `--np-mid`, a zero-chroma selection — and re-points them at
the cyan signal only under `:root[data-register='public']`. `BaseLayout` (and
the `MizuLayout` / `AuthLayout` shells that wrap it) is the sole layout that
sets that attribute, and it is also the only layout that imports
`np-drafting.css` and `marketing.css`. `AdminLayout`, `DashboardLayout`,
`ChatLayout`, `DocumentationLayout`, and `BrutalistLayout` own their `<html>`
shells and import `np-tokens.css` alone, so they inherit the neutral defaults
and no hue reaches them through the legacy alias layer.

### Data-viz earns hue (scoped)

The zero-chroma rule governs **UI chrome**. Chart _marks_ are the one sanctioned
exception: series fills and strokes, heatmap cells, and isolated data glyphs may
use a bounded palette so that multi-series data stays legible. Dense
multi-series charts encode nothing without hue — series collapse into an
undifferentiated gray stack, which defeats the data. Hue here serves **data
semantics**, not decoration.

The scope is strict and is the entire point of the exception:

- **Marks earn hue.** Bars, lines, points, area fills, heatmap cells, donut
  wedges, and any single data element whose identity across categories must read
  at a glance.
- **Chrome stays zero-chroma.** Axes, gridlines, tick labels, axis titles,
  legends, tooltips, the chart container's border/background, heading, and
  caption — all on the neutral ramp (`np-text`, `np-muted`, `np-line`). Hue
  never leaks from a data mark into the frame around it.
- **No hue for UI state.** Sim/live/stop, active/inactive, success/error — these
  stay zero-chroma, encoded by filled-vs-hollow glyph, weight, and value
  contrast (`np-elevated` lift). Hue is the data's, not the interface's.
- **Bounded palette, not ad-hoc.** Chart palettes are defined once and
  referenced, never scattered as Tailwind `emerald-500` literals inline. Reuse
  an existing series-palette util if one exists; otherwise define a small scoped
  palette where the chart lives.

## 3. Typography

**Display Font:** Big Shoulders Display (Arial Narrow, system-ui fallback)
**Body Font:** Instrument Sans Variable (system-ui, sans-serif fallback)
**Label Font:** IBM Plex Mono, tracked uppercase **Spec Font (public
surfaces):** IBM Plex Mono **App mono (data/code):** Spline Sans Mono Variable

**Character:** Big Shoulders is a condensed industrial display face. It carries
the headline at 800 in uppercase with leading at 0.9, which is what makes a
public page read as a drawing sheet rather than a landing page. Instrument Sans
Variable still carries product reading and interface text. IBM Plex Mono is the
spec voice on public surfaces: labels, dimensions, ticks, and supporting body
copy. Spline Sans Mono remains app-internal (code, raw data).

### Hierarchy

- **Display** (`Big Shoulders Display`, weight 800,
  `clamp(3rem, 7vw, 6rem)`, line-height 0.9, `0.01em` letter-spacing,
  uppercase): Hero headings.
- **Headline** (`Big Shoulders Display`, weight 800,
  `clamp(2.25rem, 4.5vw, 4rem)`, line-height 0.95, uppercase): Section titles.
- **Title** (`Big Shoulders Display`, weight 700, `1rem`–`1.65rem`,
  line-height 1.05): Card titles. Condensed but not uppercase.
- **Spec body** (`IBM Plex Mono`, weight 400, `0.9375rem` / `15px`,
  line-height 1.7, max-width 62–66ch): Public-surface ledes and card copy.
- **Body** (`Instrument Sans Variable`, weight 400, `1.125rem` / `18px`,
  line-height 1.55): Product reading text.
- **Label** (`IBM Plex Mono` on public surfaces, `Instrument Sans Variable` in
  product, weight 500, `0.625rem`–`0.75rem`, `0.14em`–`0.2em` tracking,
  uppercase): Field labels, stencils, dimension rows, ticks.
- **Data** (`IBM Plex Mono`, weight 500, `0.875rem`, tabular numerals):
  Numerical data and telemetry. Code blocks and transcripts stay Spline Sans
  Mono Variable.

### The Content-is-Type Rule

Heading weight is the emphasis tool, not color. A heading in weight 800 reads as
more important than one in weight 700. Never underline, italicize, or colorize a
heading for emphasis — weight, scale, and case alone carry the hierarchy.

## 4. Elevation

Flat by default. The interface uses tonal layering — four surface levels (bg /
surface / elevated / void) — to convey depth. No soft shadows, no blurs, no glass
effects.

A card is `surface` (`#121214`) on `bg` (`#0b0b0c`). A modal is `elevated`
(`#18181b`) on `overlay` (the bg at 75% opacity). The contrast differential is
small — enough to register, not enough to shout.

### The Flat-By-Default Rule

Surfaces are flat at rest. Soft shadows are never used as decoration. The
`elevated` token is the depth system — not `box-shadow`, not `backdrop-filter`,
not `transform`. If a surface needs to feel higher, make it lighter. If it needs
to feel lower, make it darker. That is the full vocabulary.

**The one exception — the plate.** On public drawing surfaces, a plate may carry
a single hard offset with zero blur (`--np-shadow-plate` / `-strong`: a 6px or
10px cyan-wash offset). It is a registration mark on a drawing, not elevation:
it never appears on product chrome, never animates, and never blurs.

## 5. Components

### Buttons

- **Shape:** Hard edges (0px radius). Full-height hit targets (44px minimum).
- **Primary (public surfaces):** `amber` bg (`#ffb000`), `amber-ink` text
  (`#12100a`), mono label at 0.6875rem / 0.16em tracking. On hover: transparent
  bg, amber text, amber border — the button inverts, it does not lift. Exactly
  one per view.
- **Primary (product):** `elevated` bg (`#18181b`), `text` color, 12px 24px
  padding. On hover: moves to `hover` (`#1f1f24`). On click: `active`
  (`#232329`).
- **Ghost / secondary:** Transparent bg, `text` color, `1px solid
  --np-line-figure` border. On hover: cyan border and cyan text.
- **Link:** Text only, `text` color, 1px underline in `--np-line-figure`; on
  hover both go cyan.
- **Focus:** `2px solid --np-cyan` outline, 3px offset, on **every**
  interactive surface. 1px focus rings are a regression.
- **Disabled:** `opacity: 0.55`, `pointer-events: none`.

### Cards / Containers

- **Corner Style:** 0px radius.
- **Background:** `surface` (`#121214`) on `bg` (`#0b0b0c`).
- **Border:** `1px solid --np-line` (`#1c1c21`); hover raises it to cyan.
- **Shadow Strategy:** None, except the public-surface plate (§4).
- **Internal Padding:** 24px (spacing.lg). Tightens to 16px on narrow viewports.

### Inputs / Fields

- **Style:** `1px solid --np-line` border on `surface` bg. On hover the border
  shifts to `--np-line-figure` (`#3a3a42`).
- **Focus:** `2px solid --np-cyan` outline, 3px offset, border also cyan. No
  glow, no ring.
- **Placeholder:** `muted` color. No opacity trick.
- **Error:** Border shifts to `text`, plus an `IBM Plex Mono` label below. No
  red — contrast is the signal.
- **Disabled:** `opacity: 0.55`.

### Navigation

- **Desktop:** Left sidebar (dashboard) or top bar (public pages). Sidebar: `bg`
  background, 240px wide. Top bar: `surface` background, full width, hairline
  bottom border.
- **Items:** `Spline Sans Mono Variable` label at 12px, 0.04em tracking,
  uppercase. Active:
  `text` color, no indicator. Inactive: `muted` color. Hover: `surface` →
  `elevated` bg.
- **Mobile:** Bottom tab bar or slide-out drawer, same token system.
- **Breakpoints:** the layout constants are the `theme.breakpoints` map in
  `uno.config.ts` — `sm 640`, `md 768`, `lg 1024`, `lgp 1128`, `xl 1280`,
  `2xl 1536`. `lgp` is the article split: at or above 1128px the table of
  contents is a sticky side rail, below it the same links are the floating
  button panel, and the two must never be on screen together. A user-level
  `breakpoints` map replaces the preset's list rather than merging into it, so
  every key has to be restated there or its utilities stop emitting. Variant
  groups (`lt-lgp:(op-50 pointer-events-auto)`) additionally need
  `transformerVariantGroup()` in the `transformers` array — it is not part of
  `presetUno`, and without it a group is extracted as two broken half-tokens
  and emits nothing.

### Badges / Chips

- **Style:** `surface` bg, `1px solid --np-line` border, `IBM Plex Mono`
  11px uppercase label, 4px 8px padding. A chip is defined by its border, not
  color.
- **Active:** Border shifts to `--np-line-strong`, bg stays the same.

### Drafting primitives (`src/styles/np-drafting.css`)

The merged Supernova layer. Namespaced `np-` so it cannot collide with the
legacy `marketing-*` system, loaded by `BaseLayout.astro` for every public page.

| Primitive          | Class            | Rule                                                                                                                 |
| ------------------ | ---------------- | -------------------------------------------------------------------------------------------------------------------- |
| Centerline         | `.np-centerline` | One dashed cyan line at 50%, `z-index: 0`, hidden below 1024px                                                       |
| Stencil            | `.np-stencil`    | Boxed mono zone code with two cyan punches. Opens every section                                                      |
| Dimension row      | `.np-dim-row`    | Measured annotation with a vertical tick and a value run                                                             |
| Head rule          | `.np-hd-rule`    | Cyan square, then a hairline that fills the row                                                                      |
| Ghost cell         | `.np-ghost-cell` | 18px cyan grid, crosshair, empty by design                                                                           |
| Plate              | `.np-plate`      | 2px drafting-white border + hard cyan offset. Public surfaces only                                                   |
| Figure             | `.np-figure`     | Framed exhibit with a mono caption (`Fig. 01 — …`)                                                                   |
| Tick               | `.np-tick`       | 2px top rule, display value, mono label                                                                              |
| Crop marks         | `.np-crop`       | Eight registration lines on a frame                                                                                  |
| Revision block     | `.np-rev`        | Footer title block: project / sheet / rev / scale                                                                    |
| Footer sheet index | `.footer-index`  | Four-column reference index above the title block; the only link to /privacy, /terms, /accessibility, /cookie-policy |
| Stroke mark        | `.np-mark`       | Single-path wordmark that draws itself once                                                                          |

Use a primitive before inventing a new container. If a primitive needs a
variant, add a modifier (`--tight`) rather than a second class.

## 6. Do's and Don'ts

### Do

- **Do** use value contrast as the primary emphasis tool. A surface at
  `oklch(0.18)` is "higher" than one at `oklch(0.14)`. Lean into this.
- **Do** let Big Shoulders Display carry the public headline — 800,
  uppercase, tight leading. Instrument Sans Variable carries the reading and
  interface text underneath it.
- **Do** set spec annotation (labels, dimensions, ticks, captions) in IBM Plex
  Mono. Spline Sans Mono stays on app-internal telemetry and raw data utility.
- **Do** keep every radius at 0px. Hard edges signal precision.
- **Do** use the `surface` → `elevated` contrast for depth. No shadows needed —
  the one exception is the hard offset plate, which has no blur.
- **Do** design for dark mode first. Light mode is the accessibility fallback —
  it should feel quieter and less visually rich.
- **Do** test every text/background pair for WCAG AA contrast (4.5:1 body, 3:1
  large text). The neutral ramp makes this easy — stay on it, and re-measure
  the two signals on paper (`#0a6e78`, `#8a5a00`) if you touch the light ramp.

### Don't

- **Don't** add a third hue. The product register has none; the public register
  has exactly two, and both are tokens (`--np-cyan`, `--np-amber`). Propose a
  token before using any other color — not as a brand underline, not as a hover
  tint.
- **Don't** use soft shadows, box-shadows with blur, or glass. Tonal layering is
  the depth vocabulary; the hard offset plate is the single flat exception.
- **Don't** use border-radius greater than 0px on anything. Not buttons, not
  cards, not inputs. Not 2px, not 4px, not "barely rounded."
- **Don't** use the old "Dark Metal" orange accent (`#ff8533`). Its energy is
  wrong for this platform.
- **Don't** use the old emerald brand tokens (`#10b981`, `#34d399`,
  `rgba(16,185,129,0.3)`) as accent. Neither register sanctions them. In the
  present codebase these survive in ~30 components (hover borders, status dots,
  marketing tiles); see the Drift Appendix — removing them is open work, not
  permission to add more.
- **Don't** reach for a cream / sand / paper body background or gradient-text
  headings as the default look. The warm-neutral AI default reads as
  machine-generated, not clinical. The one paper surface in the system is the
  `data-theme="light"` accessibility ramp — it is a fallback, not a style.
- **Don't** build the SaaS dark-dashboard pastiche — metric-stack hero,
  identical icon-card grids, glass cards, button gradients. Familiarity is fine;
  the undifferentiated template is the anti-reference.
- **Don't** use glass effects, backdrop-filter, gradients, or any decorative
  surface treatment.
- **Don't** use uppercase tracking on Instrument Sans Variable body text — it
  reduces readability. Reserve uppercase + tracking for small labels (weight 500) only.
- **Don't** animate layout properties. Only `opacity` and `transform`
  transitions.
- **Don't** use icons as decoration. Every icon should carry information — a
  status, an action, a signal.

## 7. Drift Appendix (code vs doctrine)

This section records where the present codebase diverges from the system above.
It is **tech-debt triage, not doctrine**: the doctrine in §§2–6 is what new and
refactored work must target. Nothing here grants permission to extend the drift.

**Migration status** (tracked by the drift-closure plan; update after each phase
lands):

- [x] **Phase 1 — doctrine amended.** §2.1 "Data-viz earns hue (scoped)" added;
      chart marks may use bounded hue, chart chrome and all UI state stay
      zero-chroma. The emerald clause below is now partially superseded for
      **chart marks only** — chrome still bans it.
- [x] **Phase 2 — layouts consolidated onto `src/styles/np-tokens.css`.**
      BlogLayout, DocumentationLayout, ChatLayout, TailusLayout, BrutalistLayout
      swapped off the legacy 6-file bundle onto np-tokens; slate
      `theme-color #0f172a` → neutral `#1a1a1a`. ResearchLayout already inherits
      np-tokens via BaseLayout (its `research.css` is component styling,
      deferred to Phase 3). Build green (exit 0).
- [x] **Phase 3 — surgical strip (complete, 2026-09-18).** Evidence pass
      over the surgical scope (demo/, marketing/, mizu/, showcase, plus the
      emerald token source): the token source (`src/styles/tokens.css`)
      and three dead mizu pastiche components (Stats/Steps/Hero) were
      deleted (zero importers); demo/, showcase, and the remaining live
      mizu/ and marketing/ surfaces are grep-clean of emerald literals;
      the dead ConversionTrackingDemo/Example chain and its orphaned
      useConversionTracking hook were removed. Remaining emerald literals
      in the codebase are either sanctioned chart **marks** (ehr widget
      charts, data-viz exception §2.1) or belong to the standing
      **harden debt** below (admin/monitoring chrome, ~7 dashboard/admin
      pages) — none are in the surgical scope.
- [x] **Phase 4 — legacy CSS files retired.** 18 dead legacy token/style sheets
      deleted (grep-verified zero importers post-Phase-2):
      `public/css/{unified-dark-theme-v3, unified-blended-theme,design-system,brutalist-minimal,button-fixes,background-fixes,font-fix, variables,borders,shadows,gradients,mesh}.css`,
      `public/styles/global.css`,
      `src/styles/{brutalist-minimal,shadows,pixelated-theme,unified-dark-theme-v3,enhanced-theme}.css`.
      `uno.config.ts` is clean; `public/css/index.css` kept (live
      `.container`/`.sr-only` utilities). None reached the DOM post-Phase-2
      (UnoCSS preset provides the `bg-emerald-500`/`shadow-*`/ `rounded-2xl`
      utilities that actually render — those live inline in components and
      belong to Phase 3, not here). `pnpm build` green (exit 0); lint errors
      = 0.
- [x] **Phase 5 — drafting-sheet merge (2026-11-05) and its closure pass
      (2026-11-08).** Supernova's drafting language landed as
      `src/styles/np-drafting.css` + retuned `np-tokens.css`, scoped to the
      public register (§2.3). Closure pass: the `lt-lgp:` utilities in `Toc`,
      `TocButton`, `ToTopButton`, `SearchSwitch` and `GroupItem` had been
      compiling to nothing for **two** reasons — `lgp` was not a registered
      breakpoint, and `transformerVariantGroup()` was missing from
      `uno.config.ts`, so every `prefix:(a b)` group was extracted as two broken
      half-tokens; both are now in `uno.config.ts` (the breakpoint map restates
      the preset's five keys, because a user-level map replaces the preset's
      list instead of merging into it). The desktop TOC rail now hides below
      1128px instead of duplicating the button panel; token-named classes
      (`np-text`, `np-muted`, `np-mid`, `np-surface`, `np-elevated`) and the
      demo-only `np-cta`/`np-ring` are defined in `np-legacy-bridge.css` — 187
      call sites on four demo/showcase pages had been emitting no declarations
      at all, so muted copy rendered at full ink and half the CTAs had no
      button; the legacy `brutalist-*` names the deleted theme left behind are
      restated in NP tokens; one dead `dark:prose-invert` removed from
      `ui-showcase` (there is no typography plugin, so it could never emit);
      and this file plus `TASTES.md`/`PRODUCT.md` un-ignored so the doctrine
      ships with the code instead of living only on the machine that wrote it.

### Standing debt (deferred from Phase 3, tracked not forgotten)

Mobile touch-target best practice (44x44px) on landing/nav chrome: CLOSED
(2026-10-05, PIX-4750). The harden pass measured the real offenders on the
built page: `.np-apparatus-tab` (43px), `.np-skip-link` (36px),
`.nav-menu-panel` links (~40px) got real 44px boxes (min-height + flex
centering); the compact header row (`.brand` 24px, `.nav-menu-button` and
`.nav-icon-link` 33.6px) cannot grow without re-breaking the 320px
no-horizontal-scroll fix (PIX-4746, ~6px slack), so those three get
`::after` overlays that extend the pointer hit area to 44px while the
visual box and layout stay unchanged (verified via elementFromPoint probes;
`sw == vw` at 320/375 holds). The old note's "header CTA ~36px" was stale —
hero `.np-btn` CTAs already carry `min-height: 44px`. CI keeps gating the
WCAG 2.2 AA 2.5.8 24px floor only (boundingBox cannot see pseudo hit
areas).

Chrome-hue utilities (Tailwind `emerald/indigo/red -*`) survive in ~120
patient-adjacent and admin surfaces: `admin/PatientRightsSystem`, `admin/*`
dashboards, `auth/*`, `consent/*`, `crisis/*`, `session/*`,
`training/session/*`, `chat/*`, `memory/*`, `professional/*`, `therapy/*`,
`treatment/*`, `journal-research/*`, `security/*`, `simulator/*`, plus many
`pages/admin/*` and `pages/dashboard/*` routes. These encode state
(sim/live/stop, active/inactive, success/error) ad-hoc as inline utilities.
Migration to value-contrast + icon + weight (the doctrine) is per-component
design work deferred to a dedicated `harden` pass. New and refactored work in
these areas must target the doctrine, not the surrounding drift.

**Hardening progress** (update after each slice lands; the canonical migrated
vocabulary is the shadcn-style token bridge in `uno.config.ts` — `bg-card`,
`bg-secondary`, `bg-primary`/`text-primary-foreground`, `text-foreground`,
`text-muted-foreground`, `border-input`, `border-ring`, `bg-accent` — all
resolving to `--np-*` tokens):

- [x] `components/admin/AdminDashboard.tsx` (2026-09-20) — zero-chroma,
      0px radius, no shadows. Severity = border tone + inverted label chip +
      glyph; health tiers = muted → foreground → foreground-bold; audit
      passed/failed = quiet chip vs inverted chip.
- [x] `pages/admin/security/baa/**` (7 pages, 2026-09-20) — the whole BAA
      family (templates, vendors, requirements, verify, management):
      indigo/gray Tailwind replaced with the token bridge; status chips =
      quiet (passed) / ring-border (warning) / inverted (failed); legend
      swatches = border-input / accent / primary; 0px radius, no shadows.
- [x] `pages/admin/security/disaster-recovery/index.astro` +
      `components/admin/PatientRightsSystem.astro` (2026-09-20, `6e495258f`)
      — hero gradient → solid primary banner; status chips encode by chip
      fill + weight; dark: pairs collapsed; neutral-* family caught too.
      (Companion `cbf0fbe1d`: `--case-signal` chromatic rust → near-ink
      oklch(0.22 0 0), fixed 9 downstream uses at once.)
- [x] 8 more `pages/admin/*` (2026-09-20, `dae7918dc`): consent-management,
      state-consent-rules (index + [ruleId]), security/index,
      security/risk-assessment, oversight, demo-analytics,
      all-demos-analytics — token bridge everywhere; analytics pages keep
      hue only on §2.1 chart marks (funnel/A-B bar fills, series configs).
- [x] data-governance components (2026-09-21, `217d16e04`): AccessRequestsLog,
      RetentionReports, DataDeletionLog, DataRetentionSystem — chip vocabulary
      quiet / ring-border / weight; destructive actions on primary.
- [x] 4 more `pages/admin/*` (2026-09-21, `70cca1b06`): ai/validation-pipeline,
      ai-explainability, data-transfer, cache — §2.1 marks kept: cache
      hit-ratio tier bars + explainability quality gauges (solid fills,
      gradients flattened).
- [x] 4 more (2026-09-21, `51e438c93`): patient-rights, data-retention,
      backup/BackupLocationTab, system-health — §2.1 marks kept: system-health
      memory/health gauges (healthy tier normalized to primary, JS class
      lists kept in sync).
- [x] 4 more (2026-09-22, `acbfa1770`): RetentionAuditLogs,
      DataDeletionRequestForm, TransferAuditLog, TherapeuticDashboard.
- [x] 4 more (2026-09-22, `bdb99a47d`): EvidenceAssistantPanel,
      PerformanceDashboard, consent/index, backup/BackupReportTab —
      the glassy slate/cyan assistant panel rebuilt fully on the bridge.
- [x] **admin scope complete** (2026-09-22, `72c466ea7`): the remaining
      ~25-surface tail swept (shells, consent dashboard, DLP, backup tab
      family, bias dashboard surfaces, BAA stat colors, RUM legend,
      fhe/performance/compatibility/ai-performance pages). Sanctioned §2.1
      gauge/chart marks remain (ai-explainability, system-health, cache,
      risk-assessment severity bars, analytics funnel/A-B series).
- [x] patient-adjacent slice 1 (2026-09-22, `f0a7fe551`): SessionDocumentation,
      chat AnalyticsDashboardReact, TherapistDashboard, WebPerformanceDashboard.
      §2.1 marks kept: emotion scatter palette, sentiment tier bars, patient
      progress gauge tiers, web-vitals good/watch/poor palette.
- [x] patient-adjacent slice 2 (2026-09-23, `751fdff35`):
      EnterpriseAdminDashboard, pages/dashboard/bias-detection,
      ResearchDashboard — mesh radial backgrounds, floating gradient blobs,
      gradient nav pills, and gradient-text headings eliminated.
- [x] patient-adjacent slice 3 (2026-09-23, `4b376f24f`): the whole
      demos/bias-detection family (all 10 components — the 5 ranked
      plus ImprovedBiasInterface, AccessibleLoadingState, SessionInputForm,
      BiasAnalysisDisplay, RealTimeBiasIndicator) on the token bridge.
      §2.1 marks kept: HistoricalProgressTracker severity-tier progress fill;
      RealTimeBiasIndicator score tiers re-encoded as a value-contrast ladder.
- [x] patient-adjacent slice 4 (2026-09-24, `5b6e44867`): monitoring/
      AIPerformanceDashboard.astro — token bridge throughout (tabs ring/muted,
      chips quiet/ring-card, 0px radius, no shadows, dark: pairs collapsed);
      Chart.js series palette kept as the bounded §2.1 mark. Note: the change
      landed inside the parallel session's cost-optimization commit (their
      `git add -A` swept the working-tree file); content verified as staged.
- [x] patient-adjacent slice 5 (2026-09-24, `ded68597a`): demo/
      PsychologyFrameworksDemo — evidence-tier chips quiet/ring+weight, card
      selection ring-ring on secondary (hover shadow removed), spinner on
      border-ring, 0px radius. Companion `d06d5b3d2`: image-optimizer
      encode tests given 30s budgets (recurring load-induced flake that hit
      three of four bucket runs).
- [x] patient-adjacent slice 6 (2026-09-24, `77222c3bc`): analytics/
      EmotionProgressDashboard — tier chips as value ladder, gradient banner/
      badge flattened, gauges on primary; the 3-series progress chart keeps
      hue as a §2.1 mark via a scoped SERIES_PALETTE const (bars + legend
      swatches reference it).
- [x] patient-adjacent slice 7 (2026-09-24, `5066ccf06`): ai/
      MultiAgentThoughtUI — the glassy dark-metal timeline rebuilt on the
      bridge (blur/opacity surfaces → card/secondary, status chips on the
      quiet/ring ladder, feedback as filled-vs-hollow glyphs, no glow).
- [x] patient-adjacent slice 8 (2026-09-24, `ecf8d1a42`): crisis/
      CrisisSessionFlagsManager — severity/status ladders on value contrast,
      stat panels on card, modal overlay bg-foreground/60, 0px radius.
      (First attempt was lost to a parallel session's working-tree sweep
      before commit; reapplied.)
      CI repairs same day: `85c31589a` re-pins the complexity baseline
      (371→372; the parallel sweep pushed three functions past 120 lines),
      `6ad839d0f` re-pins the tech-debt marker baseline (200→164, strictly
      tighter; sweep resolved 36 markers and shifted TodoReact.tsx's 38
      lowercase-identifier false positives to new line numbers). Follow-up
      `23a32e474` (parallel session) fixed the root cause: the audit regex
      no longer counts lowercase identifiers as markers.
- [x] patient-adjacent slice 9 (2026-09-24, `a58a0646f`): the chat family —
      PixelMultimodalChat (slate/indigo glass), TherapyChatSystem (green
      phosphor terminal), BrutalistChatDemo (slate brutalist shell) all on
      the bridge; three decorative aesthetics retired, no chart marks.
- [x] patient-adjacent slice 10 (2026-09-24, `5115f59e0`): treatment/
      TreatmentPlanManager — priority/status value ladders (urgent inverted
      primary, high/medium ring-border, low quiet; in-progress ring+weight),
      cards on bg-card, gauges on primary, 0px radius, no chart marks.
- [x] patient-adjacent slice 11 (2026-09-24, `60de3b6b8`): ui/
      BiasAnalysisResults — alert chips and score readouts on the value
      ladder; the bias-score bar's severity-tier fills kept as a §2.1 mark,
      consolidated into a scoped SCORE_TIER_FILL const.
- [x] patient-adjacent slice 12 (2026-09-24, `654915755`): therapy family
      (TherapeuticGoalsTracker status ladders + filled-vs-hollow checkpoint
      glyphs; therapy/TreatmentPlanManager — a second, distinct live
      component — slate/red chrome on the bridge) plus the shared
      ui/progress.tsx primitive, whose semantic variants (success/warning/
      error) were neutralized to the value ramp at the source for all
      consumers; variant names unchanged.
      Gate follow-ups same day: `7142d3ef4` removes the dead ProgressCircular
      export (surfaced by the unused-exports gate when progress.tsx was
      touched); `367b31902` trims 30 dead re-export lines from the ui barrel
      (editing index.ts pulls it into the gate — Input/Label/Select family/
      Switch/Textarea etc. had no importers via the barrel).
- [x] patient-adjacent slice 13 (2026-09-25, `e65a08b20`): security family —
      FHEDemo.tsx (gradient loading panel flattened, status text ladder),
      FHEDemo.astro (init-badge JS classes to primary/secondary), and
      SecurityDashboard.astro (severity chips + legend on the value ladder,
      light-mode table/cards onto bg-card/divide-border). No chart marks.
- [x] patient-adjacent slice 14 (2026-09-25, `6d5a494ba`): ui/
      MindMirrorDashboard — per-archetype gradient banners flattened to an
      inverted primary banner (dead color/gradient fields removed), mood
      metric bars to plain bg-primary fills, insight/recommendation cards on
      secondary, 0px radius, no shadows. No chart marks.
- [x] patient-adjacent slice 15 (2026-09-25, `ad3956859`): ui/table.tsx
      (shared table primitive — dark: pairs collapsed to tokens, striped/
      hover/selected rows on secondary/accent, sort arrows on value
      contrast, 0px radius; dead TableFooter deleted, TablePagination and
      seven prop interfaces de-exported per the unused-exports gate) and
      ui/Footer.astro (gray -> secondary/foreground, blue link hovers ->
      foreground). Companion: committed lockfile resync — the foresight/cli
      workspace section had been lost (dependabot merges regenerate the
      lockfile without submodule content, breaking the pre-commit lockfile
      check); restored via pnpm install --lockfile-only.
- [x] patient-adjacent slice 16 (2026-09-25, `4111e74a5`): the auth family
      (11 files) — slate glass panels and white/10 surfaces to
      bg-card/secondary, indigo/teal buttons to primary, links to
      foreground+underline, error banners to secondary/ring, inputs to
      border-input + focus:ring-ring, AuthCard.astro shadows/hover-lift
      removed, 0px radius. No chart marks.
      Gate follow-up `166ddfd9f`: dead RoleGuard component deleted
      (zero consumers, barrel-only) and the auth barrel trimmed to
      ProtectedRoute, its one real consumer.
- [x] patient-adjacent slice 17 (2026-09-25, `e7453a4d4`): journal-research
      family (9 files) — BiasAuditDashboard tier chips + score bar on the
      value ramp, approve/escalate/reject as graded neutral actions;
      EvaluationCard/List score ladders; Acquisition status ladders;
      SessionCard phase dots neutralized (test expectation updated);
      NotificationCenter badge on inverted primary; ProgressBar variants
      aligned with ui/progress.tsx. 0px radius, no shadows. No chart marks.
      Gate follow-up `010828b51`: dead features AcquisitionDetail and
      BiasAuditDashboard deleted (zero importers anywhere — only the
      features barrel's export *; ~1,140 lines), barrel trimmed.
- [x] patient-adjacent slice 18 (2026-09-25, `63650487b`): session family
      stragglers — EmotionTrackingChart dimension chips on the value ladder
      with the 3-series line-chart hues consolidated into a scoped
      SERIES_STROKES const (was three inline hex literals), SessionList
      selected row/status chips on the ladder, SessionAnalysis banners and
      cards on the bridge, 0px radius. Same-day CI repairs: `7c36ff1dd`
      (ruff findings surfaced by the parallel session's dep bump),
      `f992913c5` (uv.lock ruff 0.16.5 -> 0.16.9 — CI resolved newer ruff
      than the lockfile and the two versions disagree on isort order; the
      pre-commit hook's ruff --fix was silently reverting CI-conforming
      edits), `3163a8ae7` (wandb lazy-imported at its single call site —
      the isort dispute between identical CI/local ruff versions ended by
      removing the disputable block), `b4e800504` (ai strict-typing
      baseline re-pinned 6431 -> 6371, net 60 tighter; banks the parallel
      session's tiebreak_hr.py regression for their workstream to fix).
- [x] patient-adjacent slice 19 (2026-09-25, `ea2e4b9e0`): the remaining
      tail families — consent/ResearchConsentForm (green/red actions to
      primary/secondary+ring), training/TrainingSessionComponent (glassy
      white/5 blur shell rebuilt on bg-card, role toggles as inverted
      primary vs ring), memory/MemoryDashboard (five colored category chips
      flattened to quiet), professional/TherapistDashboard progress tiers
      to the value ramp. 0px radius, no shadows, no chart marks.
- [x] patient-adjacent slice 20 (2026-09-25, `3c0aa4228`): journal-research
      straggler sweep — last nine one-hit files; journal-research/ is now
      grep-clean of hue literals. **The named density-ranked queue is
      complete.**
- [x] patient-adjacent slice 21 (2026-09-26): ai/ family —
      RecommendationDisplay, AgentMonitorDemo (glassy white/5 dark-metal
      shell rebuilt on card/secondary, mode tabs on primary/ring ladder,
      send button primary, agent dots filled-vs-hollow), SyntheticTherapyDemo,
      and the chat examples all on the token bridge; 0px radius, no shadows.
      NOTE: the hue edits landed inside the parallel session's sweep commits
      (`15e20a6f6`, `a00231fe0`), verified staged intact. Gate repairs
      (`4f99f89d8`, `8db570a11`): dead chat examples
      (ChatCompletionExample, ResponseGenerationExample — zero importers,
      barrel-only) and the orphaned useResponseGeneration hook deleted
      (~1,150 lines); ai/chat barrel trimmed to what demo/ChatDemo consumes
      (ChatContainer + three hooks). components/ai is now grep-clean.
- [x] patient-adjacent slice 22 (2026-09-26, `043c66302`): demo/
      EnterpriseMonitoringDashboard — status ladder re-encoded on value
      contrast (good/online quiet secondary, degraded ring-border + weight,
      critical/offline inverted primary, unknown muted); trend glyphs on
      foreground/muted; spinner on border-ring; analytics icon tiles on
      secondary; 0px radius, no shadows. No chart marks. CI + Quality green.
- [x] patient-adjacent slice 23 (2026-09-26, `fa15f864a`): chat family part 1
      — PixelEnhancedChat (blue chrome to card/primary/border-input, crisis
      card on the ring ladder, bias card quiet, user bubbles inverted
      primary, EQ metric bars on primary/secondary), CognitiveModelSelector
      (profile selection ring-ring on accent, style toggles
      primary-vs-secondary, issue chips quiet), MemoryAwareChatSystem
      (blue/green/purple stat tiles flattened to secondary with
      value-contrast headings, error banner on secondary+ring, memory dot
      on primary, dark: pairs collapsed), ChatMessage (bubbles
      user-primary / assistant-card / system-secondary / error-ring, status
      badges as border-defined neutral chips, ThemeProvider branching
      removed in favor of tokens, ChatMessageProps de-exported per the
      gate). 0px radius, no shadows, no chart marks. CAUTION: ternary-colon
      corruption struck a 5th time (three dropped colons in this slice,
      caught by prettier/oxlint).
      Companion `d28ecddc4`: repaired the broken build left by the parallel
      session's 39996e763 (fonts.ts imports geist/archivo/ibm-plex-mono
      that were never added to the manifest — build + 6 downstream
      workflows red; packages added, build verified green, all suites
      recovered except the ai-submodule strict ratchet, which fails on
      their new consolidate_arc_corpus.py + tests and cannot be banked
      under the new-file rule — left for their workstream).
- [x] patient-adjacent slice 24 (2026-09-27, `f17cb8abd`): chat family
      part 2 — TherapyGate (gate states on the quiet/ring ladder, ping
      dots on primary/muted-foreground, user bubbles inverted primary,
      therapy-gate-trigger.ts DOM classes kept in sync with the
      component), ExportButton (purple split button to primary, dropdown
      on card with border), ChatContainer + ChatInput (ThemeProvider
      branching collapsed to tokens, focus on ring, send primary),
      TherapyChatClient + ScenarioSelector + LazyAnalyticsDashboard
      (purple-terminal shells to card/secondary), SecurityBadge +
      FHEChatStatus (status chips as border-defined neutrals), and the
      dark-metal family (SessionTimeline, GoalAttainmentScale,
      DefenseMechanismAdaptation, MultiSessionProgression,
      BeliefChangeTracker: #121212/#0a0a0a hex to card/background tokens,
      white/10 borders to border-border, banned #ff8533 outlines to
      outline-ring, #b0b0b0 text to muted-foreground). Timeline event
      dots keep sky/violet as a scoped §2.1 data-mark const;
      AnalyticsDashboardReact's emotion palette stays sanctioned.
      Six dead local types de-exported per the gate. 0px radius, no
      shadows. components/chat is now drift-clean except sanctioned
      §2.1 marks. CI green on the head; Quality still red on the known
      ai-submodule strict ratchet (parallel session's new
      consolidate_arc_corpus.py + tests — theirs to fix).
- [x] patient-adjacent slice 25 (2026-09-27, `aa0c92870`): dashboard family
      — AnalyticsCharts (stat colors collapsed to foreground, trend glyphs
      foreground/muted, time-range toggles primary-vs-secondary, session
      bar chart on primary marks, skeletons on secondary),
      CrisisMonitoringDashboard (risk/severity ladders re-encoded on the
      token ramp — imminent/critical inverted primary, high/medium ring,
      low quiet; risk dots filled-to-hollow), EmotionDimensionalAnalysis
      (valence/arousal/dominance tiles flattened to secondary with
      value-contrast headings), SessionControls (pause/resume primary,
      end-session ring+weight, status chips on the ladder; test
      expectations updated), TherapistProgressTracker/TherapistDashboard/
      ProgressBar/SessionMetrics/BiasAnalyticsChart (tokens, 0px radius,
      shadows removed), and TherapyProgressCharts.astro (self-contained
      Tailwind-in-CSS island rebuilt on np tokens: card+border surfaces,
      gridlines/axis labels on the neutral ramp, chart strokes and pie
      fills consolidated into a scoped SERIES_PALETTE const as
      sanctioned §2.1 marks). Dead default exports removed from four
      components per the gate. Ternary-colon corruption struck a 6th
      time (five dropped colons — now greppable via a
      `\? '…'\n\s+'…'` pattern and repaired before commit).
      components/dashboard is drift-clean. CI green; Quality still red
      only on the ai-submodule strict ratchet (parallel session's).
- [x] patient-adjacent slice 26 (2026-09-27, `199b8128a`):
      MentalHealthInsights (green/blue/yellow/purple/red phosphor panels
      flattened to secondary with foreground/muted hierarchy, emotion
      chips on border-input, expert-guidance banner on secondary+ring,
      risk icons on foreground/muted with critical keeping its pulse;
      dead default export dropped) and demo/ClinicalAnalysisDemo (risk
      badge ladder quiet → ring → inverted primary, indicator confidence
      left-borders ring/input/border, priority badges ring+weight vs
      muted, spinner on border-ring). 0px radius, no shadows.
      **tailus/ finding**: the whole 13-file directory (~236 hue hits)
      is dead — zero importers outside the directory and its
      @tailus/themer-* imports are not installed (module-shims.d.ts
      type-stubs only), so any build that included it would fail.
      Deletion deferred because the files carry uncommitted
      formatting-only edits from the parallel session's tree; revisit
      once the tree is clean (same class as the mizu deletions).
- [x] patient-adjacent slice 27 (2026-09-28): dead tailus/ prototype
      family deleted (13 files + 3 @tailus/themer module-shims,
      `a4b5e50ed`, ~1,150 lines) — grep-verified zero importers; the
      files' uncommitted parallel-session edits were destroyed per
      explicit user authorization. research/ family migrated
      (`196d1a1f8`, 13 files): slate+pink dark-metal group
      (SearchFilters/ExportPanel/DatasetSearch/SearchInterface/
      ResultCard/DatasetCard/ResultsGrid/SourceSelector/
      ResearchDashboard modals) on card/secondary, pink→primary/ring,
      DatasetCard's pink focus glow and gradient overlay removed,
      #1e293b→bg-card; light dashboard quartet (MetricsGrid/
      ActiveStudiesList/UpcomingMilestones/InsightsPanel) dark: pairs
      collapsed, colored tiles→secondary. Gate follow-up `090816536`:
      CI's unused-exports gate caught a dead SourceType export the
      local gate missed (stale changed-file base from interleaved
      parallel pushes) — de-exported. components/research is
      drift-clean.
      Companion CI repair `6202f1353` + `f346bb6ce`: the advisory
      Core+Lib job failed deterministically in CI (never locally) on
      encryptionManager.test.ts "should throw for inactive key".
      Root cause: scheduleKeyRotation computed 30-90-day intervals in
      ms, exceeding Node's 2^31-1 ms timer ceiling — Node clamps such
      delays to 1 ms, so "monthly" auto-rotation fired every
      millisecond; rotateKeys also never registered the new key, so the
      first spurious tick left currentKeyId pointing at an unregistered
      key (getCurrentKeyInfo() null; encrypt with the current key
      impossible — the production auto-rotation path has been broken
      since inception). Fixed at the source (timer capped at the
      ceiling + age check in the callback; new key registered), two
      regression tests added; CI's unused-exports gate also flagged the
      dead default export and KeyMetadata type, de-exported in
      `f346bb6ce`. All workflows green on `f346bb6ce`, including
      Quality. Lesson: prefer asserting over the code path's actual
      timing semantics — a test that "cannot fail" locally on a fast
      machine may lose a 1 ms race on slower CI hardware.
- [x] patient-adjacent slice 28 (2026-09-28, `06ded69a4`): monitoring/
      family — AuditDashboard (cards on bg-card+border, unusual-access
      count chip inverted primary, detail rows foreground+glyph, ok
      message muted), RUMWidget (card shell with border, 0px radius,
      shadows removed, gray pairs to foreground/muted, refresh link
      foreground+underline; vitals good/watch/poor kept as sanctioned
      §2.1 marks matching the WebPerformanceDashboard precedent),
      RealUserMonitoring.astro (card shell, primary refresh button,
      metric tiles on secondary, dead chromatic scoped CSS deleted,
      decorative hover-lift removed, loading placeholder on --np-muted).
      WebPerformanceDashboard.astro was already migrated (slice 1); its
      vitals palette stays sanctioned. components/monitoring is
      drift-clean except the vitals marks. All workflows green.
- [x] patient-adjacent slice 29 (2026-09-28, `f2d9cbaa5`): feedback/
      family — SupervisorFeedback — the green phosphor supervisor panel
      rebuilt on the bridge (header/tab strip/footer on secondary,
      opportunity cards and example panels on secondary+border with
      0px radius, quote rules to border-ring, strengths/growth glyphs
      re-encoded as filled foreground ✓ vs muted → arrows so state
      carries no hue, recommendation panel on secondary, shadow
      removed). components/feedback is drift-clean. All workflows
      green.
- [x] patient-adjacent slice 30 (2026-09-28, `3ade74387`): demo
      stragglers — KnowledgeParsingDemo (icon tile secondary, real-time
      toggle ring state, error banner secondary+ring, risk severity
      badges inverted-primary/ring/quiet), ScenarioGenerationDemo
      (slate/orange shell to card/primary, type selection
      ring-vs-card, treatment tiles secondary, spinner on ring),
      ChatDemo (neutral-gray chrome to the bridge, crisis banner
      inverted primary, risk-ladder ternary re-encoded on weight+value;
      dead ChatDemoErrorBoundary deleted per the gate),
      CrisisDetectionDemo (all-neutral chrome to the bridge, risk badge
      ladder quiet/ring/inverted-primary, spinner on ring),
      PipelineOverview (blue/slate steps ring-vs-card), FHEDemo
      (process button primary, error banner ring; unused named FHEDemo
      export de-exported, default kept for the lazy import). Dead
      PresentingProblemVisualization deleted (zero importers; the git
      rm landed inside the parallel session's f6fd012c2 sweep, verified
      intact — their commit also reset my staged index mid-flight,
      requiring a re-stage). components/demo is drift-clean. Main
      gates green (CI, Playwright, both advisory suites); Quality red
      on the parallel session's ai strict-ratchet debt growth (5795 vs
      5779, their new ai commits) and Training Pipeline red on their
      Python 3.14 bump (transformers missing) — both their workstream.
- [x] patient-adjacent slice 31 (2026-09-28, `968b84dd2` + knip repair
      `3144154bf`): root-level TSX components — ConsentDialog
      (overlay bg-foreground/60, card+border shell, checkbox on
      border-input+ring, consent button primary with disabled/35),
      AIChatReact (card shell, bubbles user-primary/assistant-secondary,
      typing dots muted, send primary), PixelatedEmpathyAgentChat
      (card shell, header/quick-actions on secondary/card, connection
      dot filled-vs-hollow primary/muted, message bubbles user-primary
      vs secondary with error ring, send primary), MetricsDialog
      (card shell, stat tiles secondary, close primary), SearchDemo +
      SearchDemoReact (card shells, result panels secondary,
      border-defined chips, links foreground+underline). 0px radius,
      no shadows. NOTE: my ConsentDialog/AIChatReact/AgentChat edits
      were committed by the parallel session as their own
      `bbb556832`/`35f305d21` (working-tree sweep; content verified
      intact and correctly described). Companion `3144154bf`: removed
      @fontsource-variable/{archivo,geist} — their landing rebuild
      (9f25c2a0c) swapped fonts.ts to space-grotesk/instrument-serif,
      stranding the deps added in d28ecddc4; knip ratchet had flagged
      them, build verified green after removal. Main gates green
      (CI, Playwright, both advisory suites); Quality still red only
      on their workstream: ai strict ratchet (5795 vs 5779) and two
      new oversized files from their landing rebuild
      (pages/index.astro 858, pages/settings/ai-preferences.astro 807).
- [x] patient-adjacent slice 32 (2026-09-28, `f853189a5`):
      documentation/ + ehr/ families — ExportToEHR (card shell, inputs
      border-input, export button primary with /35 disabled, result
      panel secondary+ring with weight-encoded success/error), PreCallCheck
      (availability glyphs foreground-vs-muted, error panel ring+secondary,
      join primary-vs-disabled), TelehealthSession (phase chip ladder
      inverted-primary/ring/quiet, REC chip inverted primary with pulse,
      recording primary, error panel ring), RecordingConsentGate
      (card+border modal, consent primary), RiskReviewCard +
      RiskReviewQueue (risk ladder quiet/ring/ring+bold/inverted-primary,
      approve primary, reject ring), ModalityNoteEditor +
      MobileScheduleView + EHRMobileLayout + MessagingWidget
      (online/offline/sync glyphs foreground-vs-muted, conflict alert on
      np-surface with weight). components/ehr and components/documentation
      are drift-clean. 0px radius, no shadows. Main gates green
      (CI, Playwright, both advisory suites); Quality red only on the
      parallel session's known items (ai strict ratchet 5795 vs 5779,
      their two oversized landing pages).
- [x] patient-adjacent slice 33 (2026-09-28, `eee230b2c`):
      blog/ + marketing/ families — the full blog set (Divider
      border-border, SocialShare brand-hex buttons #1DA1F2/#0A66C2/
      #1877F2 re-encoded as border-defined neutral chips distinguished
      by label with hover bg-accent, ArticleHeader/ArticleCard/AuthorBio
      light-gray shells to bg-card/border-border with secondary tag
      chips, Subscribe to secondary panel + border-input + primary
      button, SeriesNavigation prev/next cards hover:border-ring,
      PostCard both variants — slate/green phosphor card flattened:
      rounded-xl→rounded-none, backdrop-blur/shadow-lg/scale hover
      removed, hover accents border-ring/foreground, category badge
      secondary+border, title hover primary) and marketing/ (HeroTabs:
      active tab inverted primary, loader bg-primary, teal assistant
      bubble secondary+ring, bullets primary, inline --accent-primary
      uses replaced with bridge tokens — the var itself already
      resolves to --np-text; LogoWall: tiles bg-card with
      hover:border-ring, fallback span color var(--np-muted)).
      components/blog and components/marketing are drift-clean.
      0px radius, no shadows. Main gates green (CI, Playwright, both
      advisory suites, Vercel); Quality red only on the parallel
      session's known ai strict ratchet (5795 vs 5779).
- [x] patient-adjacent slice 34 (2026-09-28, `68d89508f`):
      analytics/ family (15 files) — ConversionDashboard gray
      tables/cards to bg-card/border-border (foreground header cells,
      muted body rows, secondary progress tracks with primary fills;
      the chart dataset colors kept as sanctioned §2.1 marks),
      PatternVisualizationReact white-shadow panels to card+border with
      hover:bg-secondary pattern buttons, AdvancedFilteringComponent
      (.tsx + .astro) panel to secondary+border with muted→foreground
      tab ladder, ComparativeProgressControls/Display inputs to
      border-input with error state border-ring + error panel
      secondary+ring with weight, EnhancedChartComponent/ChartComponent
      spinners to border-ring + source dot as filled-primary vs
      hollow-muted glyph, MetricWidget percent-change flattened to
      muted-vs-foreground (arrow glyph carries direction),
      FilterControls/TreatmentForecastForm/DashboardWidget/
      PrivacyDashboard/AnalyticsDashboard(.astro)/
      AnalyticsConversionDashboard(.astro) gray pairs to
      foreground/muted. EmotionProgressDashboard SERIES_PALETTE
      unchanged (scoped §2.1 mark, slice 6). Dead default export
      removed from PatternVisualizationReact per the gate (only the
      named export has consumers). components/analytics is drift-clean
      except sanctioned §2.1 marks. 0px radius, no shadows. Main gates
      green on the head (CI, Playwright, both advisory suites,
      Vercel); the head's Quality run was cancelled by the parallel
      session's newer push (7b6d42aef — submodule bumps), and Quality
      there fails only on their two known items (ai strict ratchet,
      Large files on their landing pages).
- [x] patient-adjacent slice 35 (2026-09-29, `1020bd2da`): layout/
      family (3 files) — AdminLayout (mobile toggle + sticky header on
      bg-card/border-border with hairline instead of shadow, sidebar
      nav links foreground with hover:bg-secondary, dashed content
      well on border-border), OfflineIndicator (connection chip on
      the value ladder: offline inverted primary, slow connection
      secondary+ring-border+weight, pending secondary+border, online
      quiet secondary/muted; shadow/backdrop-blur removed),
      AdvancedAnimations skeleton to bg-secondary. 0px radius, no
      shadows. components/layout is drift-clean.
      CI repair `44f2461bc` (merged as `2ef7b205c`): overnight Trivy
      DB update started failing the image-scan gate on
      CVE-2026-81726 (nltk 3.10.3, HIGH, no fixed release); added a
      documented time-boxed .trivyignore entry per the KSV-0121
      precedent (revisit by 2026-10-13 / on any Dependabot nltk
      update — owner-approved). All non-Quality gates green on the
      head; Quality red on the parallel session's known items (ai
      strict ratchet, Large files). Subsequent CI failures on the
      parallel session's heads are two fresh CVEs in fast-uri
      3.1.6 (CVE-2026-84292/84394, fix = 3.1.7+); their uncommitted
      fast-uri 3.1.8 bump in the working tree is theirs to commit.
- [x] patient-adjacent slice 36 (2026-09-29, `04e560d3e`): the
      root-level component chrome (12 files) — EnterpriseHeader
      (bg-card header with hairline, glow div + gradient underline
      keyframes removed), EnterpriseFooter (gradient shell +
      radial overlays deleted, newsletter input on border-input with
      hard focus outline, JS success/error colors neutralized),
      EnterpriseHero (gradient/blob overlays deleted, chips on
      secondary+border, CTAs flattened), BlogPostCard (slate/green
      tag chips border-defined, error card secondary+ring), Navbar
      (mobile menu tokens), AIChat.astro/SearchDemo.astro/
      MentalHealthChatDemo.astro (gray headers; SearchDemo test mock
      kept in sync), MentalHealthChatDemo.tsx (purple/blue/indigo
      gradient header flattened, user bubbles inverted primary, risk
      badge ladder on value contrast, stat tiles on secondary),
      Hamburger, TrainingSession transcript bubbles. 0px radius, no
      shadows. Companion `29b481e10` (owner-approved): landed the
      parallel session's uncommitted fast-uri 3.1.6→3.1.8 override
      bump (root + workspace.yaml + lockfile + 8 agents) to clear
      the two fresh CVE-2026-84292/84394 Trivy gate failures; no
      ignore entries needed for these. CI green on merge head
      `474a33024` (Trivy gate clear). Quality red on the ai ratchet
      plus two NEW items — jscpd duplication and version drift —
      verified pre-existing on Dependabot-bump heads that predate
      this slice (their dep churn; not the chrome edits; jscpd
      report shows only a pre-existing SearchDemo.tsx clone touching
      migrated files).
- [x] patient-adjacent slice 37 (2026-09-29, `8a274079f`): the ui/
      straggler tail (26 files) — alert primitives (.astro + .tsx)
      re-encoded on the value ladder (info/success quiet, warning
      ring+weight, error inverted primary; Alert.test mock synced),
      SearchBox results dropdown on card, dialog panels on card+border,
      toast cards on card with border, BrainVisualization activity
      ladder as filled-primary → foreground → muted → hollow dots
      with the slate/purple gradient panel flattened, skeleton to
      bg-secondary, UserMenu/MobileDrawer/Navigation/DarkThemeToggle/
      SearchNavItem/Metric/BrutalistBadge/ServiceWorkerUpdater/
      OfflineIndicator(ui)/PasswordInputWithStrength/MentalHealthCard/
      GlowCardDemo/EnhancedMentalHealthChat on the bridge.
      BiasAnalysisResults severity fills unchanged (sanctioned §2.1
      marks, slice 11). Gate follow-up: 21 dead exports removed per
      the unused-exports gate (Toast + default, UserMenu default,
      AlertDescription, nine dead Skeleton variants ~200 lines, eight
      dialog symbols de-exported with definitions retained where used
      internally, ButtonButtonProps de-exported). components/ui is
      drift-clean except sanctioned marks. 0px radius, no shadows.
      CI green on the head (Trivy gate clear since `29b481e10`);
      Quality red only on the parallel session's three known items
      (ai strict ratchet, jscpd duplication, version drift — all
      verified to predate this migration's commits).
- [x] patient-adjacent slice 38 (2026-09-29, `3782cbdc6` +
      repair `2cfaa622a`): AnalyticsDashboardReact §2.1
      emotion-palette review + EmotionProgressDemo +
      WebSocketProgressBar — the six-emotion categorical scatter
      palette KEPT as a sanctioned §2.1 mark but the two duplicated
      inline maps consolidated into one scoped module-level
      EMOTION_COLORS const (points + legend swatches reference it);
      all chrome neutralized (black/purple gradient header →
      secondary, purple active tabs → foreground +
      border-foreground underline, FHE chip, privacy warning,
      footer/panels); single-series value-tier fills (sentiment bars,
      intervention effectiveness, WebSocketProgressBar progress
      tiers) re-encoded on value-contrast ramps (muted → primary/70
      → primary → foreground). EmotionProgressDemo white/gray shells
      to card/secondary. Test expectations synced
      (WebSocketProgressBar.test.tsx). Repair `2cfaa622a`: CI's
      unused-exports gate caught a dead default export on
      WebSocketProgressBar the local gate missed (stale changed-file
      base, slice-27 lesson recurring; named export is the only
      consumer interface) — de-exported. CI green on `2cfaa622a`;
      Quality red only on the parallel session's three known items
      (ai strict ratchet, jscpd duplication, version drift).
- [x] patient-adjacent slice 39 (2026-09-29, `008c353cd`): docs/
      family (12 files) — callout primitives (Warning, Tip, Info,
      Check) on the slice-37 alert value ladder (info/success quiet
      secondary+border, warning border-ring + font-medium);
      Accordion/Expandable/Card/CodeGroup/Latex/ResponseField/
      SnippetIntro gray+blue shells to card/secondary with
      border-border and hover:bg-accent; SnippetIntro's blue/indigo
      gradient panel flattened to bg-secondary; Card's shadow
      removed; all rounded-lg → 0px; Tab.astro raw-CSS blue hex
      (#3b82f6 active/focus) rebuilt on np tokens (active =
      foreground + foreground underline, focus on var(--np-mid),
      dark-mode override block deleted); ResponseField's required
      chip inverted primary, type chip secondary. components/docs is
      grep-clean. No chart marks in this family. CI green on the
      head; Quality red only on the parallel session's three known
      items (ai strict ratchet, jscpd duplication, version drift).
- [x] patient-adjacent slice 40 (2026-09-29, `dd0a91403`): mizu/,
      vitesse/, mdx/ chrome — mizu marketing sections (Features,
      Testimonials, FAQ, Logos): slate-950 shells to bg-background,
      glass cards (slate-900/50 + white/5 borders + backdrop-blur +
      rounded-2xl) to bg-card + border-border, 0px radius, hover
      secondary; slate text to foreground/muted-foreground; feature
      chip as border-defined secondary chip; "Learn more" links to
      foreground + hover:underline; the text-primary-400/500 legacy
      accent classes (both resolve to undefined token vars) to
      foreground; Features' decorative gradient image-overlay
      removed; Logos band to bg-secondary. vitesse/Footer gray pairs
      to border-border + muted-foreground/foreground. mdx/Accordion
      rebuilt like its docs/ twin. DEFERRED (out of census scope,
      later pass): mizu/CTA.astro + mizu/Navbar.astro carry deeper
      raw-CSS glass drift (backdrop-filter blurs, gradient
      surfaces, undefined var(--color-primary-500)/
      --accent-primary-rgb legacy tokens). components/mizu,
      vitesse, mdx are grep-clean. No chart marks. CI green on the
      head; Quality red only on the parallel session's known items
      (ai strict ratchet + Large files on their two landing pages).
- [x] patient-adjacent slice 41 (2026-09-29, `9e4fb6338` + repair
      `af2de6577`): bias-detection/treatment stragglers — admin/
      bias-detection: the Tailwind `neutral-*` ramps were light-mode
      value ladders (near-black text/fills invisible on the dark-first
      theme) re-encoded on the bridge (getAlertColor chips on the
      value ladder with per-tier text, critical inverted
      bg-foreground/text-background; getBiasScoreColor on
      foreground/foreground-80/muted/muted-70; connection-status
      ladder quiet-muted with error on foreground; spinner muted).
      treatment/TreatmentPlanner: white/gray/blue form to the bridge
      (card shell + border instead of shadow, border-input fields,
      primary submit /35 disabled, weight-encoded error line).
      demos/bias-detection §2.1 review: severity-tier progress fills
      in BiasAnalysisDisplay/HistoricalProgressTracker/
      CounterfactualAnalysis kept as sanctioned §2.1 marks (slice-11
      precedent) but the duplicated inline ternary chains consolidated
      into scoped module consts (biasScoreTierFill, alertLevelTierFill,
      scoreTierFill, impactTierFill). Repair `af2de6577`: CI's gate
      flagged six dead exports — the three filterDataBy* helpers
      (internal-only consumers, de-exported) and dead defaults on the
      three demo components. CI green on `af2de6577`; Quality red only
      on the parallel session's known items (ai strict ratchet, Large
      files on their two landing pages).
- [x] patient-adjacent slice 43 (2026-09-29, `ae50bd463`): the
      deferred mizu CTA/Navbar raw-CSS glass rebuild — CTA: the
      rgba(253,252,252,*) near-white literals (invisible on the
      dark-first theme) to np-text/mid/muted; decision panel's
      gradient + backdrop-blur to np-surface + hairline; primary
      button inverted np-text/np-bg with color-mix hover; ghost
      secondary per doctrine; the undefined var(--color-primary-500)
      and all legacy aliases (--accent-primary/--text-primary/
      --bg-primary) replaced with direct np vars; focus on
      var(--np-mid). Navbar: gradient+blur shell to np-surface,
      hairline, 0px radius (was 8px); the pilot button's actual teal
      hex (#0d9488 on #201d1d) to inverted primary; demo button to
      the ghost pattern; inactive links muted, hover/active
      foreground; decorative hover translateY lifts removed. The
      currentColor dashed-underline hairline kept (functional).
      **components/mizu is now fully drift-clean. All workflows green
      on the head — including Quality, cleared by the parallel
      session's `6d64fc3a6` (oversized-pages pin + ai pointer).**
      The chrome-hue migration of components/ is complete: every
      census hit is a sanctioned §2.1 mark, and no deferred items
      remain.
- [x] patient-adjacent slice 42 (2026-09-29, `6c64f53da` + repair
      `b94b9f06c`): the final misc tail — dev/SentryTest (warning
      panel secondary+ring+weight, test buttons as border-defined
      chips), client/ClientHeader (card+border shell, purple links
      to foreground+underline, notes button primary),
      audit/UnusualPatterns (severity chips on the value ladder:
      low quiet, medium ring+weight, high inverted foreground),
      training transcript bubbles on the secondary ramp,
      base/NavItem+Divider+Backdrop (gray pairs and hex literals to
      tokens, overlay bg-foreground/60), toc/TocButton
      (secondary/card shells, legacy var(--c-*) refs dropped),
      agent-note-collab (red error banner to secondary+ring),
      views/GithubItem+CardItem+GroupItem (hex/gray literals,
      shadows, rounded-lg, focus outline-ring),
      accessibility/LiveRegionDemo, admin info callouts
      (AccessRequestsLog, BackupSecurityManager),
      ai/SyntheticTherapyDemo.tsx.disabled. DEAD-CODE DELETION
      (owner-authorized): SessionAnalysis, cube-paths,
      background-paths, and the orphaned EmotionTrackingChart —
      zero importers anywhere; touching the files would expose
      their dead default exports to the gate. Repair `b94b9f06c`:
      dead LiveRegionDemoReact named export de-exported (default
      kept, sole consumer imports default). CI green on `b94b9f06c`;
      Quality red only on the parallel session's known items; the
      Advisory Core+Lib run flaked on a 1ms timing margin in the
      auth anti-timing-attack test (unrelated, non-blocking).
      **components/ is now drift-clean: every remaining census hit
      is a sanctioned §2.1 mark.**
- [x] patient-adjacent slice 44 (2026-09-30, `4e95c526b`): the
      pages/ migration opens — training/ family (annotation, index,
      session/[sessionId], 184 hits): light-mode gray/blue/purple
      surfaces rebuilt on the bridge — text ramps to
      foreground/muted-foreground, bg-white/gray-50/neutral-* to
      card/secondary (session shell to bg-background), inputs
      border-input, action ladder per doctrine (end-session and
      submits inverted primary, yellow pause to secondary+ring,
      gray buttons to secondary/accent ghosts), status/metric chips
      on the value ladder (critical inverted, warning ring+weight,
      rest quiet), live session meters (trust/resistance/crisis/
      engagement/insight) unified on bg-primary single-value fills
      with label-carried identity, crisis banner secondary+border-
      ring, focus rings on ring, all radii 0px, shadows/hover-lifts
      removed, gradient avatar circle flattened. pages/training is
      grep-clean; no chart marks in the family. Companion security
      commits (same day): pyjwt 2.13.0 → 2.15.1 across every
      Trivy-scanned lockfile — root uv.lock (`6bdba185a`),
      bias-detection python-service (`4984e3995`), ai submodule
      ops/DataDesigner locks + GitHub mirror (`45f44014a`,
      parent pin `e838e6f3f`); the parallel session independently
      landed ai root (`ce70cb80a`) and foresight (`4a4e148`,
      parent pin `7eee6f722`) — coordinated, no conflicts; their
      uncommitted foresight lockfile churn preserved untouched.
      Security Scanning (Trivy) green on `e838e6f3f`; Quality green;
      CI exercised fully on `4e95c526b` (its only failure was the
      Trivy subgate since cleared). CI note: lockfile/gitlink-only
      pushes don't match CI's path filter (by design).
- [x] broader components/ census (closed 2026-09-29): the census
      pattern
      `(?:bg|text|border|ring)-(?:emerald|indigo|red|green|yellow|blue|amber|purple|orange|teal|pink|rose|cyan|slate|gray|neutral)-[0-9]{2,3}`
      now measures 41 hits in 8 files, all sanctioned §2.1 marks:
      monitoring/{WebPerformanceDashboard (web-vitals good/watch/
      poor), RUMWidget (same vitals palette)}, chat/
      AnalyticsDashboardReact (EMOTION_COLORS), analytics/
      EmotionProgressDashboard (SERIES_PALETTE), demos/bias-detection
      {BiasAnalysisDisplay, HistoricalProgressTracker,
      CounterfactualAnalysis} and ui/BiasAnalysisResults (scoped
      severity-tier fill consts). Deferred (out of census scope):
      none remaining — the mizu CTA/Navbar glass rebuild landed in
      slice 43.
- [x] patient-adjacent slice 45 (2026-09-30, `8d2614fc9`): pages/demo/
      family (11 files, 463 hits) — the phosphor-accent demo pages
      (psychology-pipeline-processor, bias-detection,
      synthetic-training-generator, security-bias-detection-engine,
      psychology-pipeline, chat, frameworks, clinical-vault-trainer,
      clinical-analysis, crisis-detection, enhanced-bias-detection)
      rebuilt on the bridge: accent text ramps to foreground/
      muted-foreground, tinted cards/badges to card/secondary+border,
      solid status dots and meter fills to bg-primary, gradient CTAs
      to inverted primary buttons (rounded-none, no scale), gradient
      hero shells to bg-background, gradient clip-text headings to
      plain foreground, the bias spectrum bar to a single-value
      bg-primary fill. Decorative hue/choreography deleted: floating
      gradient blobs, the particles system, golden-shimmer gradient
      text, animate-breathe, hover lifts, dead gradient-text classes
      (usage-only; no scoped definitions). Legacy CSS vars in
      chat/bias scoped styles to np tokens; emerald pulse-glow,
      backdrop-blur glass, shadows, and the enhanced-bias focus
      outline (to var(--np-mid)) fixed; all radii 0px except dot
      glyphs. No chart marks existed in the family; Playwright demo
      selectors (data-testid, button text) untouched and green.
      pages/demo is grep-clean. Companion security fix
      (`e935fd9e7`, owner-approved): the CI image-scan Trivy gate
      failed on nodemailer 9.1.1 (GHSA-v53p-9fqp-m79j, HIGH 7.5,
      addressparser ReDoS; fixed in 10.0.6) because a stale
      workspace override (^9.0.1 from 905aa95d0) silently defeated
      the manifest's merged ^10.0.10 bump — override removed,
      nodemailer resolves to 10.0.12; EmailService (sole consumer,
      stable createTransport API) green on the full suite
      (exact 25/3 baseline); lockfile regenerated under the
      committed pnpm 11.24.0 via index plumbing so the parallel
      session's uncommitted pnpm-12 lockfile header stayed out of
      the commit (their dirt preserved in the working tree
      throughout; verified post-push). CI green on `d35fe8ea5`
      (the head carrying the fix; the Dependabot uv-group bumps
      landed on top, and their mypy/psycopg fallout is their
      workstream's Quality red, not this slice's).
- [x] patient-adjacent slice 46 (2026-09-30, `dfbd37a08`): pages/dashboard/
      family (9 files, ~156 hits) — light-mode accent stat pages
      (patient, enhanced: blue/green/purple/orange-600 values, icons,
      gradient Cards) to the bridge (bg-card, foreground values,
      secondary icon tiles, primary CTAs with text-primary-foreground,
      dark: pairs collapsed, focus:ring-ring); clinical-validity
      (orange warning callout to secondary+ring, error/loading banners
      on the ladder, score-bar fills re-encoded on the value ramp
      foreground / primary/70 / muted-foreground/50, status text by
      weight); annotation (chips border-defined, warning chips
      border-ring, selected card border-ring, the promotion-workflow
      legend as a filled-vs-hollow value ramp: hollow / muted /
      primary / foreground); bias-detection JS templates (bias-score
      chips inverted/ring/quiet by score, alert cards secondary+ring
      with muted timestamps, decorative floating blobs + dead CSS
      deleted); analytics (canvas series hues consolidated into a
      scoped SERIES_COLORS const — sanctioned §2.1 marks; gridlines
      resolve --np-line at runtime; bias-distribution severity-tier
      dots into a scoped DISTRIBUTION_TIER_DOT const; time-range
      active pill inverted primary; gradient-text defs neutralized to
      foreground; mesh radial backgrounds and floating blobs
      deleted); emotions/dimensional-analysis gray-900/600 to
      foreground/muted; agent-monitor gradient-clip heading +
      dead .text-gradient CSS deleted; session-progress stray
      rounded-lg and the banned #ff8533 eyebrow fixed. Full vitest:
      exact 25/3 auth0 baseline. CI green on the head; Playwright
      (bias-detection smoke, text/data-testid selectors only) green
      on the carrying tip `7863f323f`; Quality red there only on the
      parallel session's greenlet/uv-group fallout (their fix in
      flight). The analytics §2.1 marks are the only census hits
      remaining in pages/dashboard/.
- [x] patient-adjacent slice 47 (2026-10-01, `63a2f7eed`): pages/components/
      family (4 files, 84 hits) — security-demo, treatment-plans,
      emotion-visualization, analytics-dashboard: light-mode white/gray
      card shells (bg-white dark:bg-gray-800 + shadow-lg) to bg-card +
      hairline border-border with 0px radius; body gray-600/400 to
      muted-foreground; tinted -50/dark:-950 callouts and gradient
      panels (from-purple-50 to-blue-50 & co.) to bg-secondary/bg-card;
      hero gradients (from-blue-600 to-purple-600) flattened to
      bg-card; icon circles to square secondary tiles; accent CTAs
      (blue/green/purple-600) to inverted primary, with the /components
      browse CTA as bg-secondary + hover:accent (the bridge's own
      gray→primary rule had caught it first); bullet glyphs to
      foreground; dark:prose-invert kept (functional prose theming,
      not chrome hue). The chart components these pages wrap
      (DynamicChartComponent, DynamicMultidimensionalEmotionChart,
      DynamicFHEDemo) keep their sanctioned §2.1 marks untouched.
      pages/components is grep-clean. Full vitest: exact 25/3 auth0
      baseline. Note: nodemailer moved 10.0.12 → 10.0.11 via a
      Dependabot merge en route — still within the fixed ≥10.0.6
      range, Trivy-safe.
- [x] patient-adjacent slice 48 (2026-10-01, `b30d3cb99`): pages/blog/
      family (7 files, 77 hits) — the green-phosphor blog surfaces
      (index, [...slug], page/[...page], tag/[tag], tags/index,
      tags/[tag], series/[name]) rebuilt on the token bridge: slate
      shells to card/secondary with border-border hairlines, green
      link/accent text to foreground (hover:underline/foreground),
      body slate-300/400 to foreground/muted-foreground, category and
      tag badges to secondary+foreground, the categoryColors hue map
      and all template-literal `${categoryColor}` usages deleted,
      gradient CTAs (green/emerald, blue) to inverted primary, the
      newsletter card on bg-card with border-input email field and
      ring focus, pill radii to 0px. Decorative choreography deleted:
      the floating-particles system, golden-shimmer gradient text,
      organic-card pulse pseudo-elements, image scale-overs, li
      hover-lifts (−171 net lines). Scoped prose CSS rebuilt on np
      vars — #10b981 links → np-text + np-mid underline, slate
      code/pre/blockquote hexes → np-surface/line/mid, all radii 0.
      E2e structural selectors (article.group, .article-card,
      header.blog-header) untouched. pages/blog is grep-clean.
      Full vitest: exact 25/3 auth0 baseline. Companion CI repair
      `b3769d732`: the Quality gate's version-drift audit crashed on
      the now-committed pnpm 12 lockfile (two YAML documents —
      packageManagerDependencies header + `---` + lockfile body);
      the audit now parseAllDocuments and uses the doc carrying
      lockfileVersion. Audit runs clean post-fix (no new drift; their
      dep churn consolidated many duplicates). CI + Quality green on
      the repair head; all other gates green on `b30d3cb99` where the
      blog changes were exercised.
- [x] patient-adjacent slice 49 (2026-10-01, `328dc97f9`):
      client/[clientId]/temporal-analysis.astro (35 hits) — the
      light-mode page rebuilt on the bridge: white shadow-sm cards to
      bg-card + hairline border-border (all radii 0px, meters square),
      body gray-600 to muted-foreground, intervention meter fills from
      emerald to single-value bg-primary on secondary tracks, category
      icon chips from tinted circles (green/blue/yellow/purple-100/-800)
      to square secondary tiles with foreground glyphs, the analysis
      settings form onto border-input with ring focus and accent-primary
      native checkboxes, the purple submit to inverted primary, and the
      blue-50 info callout to secondary+border with foreground heading.
      The wrapped EmotionTemporalAnalysisChart keeps its sanctioned
      §2.1 marks. The page is grep-clean of chrome hue. Full vitest:
      exact 25/3 auth0 baseline.
- [x] patient-adjacent slice 50 (2026-10-01, `ca08c16bd`):
      lib/analytics/advancedVisualization.tsx (27 hits) — the
      advanced analytics explorer rebuilt on the bridge: white/gray
      shells to bg-card + border-border, meta text to
      muted-foreground, the blue selection panel to secondary+border,
      the interactive toggle to primary-vs-secondary (square, 0px),
      the dark tooltip to inverted bg-foreground/text-background,
      gridlines to muted-foreground/30, insight impact chips on the
      value ladder (quiet secondary → ring border → inverted
      foreground), the More/Less link to foreground+underline. The
      scatter-point hex literals re-encoded on the value ramp per
      §2.1's no-hue-for-UI-state clause — selected fill np-text vs
      np-mid unselected, hover stroke np-text on np-bg (selection is
      UI state; value contrast carries it). Dead exports removed per
      the unused-exports gate: the three data interfaces and
      DataPoint de-exported (zero external consumers; definitions
      kept), default export dropped (both dashboards import the
      named export only). Two pre-existing oxlint warnings in
      untouched tooltip lines left as-is. File grep-clean. Full
      vitest: exact 25/3 auth0 baseline. Landed via merge `259a35c63`
      after the parallel session's e24f4debf raced the first push.
      Companion CI repair `b12d3fa68`: pnpm 12's arg parser rejects
      the bare `-s` shorthand, breaking the build-test Format check
      for every commit since the pnpm 12.6.0 pin landed —
      scripts/ci/format-changed.mjs now uses `--silent` (works on
      pnpm 11 and 12). CI + Quality + Security green on `b12d3fa68`;
      the parallel session's ~5-min auto-commit loop kept cancelling
      Playwright/Vercel mid-flight on every head — delegated to the
      next stable head (e2e selector surface verified untouched).
- [x] patient-adjacent slice 51 (2026-10-01, landed inside the parallel
      session's sweep `cc4cf414d`): pages/simulator/index.astro (17) +
      pages/analytics/comparative-progress.astro (12) — both small
      light-mode pages rebuilt on the bridge: white/gray shells to
      bg-card + border-border (shadow-sm removed), breadcrumbs and
      body to muted-foreground/foreground, scenario tiles to
      border-border + hover:bg-secondary, blue links to foreground +
      hover:underline, the blue info panel to secondary+border with
      a foreground heading. All radii 0px. Both pages grep-clean;
      no chart marks, no test references. Full vitest: exact 25/3
      auth0 baseline. NOTE: the migration was committed by the
      parallel session's ~5-min auto-commit sweep (their authorship)
      before I could stage it — content verified intact in the
      commit, same class as slices 4/21/31.
- [x] patient-adjacent slice 52 (2026-10-01, `c6234f1fb`): therapists +
      dynamic-components migration, dead-code deletion, census
      reclassification — pages/therapists.astro (10 hits): slate cards
      to bg-card + border-border (shadow-lg/xi choreography removed,
      all radii 0px), headings to foreground, body to
      muted-foreground, the blue CTA banner to secondary+border, the
      blue outline button to a border-ring ghost with hover:accent.
      lib/utils/dynamic-components.tsx (10 hits): loading placeholders
      to bg-secondary with muted-foreground text, the error boundary
      to secondary+border-ring with weight-encoded error text; all
      14 Dynamic* wrappers verified consumed (exports gate green).
      DEAD-CODE DELETION (owner-approved): lib/metaaligner/
      explainability/visualization.tsx (507 lines, 10 census hits +
      score-tier hexes) — zero importers anywhere, verified twice
      incl. tests/. RECLASSIFIED as sanctioned §2.1 marks (census
      bookkeeping per the slice-5 record, no code change):
      admin/system-health.astro's 11 remaining hits — the memory/
      health gauge tier fills in JS class lists (healthy normalized
      to primary). Full vitest: exact 25/3 auth0 baseline.
- [x] patient-adjacent slice 53 (2026-10-01, `4dc06a46a`): the final
      census tail sweep (37 files, 104 debt hits → 0) — layout body
      shells (Blog/Chat/Documentation) to bg-background +
      text-foreground with selection:bg-primary/30; AdminLayout focus
      rings to ring tokens; book rebuilt like the therapists twin
      (bg-card + hairline, shadow removed); prose pages (privacy,
      terms, cookie-policy, accessibility) to muted-foreground body
      with foreground + hover:underline links; reset-password +
      ErrorBoundary banners to secondary + border-ring with
      weight-encoded error text; 404/500 CTAs to inverted primary;
      unauthorized's warning banner and green/slate button pair to
      secondary+ring + primary/secondary ghosts; mental-health
      chat-utils icons to foreground (shape carries identity);
      live-region-demo progress to a square primary fill on a
      secondary track; docs/index filter pills to secondary +
      hover:accent; admin consent/security left-rule callouts to
      border-ring/border-border; BAA management priority ladders
      re-encoded on the value ramp (border-ring / border-
      foreground/60 / border-border; text foreground / 80 /
      muted); engagement percentage tiers to foreground/80/muted;
      dashboard-updater security levels to the text value ladder;
      treatment-planning/treatment-forecast scoped @apply CSS to
      the bridge tokens (@apply needs `#` sed delimiters — the
      `@`-delimiter collision aborts GNU sed's whole script).
      All radii 0px. Full vitest: exact 25/3 auth0 baseline (one
      transient 4th-file flake appeared and vanished across three
      runs; final full run clean). The 11 oxlint warnings on the
      touched-file list were all in the parallel session's ai/
      submodule dirt — zero in the migrated files.
      Repair `7d121c6f4`: CI's unused-exports gate caught two dead
      exports in lib/providers/ErrorBoundary.tsx (withErrorBoundary
      HOC + useErrorBoundary hook — zero importers; lib/error/ has
      its own separate copies); both removed. Local gate had passed
      on a stale changed-file base (the slice-27/38 trap recurring).
- [x] broader pages/ census (CLOSED 2026-10-01, post-slice-53): the
      4-dir census (pages + lib + styles + layouts) now measures 27
      raw hits in 8 files, every one sanctioned or false-positive —
      system-health gauges (11, slice-52 record), dashboard
      bias-detection/analytics (5, slice-46 SERIES_COLORS +
      DISTRIBUTION_TIER_DOT), ai-explainability gauges (3, slice 5),
      risk-assessment severity bars (3, slice 5), demo-analytics
      funnel fill (1, slice 5), all-demos-analytics A-B fill (1,
      slice 5), cache hit-ratio tiers (2, slice 5), and
      universal-demo-analytics's querySelector detection string (1 —
      detection logic, not chrome). **Chrome-hue debt outside
      components/ is zero; the census scope is fully drift-clean,
      matching the components/ closure at slice 42.**
- [x] patient-adjacent slice 54 (2026-10-01, `98d7d898c`, owner-approved
      deletion): the apps/web/src/simulator/ island was a dead prototype
      family, not drift debt — the pages/simulator route is a static
      description page with no island script, and no component was
      imported from outside the directory (no static, dynamic, or test
      imports; no Astro client: mounts; verified twice). The only live
      consumers were four utility/type imports. Deleted 40 files /
      9,213 lines: all 19 components + barrel + component tests
      (incl. EnhancedSimulationContainer 38 hits, RealTimeFeedbackPanel
      30, FeedbackPanel 25, ScenarioSelector 19, ScenarioInfo 15,
      VideoDisplay 13, ControlPanel 9, EmotionDisplay 8, RealTimePrompts
      5, EmpathyMeter 1 + 12 hex, EmotionSimulator, SimulationContainer,
      SimulationControls, ResistanceMonitor + 20 hex, EmotionAnalysis,
      EmotionDetector, SpeechPatternDisplay, TechniqueDisplay), the
      context/services/data layers, backup-index.js (the non-JSX
      placeholder stub that prompted the inspection — zero importers),
      the stub exports in index.tsx (identical placeholder content),
      five unreachable hooks, and the scenario utils (218 lines).
      Kept: utils/privacy (ConsentDialog + anonymization pipeline),
      utils/speechRecognition (SupervisorFeedback),
      hooks/useAnonymizedMetrics (MetricsDialog), the types.ts →
      types/ bridge, and their tests; index.tsx + hooks/index.ts trimmed
      to the single live re-export (exports gate green); README
      rewritten for the remainder. The island's 176 census hits and 32
      raw hex literals are gone without migrating dead code. Full
      vitest: auth0 baseline unchanged (exact 25/3); 28 passing tests
      retired with the six deleted test files. **With this, the
      chrome-hue migration is complete across every surveyed scope:
      components/, pages/, lib/, styles/, layouts/ — no known
      unsanctioned hue debt remains anywhere in apps/web/src.**

### A. Competing theme files (no single source of truth)

The five CSS files referenced below were retired in Phase 4 (see above).
This appendix entry is kept as a historical record of why each existed and
where the live equivalent now lives:

- `uno.config.ts` — superseded by `src/styles/np-tokens.css` as the single
  token source of truth. Any `:root` overrides remaining in `uno.config.ts`
  are ignored at runtime because `np-tokens.css` is loaded last in
  `main.css` (this PR).
- `public/css/variables.css` — historical origin of the OKLCH ramp; the
  canonical tokens have moved to `src/styles/np-tokens.css`. The file was
  deleted in Phase 4.
- `public/css/borders.css`, `brutalist-minimal.css`, `button-fixes.css`,
  `design-system.css` — retired in Phase 4; effective radius scale is now
  0px across `--radius-sm/md/lg` (alias block in `np-tokens.css`) and the
  legacy emerald `--border-accent` no longer applies because the
  consumers were also deleted.

If a future temptation arises to re-introduce any of the retired files
or their radius scale, restore the alias block semantics first: every
radius maps to 0px and every accent maps to the muted NP token.

### B. Emerald accent surviving in ~30 components

`grep` for `10b981 | 34d399 | rgba(16,185,129)` hits: status indicators
(`StatusIndicator.astro`, `MindMirrorDashboard.tsx`,
`MentalHealthHistoryChart.tsx`), agent/monitoring dashboards
(`AgentMonitorDemo`, `AgentPerformanceHeatmap`, `WebPerformanceDashboard`),
marketing/showcase surfaces (`mizu/Hero`, `marketing/HowItWorks`,
`GradientAnimation.astro`, `ConversionTrackingExample`), and several
demo/gallery pages.

**Treatment:** value-contrast is the replacement vocabulary (see §2, "The
Zero-Chroma Rule" and §4). A status dot that was emerald becomes a
filled-vs-hollow token glyph; a selected-state border goes from accent to
`oklch(0.70 0 0)` focus neutral. Status _semantics_ (success / error / warning)
must encode through icon + weight + surface, not hue — see the contrast-verify
mandate in PRODUCT.md Accessibility. This is real design work per component, not
a global find-replace, and belongs to a dedicated `harden` / `colorize`-inverse
pass, not this init.

### C. Shadows present

`public/styles/global.css` and related define `--box-shadow-elevated` (e.g.
`0 4px 6px -1px rgba(0,0,0,0.1)`). Doctrine: tonal layer only, no shadows (§4).

**Fix direction:** delete the shadow tokens; replace every `box-shadow:`
elevation with a `surface` → `elevated` background shift.

### What this init did NOT do

This init refreshed the _documents_ to match the confirmed brand decisions. It
did not touch the codebase. Closing the three gaps above (A consolidation, B
emerald removal, C shadow removal) is follow-up implementation work — see Step 7
for the commands that own it.
