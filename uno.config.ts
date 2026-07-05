import {
  defineConfig,
  presetUno,
  presetAttributify,
  presetIcons,
  presetWebFonts,
} from 'unocss'

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
      primary: {
        500: '#cc7a52',
        600: '#a44f33',
        700: '#7d3a25',
      },
      secondary: {
        500: '#007aff',
        600: '#0056b3',
        700: '#004080',
        800: '#002f66',
      },
      foreground: 'oklch(0.93 0.006 95)',
      background: 'oklch(0.18 0.009 250)',
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
    ...(process.env['CI'] === 'true' || process.env['NODE_ENV'] === 'test'
      ? []
      : [
          presetWebFonts({
            fonts: {
              sans: 'Public Sans:400,600,700',
              mono: 'JetBrains Mono Variable',
              display: 'Fraunces Variable',
            },
          }),
        ]),
  ],
  shortcuts: {
    'btn':
      'px-4 py-2 inline-block bg-primary-500 text-white cursor-pointer hover:bg-primary-600',
    'btn-primary': 'btn bg-primary-600 hover:bg-primary-700',
    'btn-secondary': 'btn bg-secondary-700 hover:bg-secondary-800',
  },
})
