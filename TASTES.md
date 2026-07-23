# TASTES.md

Aesthetic guidelines and design constraints for Pixelated Empathy.

> **Doctrine in effect:** Neutral Precision — "The Quiet Instrument." This file
> reflects what is actually shipping, not an aspirational brand. If you change
> the design system, change this file in the same PR.

---

## 1. Visual & Color System ("Neutral Precision")

Zero-chroma editorial system. All colors derive from the OKLCH grayscale ramp
defined in `src/styles/np-tokens.css`.

### Surfaces

- **Bg Primary**: `oklch(0.1 0 0)` — deep space void (page canvas)
- **Bg Secondary / Surface**: `oklch(0.14 0 0)` — elevated cards, the
  transcript proof object, the contact form
- **Bg Elevated**: `oklch(0.18 0 0)` — supervisor annotation row in the
  transcript
- **Borders / dividers**: `rgba(255, 255, 255, 0.06)` on dark,
  `rgba(0, 0, 0, 0.08)` on light

### Text

- **Text Primary**: `oklch(0.93 0 0)` (dark) / `oklch(0.15 0 0)` (light)
- **Text Secondary / Muted**: `oklch(0.55 0 0)` — labels, captions, the lede
- **Text Mid**: `oklch(0.7 0 0)` (dark) / `oklch(0.45 0 0)` (light)

### Accent

There is no chromatic accent. **No orange, no blue, no green.** The chromatic
guardrail in `np-tokens.css` (`--np-selection`, the zero-chroma rule block)
enforces this at the token level. The legacy alias `--accent-primary` exists
in `np-tokens.css` solely to absorb marketing.css's variable references; it
resolves to `var(--np-text)` (light gray on dark), not to any colored value.

If a clinical surface genuinely needs a semantic accent (e.g. a crisis /
risk signal), the decision must be made explicitly in a separate pass and
tokenized before shipping.

---

## 2. Typography

Three families, three jobs. No fourth family without a real contrast reason.

- **Display / Heading**: Fraunces Variable (serif) — headlines, card titles,
  CTA section titles. Weight 350 on display, 400 on medium. Light-on-dark
  weight compensation: 350 reads as ~400 on light. Tracking `-0.022em` on
  display, `-0.018em` on medium. `text-wrap: balance` on hero and card titles.
- **Body / Paragraph**: Public Sans (humanist sans) — ledes, card copy,
  transcript dialog. Weight 400. Lede line-height `1.55` (short-form bridge
  spec). Long-form body uses `1.65`. `text-wrap: pretty` on ledes.
- **UI / Badge**: JetBrains Mono Variable — eyebrows, labels, buttons,
  timestamps, code blocks, supervisor annotations. Weight 450–700. All caps
  with `0.12em–0.16em` tracking. The mono body in the transcript uses weight
  450 (not 400) so it does not read thin on dark.

Measure: 60–68ch on ledes and cards. Hero h1 clamped `2.25–3.6rem` with a max
measure of 16ch. Medium h2 clamped `1.5–2.15rem` with a max measure of 22ch.

---

## 3. Structural Constraints (Technical Brutalism)

- **Flat Over Round**: Strict minimal border-radius. Default `0px` everywhere.
  Pill shapes, rounded buttons, and gradient blobs are out of scope.
- **No Heavy Shadows**: Never soft diffuse box-shadows for elevation. Rely
  on 1px border outlines, surface ramps (`--np-bg` → `--np-surface` →
  `--np-elevated`), or solid offset shadows.
- **Grid Exposure**: Page-level grids may use thin 1px `--np-line` borders,
  dotted backgrounds (`radial-gradient`), or hairline rules as visual texture.
  Hero panels use a subtle 2.75rem grid mask fading to transparent.
- **Component Shape**: Cards are content-shaped (discrete, scannable).
  One card inside another is never right; flatten with type and dividers
  instead. Wrappers that exist only to add margin should be deleted.

---

## 4. Interaction & Motion

- **Hover states**: 150ms `var(--np-ease)`. On cards and CTAs, a `1px`
  background lift (`var(--np-surface)`) and a `translateY(-1px)` on the
  primary button. No permanent elevation on any non-hovered control.
- **Focus rings**: 2px solid `var(--np-mid)` with 3px offset, on **all**
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

Three CSS files, three jobs. Do not collapse them.

- **`src/styles/np-tokens.css`** — Token source of truth: colors, type, space,
  radii, motion, z-index, light/dark theme. The `:root` and `[data-theme=light]`
  blocks. Legacy compatibility aliases for the marketing theme
  (`--accent-primary`, `--accent-primary-rgb`, `--font-body`, `--ease-out`).
- **`src/styles/np-landing.css`** — Homepage (`/`) styles. Loaded only by
  `src/pages/index.astro`. Defines `.np-page`, `.np-hero`, `.np-hero__transcript`,
  the proof-object grid, the CTA band, the help-link footer.
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

- **Homepage** (`/`): brand register. Fraunces display 68px hero, transcript
  proof object on the right (Session 04 · Rupture Repair), single dominant
  action, help-link footer with 4 destination cards.
- **Marketing pages**: brand register with a 2-tier scale. Display h1 at
  57.6px, medium h2 at 22.4–34.4px, lede 16px. Each page carries a
  per-page proof object in the hero (4 capability tracks for /features,
  3 trust topics for /trust, founder card for /team, etc.) — not the
  generic 3-up stats grid that was there before.
- **Contact** (`/contact`): Configure register. Hero proof object previews
  the form (what to bring); the form is below in a `marketing-card` with
  visible 1px borders, 16px font, 2px focus ring.

---

## 7. Drift to Refuse

- Anything orange, blue, green, or purple on a public surface — unless an
  explicit accent decision has been made and tokenized.
- Gradient hero blobs, glassmorphism, pill buttons, centered-icon-card rows.
- Lorem ipsum, "Welcome to [Product]" copy, exclamation points.
- Display fonts in product labels. Mono in display headlines.
- "AI-y" decorative motifs (cyan gradient rings, animated cursor arrows).
- The "Dark Metal" orange doctrine from the prior TASTES.md — superseded.
  Do not reintroduce `#ff8533` or any other chromatic accent without a
  deliberate product decision.
