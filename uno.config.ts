import {
  defineConfig,
  presetUno,
  presetAttributify,
  presetIcons,
  transformerVariantGroup,
} from 'unocss'

export default defineConfig({
  content: {
    pipeline: {
      include: [/\.(astro|[jt]sx|html)($|\?)/],
      exclude: [
        /node_modules/,
        /dist/,
        /content-store/,
        /docs\//,
        /tests?\//,
        /public\//,
      ],
    },
  },
  theme: {
    // `lgp` ("laptop") is the 1128px split the layout components were written
    // against: Toc renders its sticky side nav at or above it and its floating
    // button below, and TocButton / ToTopButton / SearchSwitch / GroupItem all
    // tune themselves with `lt-lgp:`. UnoCSS has no `lgp` breakpoint, so every
    // one of those rules compiled to nothing. A user-level `breakpoints` map
    // REPLACES the preset's list instead of merging into it, so the preset's
    // defaults are restated here — dropping one would silently disable every
    // `sm:`/`md:`/`lg:`/`xl:`/`2xl:` utility on the site.
    breakpoints: {
      'sm': '640px',
      'md': '768px',
      'lg': '1024px',
      'lgp': '1128px',
      'xl': '1280px',
      '2xl': '1536px',
    },
    colors: {
      'foreground': 'var(--np-text)',
      'background': 'var(--np-bg)',
      // ── shadcn-style token bridge → Neutral Precision zero-chroma ramp ──
      // These class names (bg-primary, text-muted-foreground, bg-card, …) are
      // used across the admin UI primitives (button, card, badge, alert, …).
      // Without this mapping they emit NO CSS (computed style showed buttons
      // rendering transparent with Tailwind gray-500 fallback text). Every
      // value resolves to an --np-* token; no chromatic accent re-enters.
      // NOTE: UnoCSS drops the `/NN` opacity modifier on var() colors, so
      // tinted usages (bg-destructive/10) must use explicit NP tokens instead.
      'primary': 'var(--np-text)',
      'primary-foreground': 'var(--np-bg)',
      'secondary': 'var(--np-surface)',
      'secondary-foreground': 'var(--np-text)',
      'destructive': 'var(--np-text)',
      'destructive-foreground': 'var(--np-bg)',
      'accent': 'var(--np-hover)',
      'accent-foreground': 'var(--np-text)',
      'muted': 'var(--np-surface)',
      'muted-foreground': 'var(--np-muted)',
      'card': 'var(--np-surface)',
      'card-foreground': 'var(--np-text)',
      'popover': 'var(--np-elevated)',
      'popover-foreground': 'var(--np-text)',
      'input': 'var(--np-elevated)',
      'ring': 'var(--np-mid)',
      'border': 'var(--np-line)',
    },
    fontFamily: {
      sans: 'var(--np-font-body, "Switzer", ui-sans-serif, system-ui, sans-serif)',
      mono: 'var(--np-font-mono, "IoskeleyMono", ui-monospace, monospace)',
      display:
        'var(--np-font-display, "IoskeleyMono", ui-monospace, monospace)',
    },
  },
  presets: [
    presetUno({ dark: 'class' }),
    presetAttributify(),
    presetIcons({
      scale: 1.2,
      warn: false,
    }),
  ],
  // Variant groups (`lt-lgp:(op-50 pointer-events-auto)`) are a *transformer*
  // in UnoCSS, not part of presetUno, so without this every `prefix:(a b)`
  // group in the codebase was extracted as two broken half-tokens and emitted
  // no CSS at all. TocButton, NavBar, Categorizer and ToTopButton all size
  // themselves that way.
  transformers: [transformerVariantGroup()],
  shortcuts: {},
})
