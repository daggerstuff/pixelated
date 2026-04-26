# Homepage Renovation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Renovate the Pixelated Empathy homepage desktop view — fix typography, break centering, trim repetition, create visual rhythm, add polish. Not a teardown; a significant renovation.

**Architecture:** Swap font system from 1-tier mono to 3-tier (Lexend headings, Source Sans 3 body, Berkeley Mono labels-only). Rebalance font sizes. Left-align content on desktop. Trim repetitive content. Give the product screenshot real estate. Bump border-radius to 8px. Reduce dotted border clutter. Add color breathing room.

**Tech Stack:** Astro, UnoCSS, CSS custom properties, Google Fonts

---

### Task 1: Add Google Fonts and update font CSS variables

**Files:**
- Modify: `src/components/base/Head.astro` (add Lexend + Source Sans 3 font links)
- Modify: `src/styles/fonts.css` (add @font-face for new fonts)
- Modify: `src/styles/typography.css` (update CSS variables)
- Modify: `src/styles/design-system.css` (update CSS variables)

**Step 1: Add Google Fonts link in Head.astro**
Add after the existing Material Symbols link:
```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Lexend:wght@400;500;600;700&family=Source+Sans+3:wght@300;400;500;600;700&display=swap" />
```

**Step 2: Update typography.css font variables**
```
--font-sans: 'Source Sans 3', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
--font-mono: 'Berkeley Mono', 'JetBrains Mono', 'SF Mono', monospace;
--font-display: 'Lexend', 'Source Sans 3', sans-serif;
--font-label: 'Berkeley Mono', 'JetBrains Mono', 'SF Mono', monospace;
```

**Step 3: Update design-system.css font variables to match**

**Step 4: Verify build**
Run: `pnpm build`
Expected: Build succeeds with no errors

**Step 5: Commit**
```bash
git add src/components/base/Head.astro src/styles/fonts.css src/styles/typography.css src/styles/design-system.css
git commit -m "feat: add Lexend + Source Sans 3 fonts, update type system variables"
```

---

### Task 2: Rebalance font sizes and heading styles

**Files:**
- Modify: `src/styles/homepage.css` (update pe-heading-l, pe-heading-s, pe-home-copy sizes)
- Modify: `src/styles/typography.css` (update base heading sizes)

**Step 1: Update homepage heading sizes**
```css
.pe-heading-l { font-size: clamp(1.65rem, 2vw, 2.1rem); line-height: 1.3; }
.pe-heading-s { font-size: 1.1rem; font-weight: 600; }
.pe-home-copy { font-size: 0.95rem; line-height: 1.65; }
```

**Step 2: Update base typography heading sizes**
```css
h1 { font-size: var(--text-4xl); } /* ~2.25rem instead of 3rem */
h2 { font-size: var(--text-3xl); } /* ~1.875rem */
```

**Step 3: Verify build**
Run: `pnpm build`

**Step 4: Commit**
```bash
git add src/styles/homepage.css src/styles/typography.css
git commit -m "feat: rebalance font sizes for better desktop hierarchy"
```

---

### Task 3: Fix hero typography and layout

**Files:**
- Modify: `src/components/homepage/HeroContent.astro` (embedded styles)

**Step 1: Update hero title sizing**
```css
.hero-title {
  font-family: var(--font-display); /* Lexend */
  font-size: clamp(2.5rem, 3.2vw, 3.5rem);
  line-height: 1.12;
  letter-spacing: -0.03em; /* less aggressive than -0.055em */
}
```

**Step 2: Update hero subtitle**
```css
.hero-subtitle {
  font-family: var(--font-sans); /* Source Sans 3 */
  font-size: 1.05rem;
  line-height: 1.65;
}
```

**Step 3: Update hero kicker to use label font**
```css
.hero-kicker { font-family: var(--font-label); }
```

**Step 4: Update button font to Lexend**
```css
.btn-premium, .hero-secondary-link {
  font-family: var(--font-display);
  font-size: 0.82rem;
  letter-spacing: 0.08em;
  border-radius: 8px;
}
```

**Step 5: Update proof card label font**
```css
.hero-proof-card__label { font-family: var(--font-label); }
.hero-proof-card p { font-family: var(--font-sans); }
```

**Step 6: Verify build**
Run: `pnpm build`

**Step 7: Commit**
```bash
git add src/components/homepage/HeroContent.astro
git commit -m "feat: update hero typography to Lexend/Source Sans 3"
```

---

### Task 4: Fix hero artifact card — reduce density, left-align on desktop

**Files:**
- Modify: `src/components/BrutalistHeroArtifact.astro` (embedded styles)

**Step 1: Left-align artifact content on desktop**
At `@media (min-width: 1040px)`:
```css
.hero-artifact__body { justify-items: start; text-align: left; }
.hero-artifact__header { justify-items: start; text-align: left; }
.hero-artifact__meta { justify-content: flex-start; }
.hero-artifact__readout { justify-items: start; text-align: left; }
.hero-artifact__readout-item { text-align: left; justify-items: start; }
.hero-artifact__highlights { justify-items: start; text-align: left; }
.hero-artifact__highlight { text-align: left; justify-items: start; }
```

**Step 2: Remove text-align: center !important on readout**
Delete: `.hero-artifact__readout, .hero-artifact__readout-item { text-align: center !important; }`

**Step 3: Increase screenshot real estate**
```css
.hero-artifact__figure { max-height: 20rem; } /* up from 15.5rem */
.hero-artifact__image { max-height: 20rem; }
```

**Step 4: Update fonts in artifact**
```css
.hero-artifact__eyebrow, .hero-artifact__mode, .hero-artifact__highlight span {
  font-family: var(--font-label); /* Berkeley Mono for labels */
}
.hero-artifact__title { font-family: var(--font-display); }
.hero-artifact__summary { font-family: var(--font-sans); }
.hero-artifact__readout-item span { font-family: var(--font-label); }
.hero-artifact__readout-item strong { font-family: var(--font-sans); }
.hero-artifact__highlight strong { font-family: var(--font-sans); }
```

**Step 5: Bump border-radius to 8px**
Replace all `border-radius: 4px` with `border-radius: 8px` in this component.

**Step 6: Verify build**
Run: `pnpm build`

**Step 7: Commit**
```bash
git add src/components/BrutalistHeroArtifact.astro
git commit -m "feat: left-align artifact card on desktop, increase screenshot size"
```

---

### Task 5: Left-align desktop content across all sections

**Files:**
- Modify: `src/styles/homepage.css` (break centering on desktop)
- Modify: `src/components/homepage/IntroSection.astro` (embedded styles)
- Modify: `src/components/mizu/CoreFeatures.astro` (embedded styles)
- Modify: `src/components/mizu/CTA.astro` (embedded styles)

**Step 1: In homepage.css, add desktop left-alignment overrides**
At `@media (min-width: 980px)`:
```css
.pe-home-shell > .home-intro,
.pe-home-shell > .core-features-section .core-features-intro,
.pe-home-shell > .cta-section .cta-copy {
  text-align: left;
  justify-items: start;
}
```

**Step 2: In IntroSection.astro, left-align desktop content**
At `@media (min-width: 980px)`:
- `.home-intro`: change `text-align: center` to `text-align: left`
- `.home-intro__lead`: `text-align: left; justify-items: start;`
- `.home-intro__lead .pe-home-copy`: `text-align: left;`
- `.home-intro__diagnostic, .home-intro__issue, .home-intro__evidence-column`: `text-align: left; justify-items: start;`
- `.home-intro__issue p, .home-intro__evidence-list li`: remove `margin-inline: auto`

**Step 3: In CoreFeatures.astro, left-align desktop content**
At `@media (min-width: 980px)`:
- `.core-features-intro`: `text-align: left; justify-items: start;`
- `.core-features-intro .pe-home-copy`: `text-align: left;` remove `margin: 0 auto`
- `.core-feature-proof, .core-feature-card, .core-feature-comparison, .core-feature-quote`: `text-align: left; justify-items: start;`
- `.core-feature-card p`: remove `margin-inline: auto`
- `.core-feature-proof__list li`: `text-align: left;`

**Step 4: In CTA.astro, left-align desktop content**
At `@media (min-width: 980px)`:
- `.cta-copy`: `text-align: left; justify-items: start;`
- `.cta-copy .pe-home-copy`: `text-align: left;`
- `.cta-proof-item, .cta-decision`: `text-align: left; justify-items: start;`
- `.cta-rubric`: `text-align: left; justify-items: start;`
- `.cta-rubric li`: `text-align: left;`

**Step 5: Verify build**
Run: `pnpm build`

**Step 6: Commit**
```bash
git add src/styles/homepage.css src/components/homepage/IntroSection.astro src/components/mizu/CoreFeatures.astro src/components/mizu/CTA.astro
git commit -m "feat: left-align content on desktop for readability"
```

---

### Task 6: Trim repetitive content in content files

**Files:**
- Modify: `src/lib/content/hero.ts` (trim proof point verbosity)
- Modify: `src/lib/content/features.ts` (trim comparison section — duplicates intro)
- Modify: `src/lib/content/cta.ts` (cut the rubric to 2 items, trim proof items)

**Step 1: Trim hero proof points**
Shorten the two proof point texts. "For trainees" and "For supervisors" are restating the subtitle — tighten to one line each.

**Step 2: Trim features comparison**
The "old pattern vs new pattern" appears in BOTH intro section AND features section. Remove it from features — the intro already makes this point.

**Step 3: Trim CTA**
- Reduce rubric from 3 items to 2
- Tighten verdictCopy and intro

**Step 4: Verify build**
Run: `pnpm build`

**Step 5: Commit**
```bash
git add src/lib/content/hero.ts src/lib/content/features.ts src/lib/content/cta.ts
git commit -m "feat: trim repetitive homepage content for tighter read"
```

---

### Task 7: Update remaining font references, border-radius, and dotted borders

**Files:**
- Modify: `src/styles/variables.css` (radius tokens)
- Modify: `src/styles/design-system.css` (radius tokens, font refs)
- Modify: `src/styles/homepage.css` (font refs, radius, dotted border reduction)
- Modify: `src/components/mizu/CoreFeatures.astro` (font refs, radius, border cleanup)
- Modify: `src/components/mizu/CTA.astro` (font refs, radius, border cleanup)
- Modify: `src/components/homepage/IntroSection.astro` (font refs, radius, border cleanup)

**Step 1: Update radius tokens in variables.css**
```css
--radius-sm: 8px;
--radius-md: 10px;
```

**Step 2: Update radius in design-system.css**
```css
--radius-button: var(--radius-sm); /* 8px */
--radius-input: var(--radius-md); /* 10px */
--radius-card: var(--radius-sm); /* 8px */
```

**Step 3: Replace all `border-radius: 4px` with `border-radius: 8px` across homepage components**

**Step 4: Replace all `font-family: var(--font-mono)` in body/heading contexts with `var(--font-sans)` or `var(--font-display)`. Only keep `var(--font-mono)` for label-sized uppercase text.**

**Step 5: Reduce dotted border usage**
- Remove dotted top borders on list items inside cards (keep only section dividers)
- Change card-to-card dividers from `dotted` to `solid` at lower opacity
- Keep the section divider line as-is (it works as a section marker)

**Step 6: Verify build**
Run: `pnpm build`

**Step 7: Commit**
```bash
git add src/styles/variables.css src/styles/design-system.css src/styles/homepage.css src/components/mizu/CoreFeatures.astro src/components/mizu/CTA.astro src/components/homepage/IntroSection.astro
git commit -m "feat: update border-radius to 8px, fix font refs, reduce dotted borders"
```

---

### Task 8: Add color breathing room and visual differentiation between sections

**Files:**
- Modify: `src/styles/homepage.css` (section background alternation)
- Modify: `src/components/mizu/CoreFeatures.astro` (section background)

**Step 1: Add subtle background shift on alternate sections**
```css
.pe-home-section:nth-child(even) {
  background: rgba(48, 44, 44, 0.25); /* very subtle lift on even sections */
}
```

**Step 2: Add a touch more orange glow to the CTA section**
```css
.cta-section::before {
  content: '';
  position: absolute;
  top: 0; left: 25%; right: 25%;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255, 107, 0, 0.3), transparent);
}
```

**Step 3: Verify build**
Run: `pnpm build`

**Step 4: Commit**
```bash
git add src/styles/homepage.css src/components/mizu/CoreFeatures.astro
git commit -m "feat: add visual rhythm between sections with background shifts"
```

---

### Task 9: Final verification and push

**Step 1: Run full build**
```bash
pnpm build
```

**Step 2: Check dev server renders correctly**
```bash
pnpm dev
```
Visually verify: fonts load, sizes look right, left-alignment on desktop, border-radius is 8px, content is trimmed.

**Step 3: Push**
```bash
git push
```
