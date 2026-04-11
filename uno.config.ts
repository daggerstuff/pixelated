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
        500: '#FF8533',
        600: '#FF6B00',
        700: '#CC5600',
      },
      secondary: {
        500: '#007aff',
        600: '#0056b3',
        700: '#004080',
        800: '#002f66',
      },
      foreground: '#fdfcfc',
      background: '#201d1d',
    },
    fontFamily: {
      sans: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      mono: '"Berkeley Mono", "DM Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace',
      display: '"Berkeley Mono", monospace',
    },
  },
  presets: [
    presetUno(),
    presetAttributify(),
    presetIcons({
      scale: 1.2,
      warn: false,
    }),
    // Skip web fonts in CI/Test to avoid timeouts
    ...(process.env.CI === 'true' || process.env.NODE_ENV === 'test'
      ? []
      : [
          presetWebFonts({
            fonts: {
              sans: 'Inter:400,600,800',
              mono: 'DM Mono:400,600',
            },
          }),
        ]),
  ],
  shortcuts: {
    btn: 'px-4 py-2 rounded inline-block bg-primary-500 text-white cursor-pointer hover:bg-primary-600',
    'btn-primary': 'btn bg-primary-600 hover:bg-primary-700',
    'btn-secondary': 'btn bg-secondary-700 hover:bg-secondary-800',
  },
})
