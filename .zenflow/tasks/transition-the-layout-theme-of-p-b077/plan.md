# Transition Layout/Theme to Astro Keel

Adopt the visual design system from [astro-keel](https://github.com/kpab/astro-keel) across the Pixelated Empathy project.
Changes target the main BaseLayout, global CSS tokens, and font stack.
All internal app pages adapt automatically through the updated CSS variables.

## Key decisions

- Light/dark mode via `data-theme` attribute + `.dark` class (dual sync for CSS vars and UnoCSS utilities)
- Fonts: Fraunces Variable (display), Public Sans (body), JetBrains Mono (code) via @fontsource
- Accent color: warm amber/terracotta (`oklch(0.54 0.14 35)`) replacing teal
- Retained existing page structure; only layout chrome (header, footer, tokens) changed

### [x] Step: Install keel fonts

- Added `@fontsource-variable/fraunces`, `@fontsource/public-sans`, `@fontsource-variable/jetbrains-mono`

### [x] Step: Create keel-theme.css

- `src/styles/keel-theme.css` — full keel design tokens, maps old variable names to keel values,
  structural header/footer/nav component classes

### [x] Step: Update BaseLayout.astro

- Removed mizu Navbar and Footer; replaced with keel-style sticky header and minimal footer
- Added theme toggle button with `data-theme` + `.dark` class dual sync
- Imported keel fonts and keel-theme.css
- Removed old dark class and inline style overrides from `<html>`

### [x] Step: Update design tokens

- `src/styles/variables.css` — keel palette (warm neutral bg, amber accent, light/dark variants)
- `src/styles/design-system.css` — updated font variables to keel stack
- `src/styles/global.css` — removed Google Fonts import, switched to `var(--font-sans/display/mono)`
- `uno.config.ts` — updated theme colors and font families to keel values
