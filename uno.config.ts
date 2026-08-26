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
