# Pixelated Empathy Design Direction

Reference:
[Atomist Astro preview](https://shadcnspace.com/templates/preview/atomist-astro)

## Mission

Create a dark, polished SaaS landing system for Pixelated Empathy that borrows
the Atomist template's confidence: black canvas, sunset-orange energy, rounded
shadcn-style surfaces, centered hero hierarchy, and crisp product storytelling.

## Brand

- Product/brand: Pixelated Empathy
- Audience: therapist training teams, clinical supervisors, technical buyers,
  and institutional evaluators
- Product surface: marketing site, demo pages, trust pages, and
  documentation-adjacent product education
- Design intent: advanced AI infrastructure that feels sharp, premium, composed,
  and credible

## April 2026 Design & Engineering Refresh

- Design systems are treated as living infrastructure, not a finished
  deliverable.
- Architecture decisions are trade-off based: choose boundaries by team
  autonomy, release cadence, and data flow rather than trends.
- For this stack, a modular monolith pattern is preferred before service-level
  fragmentation unless independent scale demands full separation.
- API and data contracts should be contract-first, with OpenAPI as the source of
  truth before feature code lands.
- Security, reliability, and accessibility are default requirements, not
  deferred polish.

## Visual Direction

- Use a dark-first SaaS shell with a dark-metal background, subtle grid/glow
  texture, and sunset-orange highlights.
- Favor polished rounded surfaces over raw brutalist slabs: cards, nav, CTAs,
  badges, and panels should feel engineered and deliberate.
- Keep layouts spacious but information-dense: strong hero, short proof
  sections, feature cards, comparison/pricing-style rows, and final CTA.
- Use gradient emphasis sparingly for hero words, icon marks, active nav state,
  and primary CTA glow.
- Preserve clinical seriousness. The page may feel futuristic, but it must not
  feel playful, neon, wellness-coded, or gamified.
- Design tokens should use semantic naming (`role/state/intent`) so humans and
  automation can reuse them consistently.

## Design Tokens

- `color.canvas`: dark metal background, lighter than pure black and never muddy
  brown.
- `color.surface`: elevated gunmetal panel with a clean cool-grey read.
- `color.surfaceSoft`: translucent dark-metal card surface.
- `color.border`: low-contrast brushed-steel border.
- `color.borderActive`: sunset-orange active border.
- `color.textPrimary`: warm off-white.
- `color.textSecondary`: muted pale steel.
- `color.textMuted`: subdued dark-silver grey.
- `color.accent`: sunset orange, vivid and warm, not yellow and not poop brown.
- `color.accentHover`: brighter mandarin orange.
- `color.accentSoft`: transparent sunset-orange wash for pills/cards.
- `radius.panel`: large rounded rectangle, shadcn-style.
- `radius.control`: rounded button/input radius.
- `shadow.glow`: subtle sunset-orange glow for active/primary elements only.
- `spacing.unit`: rhythm-aligned spacing set (`4/8/12/16/24/32/40/56/72`).
- `motion.primary`: short, intentional reveals and focus transitions only.
- `focus.ring`: high-contrast halo token applied to all controls in focus.

### Token Naming Rules

- Semantic families first: `surface`, `text`, `border`, `focus`, `shadow`.
- Include explicit states (`--hover`, `--focus`, `--loading`, `--error`,
  `--disabled`).
- Keep one token source file as the single point of truth.

## Typography

- Display type must be modern, geometric, and premium.
- Headings should be large, confident, and tightly tracked, with restrained
  line-height.
- Body text should be readable, calm, and lower contrast than headings.
- Eyebrows, badges, and metadata should use compact uppercase labels with wider
  tracking.
- Avoid novelty poster fonts, condensed shout fonts, and mixed random font
  families.

## Page Structure

1. Navigation: logo mark left, concise nav center/right, icon controls if
   needed, and one primary "Get started" or "Book pilot" CTA.
2. Hero: centered announcement pill, large headline with one sunset-orange
   gradient phrase, short supporting copy, two CTAs.
3. Social proof or metric strip: compact logos, usage stats, or
   clinical-training proof points.
4. Feature grid: rounded cards with icons, short headings, and one-sentence
   value statements.
5. Product walkthrough: screenshot/mock panel, transcript card, or workflow
   preview with annotated steps.
6. Pricing/demo section: simple tier or pilot CTA card with clear action.
7. FAQ/trust section: concise, accordion-friendly answers.
8. Final CTA: high-contrast rounded panel with one primary action.

## API & Product Surface Alignment

- Use predictable naming:
  - resource paths in lowercase kebab case
  - operation IDs as verb-noun intent (`createSession`, `listScenarios`)
  - schema names in clear PascalCase
- Every API change includes:
  - updated contract spec
  - at least one realistic example payload
  - acceptance checks for UI and data behavior
- Run product/UI and API reviews together to reduce drift.

## Component Rules

- Buttons must define default, hover, focus-visible, active, disabled, and
  loading states.
- Cards must use consistent radius, border, background, padding, and hover
  elevation.
- Nav links must have visible active and hover states without layout shift.
- Badges should be pill-shaped, low-height, and use `color.accentSoft`.
- Icons should be simple line or filled glyphs with sunset-orange accent; avoid
  emoji-style decoration.
- Forms and inputs must share the same rounded control system as buttons.
- Form controls should show explicit loading and error recovery states.

## Content Tone

Concise, premium, and outcome-focused.

- Prefer: "Train the clinical moments roleplay cannot preserve."
- Prefer: "Replay the exchange. Mark the miss. Retry with evidence."
- Avoid: vague AI hype, wellness language, cute metaphors, and generic
  productivity claims.

## Accessibility

- Target WCAG 2.2 AA.
- Focus-visible must be obvious on every interactive element.
- Sunset-orange text on dark surfaces must pass contrast or be reserved for
  decorative labels.
- Motion must respect `prefers-reduced-motion`.
- Cards and CTA panels must remain readable at 320px width.
- Keyboard focus order must remain logical across modal, accordion, and form
  states.
- Loading and completion feedback should be visible and non-color-only.

## Quality Gates

- The implementation must look like one coherent product system, not a set of
  unrelated sections.
- The homepage must include a recognizable Atomist-style SaaS rhythm: nav, pill,
  hero, feature cards, product proof, CTA.
- The accent must read sunset orange, not yellow and not brown.
- No component guidance should introduce duplicate "versioned" components or
  style-specific page forks.
- Every page-level section should have a clear job, clear hierarchy, and a
  responsive behavior rule.
- Security-by-design is mandatory: least privilege, secure defaults, and
  explicit failure handling paths.
