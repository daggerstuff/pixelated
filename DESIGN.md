---
name: Pixelated Empathy
description:
  Clinical AI platform for therapist training and supervision. Dark-first
  neutral precision.
colors:
  neutral-bg: oklch(0.10 0 0)
  neutral-surface: oklch(0.14 0 0)
  neutral-elevated: oklch(0.18 0 0)
  neutral-text: oklch(0.93 0 0)
  neutral-muted: oklch(0.55 0 0)
  neutral-line: rgba(255, 255, 255, 0.06)
  light-bg: oklch(0.98 0 0)
  light-surface: oklch(0.95 0 0)
  light-text: oklch(0.15 0 0)
typography:
  display:
    fontFamily: '"Fraunces Variable", Georgia, serif'
    fontWeight: 350
    lineHeight: 1.05
    letterSpacing: -0.02em
    fontVariation: '"SOFT" 0, "WONK" 0'
  body:
    fontFamily: '"Public Sans", system-ui, sans-serif'
    fontWeight: 400
    lineHeight: 1.6
  mono:
    fontFamily: '"JetBrains Mono Variable", ui-monospace, monospace'
    fontWeight: 400
    lineHeight: 1.5
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
    backgroundColor: oklch(0.93 0 0)
    textColor: oklch(0.10 0 0)
    rounded: 0px
    padding: 12px 24px
  button-ghost:
    backgroundColor: transparent
    textColor: oklch(0.93 0 0)
    rounded: 0px
    padding: 12px 24px
---

# Design System: Pixelated Empathy

## 1. Overview

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

- Zero-chroma grayscale palette (OKLCH C = 0 across all tokens)
- Typography is the full palette — weight, size, and spacing replace hue
- Flat by design: 0px radius everywhere, no shadows
- Dark-first: dark mode is the authored state; light mode is the inverse
- Motion is deliberate and minimal — state changes only, no choreography
- Content (client data, session notes, charts) is the color

## 2. Colors

Zero chroma. No accent. The grayscale ramp is the full palette — emphasis comes
from value contrast, not hue.

### Dark Mode (primary)

| Token    | Value                         | Role                                |
| -------- | ----------------------------- | ----------------------------------- |
| Body bg  | `oklch(0.10 0 0)` / `#1a1a1a` | Primary canvas                      |
| Surface  | `oklch(0.14 0 0)` / `#242424` | Cards, containers, secondary panels |
| Elevated | `oklch(0.18 0 0)` / `#2e2e2e` | Modals, dropdowns, hover states     |
| Text     | `oklch(0.93 0 0)` / `#ededed` | Body copy, headings                 |
| Muted    | `oklch(0.55 0 0)` / `#8c8c8c` | Labels, captions, placeholder text  |
| Line     | `rgba(255, 255, 255, 0.06)`   | Borders, dividers, hairline rules   |

### Light Mode (secondary)

| Token    | Value                         | Role                |
| -------- | ----------------------------- | ------------------- |
| Body bg  | `oklch(0.98 0 0)` / `#fafafa` | Primary canvas      |
| Surface  | `oklch(0.95 0 0)` / `#f2f2f2` | Cards, containers   |
| Elevated | `oklch(0.92 0 0)` / `#ebebeb` | Modals, dropdowns   |
| Text     | `oklch(0.15 0 0)` / `#262626` | Body copy, headings |
| Muted    | `oklch(0.55 0 0)` / `#8c8c8c` | Labels, captions    |
| Line     | `rgba(0, 0, 0, 0.08)`         | Borders, dividers   |

### The Zero-Chroma Rule

No color enters the system through design tokens. Not as an accent, not as a
background tint, not as a hover state. The only color in the interface is the
content the user brings (session data, client profiles, charts, evidence). If a
surface needs emphasis, use value contrast — a darker surface, a heavier weight,
a thicker rule. If it still needs color, something is wrong with the information
architecture.

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

**Display Font:** Fraunces Variable (with Georgia, serif fallback) **Body
Font:** Public Sans (with system-ui, sans-serif fallback) **Label/Mono Font:**
JetBrains Mono Variable (with ui-monospace, monospace fallback)

**Character:** Fraunces brings warmth and personality at the display level —
it's the human element in an otherwise neutral system. Public Sans is invisible
and efficient, carrying the body without drawing attention to itself. JetBrains
Mono signals precision and evidence — used for data, labels, code, and any
information that needs to read as factual.

### Hierarchy

- **Display** (`Fraunces`, weight 350, `clamp(2.5rem, 5vw, 4.5rem)`, line-height
  1.05, `-0.02em` letter-spacing): Hero and section headings.
- **Headline** (`Fraunces`, weight 400, `clamp(1.75rem, 3.5vw, 2.75rem)`,
  line-height 1.15): Major section titles, modal headers.
- **Title** (`Public Sans`, weight 600, `1.125rem`, line-height 1.3): Card
  titles, subsection headers.
- **Body** (`Public Sans`, weight 400, `1rem` / `16px`, line-height 1.6,
  max-width 68ch): Primary reading text.
- **Label** (`JetBrains Mono`, weight 450, `0.75rem` / `12px`, `0.04em`
  letter-spacing, uppercase): Field labels, metadata, timestamps, data keys.
- **Data** (`JetBrains Mono`, weight 400, `0.875rem` / `14px`, line-height 1.5):
  Numerical data, code blocks, session transcripts.

### The Content-is-Type Rule

Heading weight is the emphasis tool, not color. A heading in weight 600 reads as
more important than one in weight 400. Never underline, italicize, or colorize a
heading for emphasis — weight and size alone carry the hierarchy.

## 4. Elevation

Flat by default. The interface uses tonal layering — three surface levels (bg /
surface / elevated) — to convey depth. No shadows, no blurs, no glass effects.

A card is `surface` (`oklch(0.14)`) on `bg` (`oklch(0.10)`). A modal is
`elevated` (`oklch(0.18)`) on `overlay` (the bg at 75% opacity). The contrast
differential is small (0.04 per step) — enough to register, not enough to shout.

### The Flat-By-Default Rule

Surfaces are flat at rest. Shadows are never used as decoration. The `elevated`
token is the depth system — not `box-shadow`, not `backdrop-filter`, not
`transform`. If a surface needs to feel higher, make it lighter. If it needs to
feel lower, make it darker. That is the full vocabulary.

## 5. Components

### Buttons

- **Shape:** Hard edges (0px radius). Full-height hit targets (44px minimum).
- **Primary:** `elevated` bg (`oklch(0.18)`), `text` color (`oklch(0.93)`), 12px
  24px padding. On hover: moves to `oklch(0.22)` — the lightest surface in the
  system. On click: `oklch(0.15)` — back toward bg.
- **Ghost:** Transparent bg, `muted` text (`oklch(0.55)`). On hover: `muted` →
  `text`, bg shifts to `oklch(0.16)`.
- **Link:** Text only, `text` color, underline on hover via `background-size`
  animation (1px from bottom). Same pattern as body links.
- **Focus:** `1px solid oklch(0.70 0 0)` outline, 3px offset. High contrast, no
  color dependency.
- **Disabled:** `opacity: 0.35`, `pointer-events: none`.

### Cards / Containers

- **Corner Style:** 0px radius.
- **Background:** `surface` (`oklch(0.14)`) on `bg` (`oklch(0.10)`).
- **Border:** `1px solid line` (`rgba(255,255,255,0.06)`).
- **Shadow Strategy:** None. See Elevation — tonal layering only.
- **Internal Padding:** 24px (spacing.lg). Tightens to 16px on narrow viewports.

### Inputs / Fields

- **Style:** `1px solid line` border on `surface` bg. On focus: border shifts to
  `oklch(0.50 0 0)` — the only mid-tone signal in the system.
- **Focus:** Hard outline (`1px solid oklch(0.70 0 0)`, 3px offset). No glow, no
  ring.
- **Placeholder:** `muted` color (`oklch(0.55)`). No opacity trick.
- **Error:** Border shifts to `oklch(0.80 0 0)`, plus a `JetBrains Mono` label
  below. No red — contrast is the signal.
- **Disabled:** `opacity: 0.35`.

### Navigation

- **Desktop:** Left sidebar (dashboard) or top bar (public pages). Sidebar: `bg`
  background, 240px wide. Top bar: `surface` background, full width, hairline
  bottom border.
- **Items:** `JetBrains Mono` label at 12px, 0.04em tracking, uppercase. Active:
  `text` color, no indicator. Inactive: `muted` color. Hover: `surface` →
  `elevated` bg.
- **Mobile:** Bottom tab bar or slide-out drawer, same token system.

### Badges / Chips

- **Style:** `surface` bg, `1px solid line` border, `JetBrains Mono` 11px
  uppercase label, 4px 8px padding. A chip is defined by its border, not its
  color.
- **Active:** Border shifts to `oklch(0.50 0 0)`, bg stays the same.

## 6. Do's and Don'ts

### Do

- **Do** use value contrast as the primary emphasis tool. A surface at
  `oklch(0.18)` is "higher" than one at `oklch(0.14)`. Lean into this.
- **Do** let Fraunces carry the personality at the display level. It is the only
  expressive element in the system.
- **Do** use JetBrains Mono for anything that needs to read as factual — labels,
  data, timestamps, status.
- **Do** keep every radius at 0px. Hard edges signal precision.
- **Do** use the `surface` → `elevated` contrast for depth. No shadows needed.
- **Do** design for dark mode first. Light mode is the accessibility fallback —
  it should feel quieter and less visually rich.
- **Do** test every text/background pair for WCAG AA contrast (4.5:1 body, 3:1
  large text). The neutral ramp makes this easy — stay on it.

### Don't

- **Don't** add any color to the design system tokens. Not an accent, not a
  hover tint, not a brand underline. Content is the color.
- **Don't** use shadows, box-shadows, or blur for elevation. Tonal layering is
  the entire depth vocabulary.
- **Don't** use border-radius greater than 0px on anything. Not buttons, not
  cards, not inputs. Not 2px, not 4px, not "barely rounded."
- **Don't** use the old "Dark Metal" orange accent (`#ff8533`). Its energy is
  wrong for this platform.
- **Don't** use the old emerald brand tokens (`#10b981`, `#34d399`,
  `rgba(16,185,129,0.3)`) as accent. The system has no accent. In the present
  codebase these survive in ~30 components (hover borders, status dots,
  marketing tiles); see the Drift Appendix — removing them is open work, not
  permission to add more.
- **Don't** reach for a cream / sand / paper body background or gradient-text
  headings. The warm-neutral AI default reads as machine-generated, not
  clinical.
- **Don't** build the SaaS dark-dashboard pastiche — metric-stack hero,
  identical icon-card grids, glass cards, button gradients. Familiarity is fine;
  the undifferentiated template is the anti-reference.
- **Don't** use glass effects, backdrop-filter, gradients, or any decorative
  surface treatment.
- **Don't** use uppercase tracking on Public Sans body text — it reduces
  readability. Reserve uppercase + tracking for JetBrains Mono labels only.
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
- [ ] **Phase 3 — surgical strip (in progress).** Scope narrowed from ~150
      chrome-hue files to a surgical set: demo/, marketing/, mizu/, showcase
      surfaces + the ~10 token-source CSS files (shadows/radius/emerald
      definitions). Admin/crisis/auth/consent/session chrome hue remains as
      **standing debt** tracked below — not permission to extend it; it is
      deferred work, not abandoned doctrine.
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

### Standing debt (deferred from Phase 3, tracked not forgotten)

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
