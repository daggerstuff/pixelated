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
      foreground: 'oklch(0.93 0 0)',
      background: 'oklch(0.10 0 0)',
    },
    fontFamily: {
      sans: '"Public Sans", system-ui, sans-serif',
      mono: '"JetBrains Mono Variable", ui-monospace, monospace',
      display: '"Fraunces Variable", Georgia, serif',
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
