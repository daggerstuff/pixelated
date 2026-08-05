import { defineConfig, presetUno, presetAttributify, presetIcons } from 'unocss'

export default defineConfig({
  content: {
    pipeline: {
      include: [/\.(astro|[jt]sx|html)($|\?)/],
      exclude: [
        /node_modules/,
        /dist/,
        /content-store/,
        /business-strategy-cms/,
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
      sans: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      mono: '"JetBrains Mono Variable", ui-monospace, monospace',
      display: '"JetBrains Mono Variable", ui-monospace, monospace',
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
