---
name: Pixelated Empathy
description: Clinical AI platform for therapist training and supervision. Dark-first neutral precision.
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

A clinical AI training platform designed for trust, not spectacle. Dark by default, neutral by
doctrine. Every pixel earns its place through clarity, hierarchy, and restraint — never through
decoration.

This system rejects the "Dark Metal" identity that preceded it (aggressive near-black, electric
orange, developer-tool energy) in favor of something quieter: near-chroma-0 grays, precise
typography, and the confidence that content is the only color that matters. The interface should
feel like a well-made tool — present when needed, invisible when not.

The primary mode is dark, and always will be. Therapists and supervisors use this platform in
low-light environments (evening sessions, focused supervision, late charting). A dark screen
that recedes is more comfortable for extended use. Light mode exists for accessibility and
daytime context-switching, but it is the secondary citizen — flatter, cooler, designed to be
less visually interesting so the dark mode remains the intended experience.

**Key Characteristics:**
- Zero-chroma grayscale palette (OKLCH C = 0 across all tokens)
- Typography is the full palette — weight, size, and spacing replace hue
- Flat by design: 0px radius everywhere, no shadows
- Dark-first: dark mode is the authored state; light mode is the inverse
- Motion is deliberate and minimal — state changes only, no choreography
- Content (client data, session notes, charts) is the color

## 2. Colors

Zero chroma. No accent. The grayscale ramp is the full palette — emphasis comes from value
contrast, not hue.

### Dark Mode (primary)

| Token | Value | Role |
|---|---|---|
| Body bg | `oklch(0.10 0 0)` / `#1a1a1a` | Primary canvas |
| Surface | `oklch(0.14 0 0)` / `#242424` | Cards, containers, secondary panels |
| Elevated | `oklch(0.18 0 0)` / `#2e2e2e` | Modals, dropdowns, hover states |
| Text | `oklch(0.93 0 0)` / `#ededed` | Body copy, headings |
| Muted | `oklch(0.55 0 0)` / `#8c8c8c` | Labels, captions, placeholder text |
| Line | `rgba(255, 255, 255, 0.06)` | Borders, dividers, hairline rules |

### Light Mode (secondary)

| Token | Value | Role |
|---|---|---|
| Body bg | `oklch(0.98 0 0)` / `#fafafa` | Primary canvas |
| Surface | `oklch(0.95 0 0)` / `#f2f2f2` | Cards, containers |
| Elevated | `oklch(0.92 0 0)` / `#ebebeb` | Modals, dropdowns |
| Text | `oklch(0.15 0 0)` / `#262626` | Body copy, headings |
| Muted | `oklch(0.55 0 0)` / `#8c8c8c` | Labels, captions |
| Line | `rgba(0, 0, 0, 0.08)` | Borders, dividers |

### The Zero-Chroma Rule

No color enters the system through design tokens. Not as an accent, not as a background tint,
not as a hover state. The only color in the interface is the content the user brings (session
data, client profiles, charts, evidence). If a surface needs emphasis, use value contrast — a
darker surface, a heavier weight, a thicker rule. If it still needs color, something is wrong
with the information architecture.

## 3. Typography

**Display Font:** Fraunces Variable (with Georgia, serif fallback)
**Body Font:** Public Sans (with system-ui, sans-serif fallback)
**Label/Mono Font:** JetBrains Mono Variable (with ui-monospace, monospace fallback)

**Character:** Fraunces brings warmth and personality at the display level — it's the human
element in an otherwise neutral system. Public Sans is invisible and efficient, carrying the
body without drawing attention to itself. JetBrains Mono signals precision and evidence —
used for data, labels, code, and any information that needs to read as factual.

### Hierarchy

- **Display** (`Fraunces`, weight 350, `clamp(2.5rem, 5vw, 4.5rem)`, line-height 1.05,
  `-0.02em` letter-spacing): Hero and section headings.
- **Headline** (`Fraunces`, weight 400, `clamp(1.75rem, 3.5vw, 2.75rem)`, line-height 1.15):
  Major section titles, modal headers.
- **Title** (`Public Sans`, weight 600, `1.125rem`, line-height 1.3): Card titles,
  subsection headers.
- **Body** (`Public Sans`, weight 400, `1rem` / `16px`, line-height 1.6, max-width 68ch):
  Primary reading text.
- **Label** (`JetBrains Mono`, weight 450, `0.75rem` / `12px`, `0.04em` letter-spacing,
  uppercase): Field labels, metadata, timestamps, data keys.
- **Data** (`JetBrains Mono`, weight 400, `0.875rem` / `14px`, line-height 1.5): Numerical
  data, code blocks, session transcripts.

### The Content-is-Type Rule

Heading weight is the emphasis tool, not color. A heading in weight 600 reads as more
important than one in weight 400. Never underline, italicize, or colorize a heading for
emphasis — weight and size alone carry the hierarchy.

## 4. Elevation

Flat by default. The interface uses tonal layering — three surface levels (bg / surface /
elevated) — to convey depth. No shadows, no blurs, no glass effects.

A card is `surface` (`oklch(0.14)`) on `bg` (`oklch(0.10)`). A modal is `elevated`
(`oklch(0.18)`) on `overlay` (the bg at 75% opacity). The contrast differential is small
(0.04 per step) — enough to register, not enough to shout.

### The Flat-By-Default Rule

Surfaces are flat at rest. Shadows are never used as decoration. The `elevated` token is the
depth system — not `box-shadow`, not `backdrop-filter`, not `transform`. If a surface needs
to feel higher, make it lighter. If it needs to feel lower, make it darker. That is the full
vocabulary.

## 5. Components

### Buttons

- **Shape:** Hard edges (0px radius). Full-height hit targets (44px minimum).
- **Primary:** `elevated` bg (`oklch(0.18)`), `text` color (`oklch(0.93)`), 12px 24px
  padding. On hover: moves to `oklch(0.22)` — the lightest surface in the system.
  On click: `oklch(0.15)` — back toward bg.
- **Ghost:** Transparent bg, `muted` text (`oklch(0.55)`). On hover: `muted` → `text`,
  bg shifts to `oklch(0.16)`.
- **Link:** Text only, `text` color, underline on hover via `background-size` animation
  (1px from bottom). Same pattern as body links.
- **Focus:** `1px solid oklch(0.70 0 0)` outline, 3px offset. High contrast, no color
  dependency.
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
- **Focus:** Hard outline (`1px solid oklch(0.70 0 0)`, 3px offset). No glow, no ring.
- **Placeholder:** `muted` color (`oklch(0.55)`). No opacity trick.
- **Error:** Border shifts to `oklch(0.80 0 0)`, plus a `JetBrains Mono` label below.
  No red — contrast is the signal.
- **Disabled:** `opacity: 0.35`.

### Navigation

- **Desktop:** Left sidebar (dashboard) or top bar (public pages). Sidebar: `bg` background,
  240px wide. Top bar: `surface` background, full width, hairline bottom border.
- **Items:** `JetBrains Mono` label at 12px, 0.04em tracking, uppercase. Active: `text`
  color, no indicator. Inactive: `muted` color. Hover: `surface` → `elevated` bg.
- **Mobile:** Bottom tab bar or slide-out drawer, same token system.

### Badges / Chips

- **Style:** `surface` bg, `1px solid line` border, `JetBrains Mono` 11px uppercase label,
  4px 8px padding. A chip is defined by its border, not its color.
- **Active:** Border shifts to `oklch(0.50 0 0)`, bg stays the same.

## 6. Do's and Don'ts

### Do

- **Do** use value contrast as the primary emphasis tool. A surface at `oklch(0.18)` is
  "higher" than one at `oklch(0.14)`. Lean into this.
- **Do** let Fraunces carry the personality at the display level. It is the only expressive
  element in the system.
- **Do** use JetBrains Mono for anything that needs to read as factual — labels, data,
  timestamps, status.
- **Do** keep every radius at 0px. Hard edges signal precision.
- **Do** use the `surface` → `elevated` contrast for depth. No shadows needed.
- **Do** design for dark mode first. Light mode is the accessibility fallback — it should
  feel quieter and less visually rich.
- **Do** test every text/background pair for WCAG AA contrast (4.5:1 body, 3:1 large text).
  The neutral ramp makes this easy — stay on it.

### Don't

- **Don't** add any color to the design system tokens. Not an accent, not a hover tint, not
  a brand underline. Content is the color.
- **Don't** use shadows, box-shadows, or blur for elevation. Tonal layering is the entire
  depth vocabulary.
- **Don't** use border-radius greater than 0px on anything. Not buttons, not cards, not
  inputs. Not 2px, not 4px, not "barely rounded."
- **Don't** use the old "Dark Metal" orange accent (`#ff8533`). Its energy is wrong for
  this platform.
- **Don't** use the old emerald brand tokens (`#10b981`) as accent. The system has no
  accent.
- **Don't** use glass effects, backdrop-filter, gradients, or any decorative surface
  treatment.
- **Don't** use uppercase tracking on Public Sans body text — it reduces readability.
  Reserve uppercase + tracking for JetBrains Mono labels only.
- **Don't** animate layout properties. Only `opacity` and `transform` transitions.
- **Don't** use icons as decoration. Every icon should carry information — a status, an
  action, a signal.
