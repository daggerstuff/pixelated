import { defineConfig, presetUno, presetAttributify, presetIcons } from 'unocss'

export default defineConfig({
  content: {
    pipeline: {
      include: [/\.(astro|[jt]sx|html)($|\?)/],
      exclude: [
        /node_modules/,
        /dist/,
        /content-store/,
        /apps\/business-strategy-cms/,
        /docs\//,
        /tests?\//,
        /public\//,
      ],
    },
  },
  theme: {
    colors: {
      foreground: 'var(--np-text)',
      background: 'var(--np-bg)',
      // ── shadcn-style token bridge → Neutral Precision zero-chroma ramp ──
      // These class names (bg-primary, text-muted-foreground, bg-card, …) are
      // used across the admin UI primitives (button, card, badge, alert, …).
      // Without this mapping they emit NO CSS (computed style showed buttons
      // rendering transparent with Tailwind gray-500 fallback text). Every
      // value resolves to an --np-* token; no chromatic accent re-enters.
      // NOTE: UnoCSS drops the `/NN` opacity modifier on var() colors, so
      // tinted usages (bg-destructive/10) must use explicit NP tokens instead.
      primary: 'var(--np-text)',
      'primary-foreground': 'var(--np-bg)',
      secondary: 'var(--np-surface)',
      'secondary-foreground': 'var(--np-text)',
      destructive: 'var(--np-text)',
      'destructive-foreground': 'var(--np-bg)',
      accent: 'var(--np-hover)',
      'accent-foreground': 'var(--np-text)',
      muted: 'var(--np-surface)',
      'muted-foreground': 'var(--np-muted)',
      card: 'var(--np-surface)',
      'card-foreground': 'var(--np-text)',
      popover: 'var(--np-elevated)',
      'popover-foreground': 'var(--np-text)',
      input: 'var(--np-elevated)',
      ring: 'var(--np-mid)',
      border: 'var(--np-line)',
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
  shortcuts: {},
})
