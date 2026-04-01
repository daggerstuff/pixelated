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
        50: '#eef9f3',
        100: '#d5efdf',
        200: '#addfc1',
        300: '#84cea3',
        400: '#7dd3a8',
        500: '#57a985',
        600: '#3c7f63',
        700: '#295a46',
        800: '#19392d',
        900: '#10231c',
        950: '#08110d',
      },
      secondary: {
        50: '#f1f4f4',
        100: '#dce3e3',
        200: '#c0cbcb',
        300: '#a3adad',
        400: '#7c8585',
        500: '#5e6767',
        600: '#444c4c',
        700: '#2c3435',
        800: '#1d2324',
        900: '#151a1b',
        950: '#0d1011',
      },
      foreground: '#ffffff',
      background: '#060707',
    },
    fontFamily: {
      sans: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      mono: '"DM Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace',
      display:
        '"Baskerville", "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif',
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
