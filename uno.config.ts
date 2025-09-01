import {
  defineConfig,
  presetIcons,
  presetAttributify,
  presetTypography,
} from 'unocss'
import { presetWind3 } from '@unocss/preset-wind3';

export default defineConfig({
  // Workaround: filter out accidental i- or i-- icon classes that cause failed icon "-" lookups
  rules: [
    // Match 'i-', 'i--', or single dash icon classes and ignore them
    [/^i-(-)?$/, () => ({})],
    [/^i--.*/, () => ({})],
  ],
  shortcuts: [
    [
      'btn',
      'px-4 py-1 rounded inline-block bg-teal-600 text-white cursor-pointer hover:bg-teal-700 disabled:cursor-default disabled:bg-gray-600 disabled:opacity-50',
    ],
    [
      'icon-btn',
      'text-[0.9em] inline-block cursor-pointer select-none opacity-75 transition duration-200 ease-in-out hover:opacity-100 hover:text-teal-600',
    ],
    ['container-responsive', 'w-full mx-auto px-4 sm:px-6 lg:px-8'],
    ['grid-responsive', 'grid gap-4 sm:gap-6 lg:gap-8'],
    ['flex-responsive', 'flex gap-4 sm:gap-6 lg:gap-8'],
    [
      'card-responsive',
      'bg-card border border-border rounded-lg p-4 sm:p-6 lg:p-8',
    ],
    ['text-responsive', 'text-sm sm:text-base lg:text-lg'],
    [
      'touch-target',
      'min-h-11 min-w-11 inline-flex items-center justify-center cursor-pointer select-none',
    ],
  ],
  presets: [
    presetWind3(),
    presetAttributify(),
    presetIcons({
      scale: 1.2,
      warn: true,
      collections: {
        // Only include icon collections that are actually used in the codebase
        ri: () => import('@iconify-json/ri/icons.json').then(i => i.default),
        uil: () => import('@iconify-json/uil/icons.json').then(i => i.default),
        lucide: () => import('@iconify-json/lucide/icons.json').then(i => i.default),
        bx: () => import('@iconify-json/bx/icons.json').then(i => i.default),
        'grommet-icons': () => import('@iconify-json/grommet-icons/icons.json').then(i => i.default),
        // Removed unused collections to reduce bundle size:
        // - carbon: Only used in external link plugin, not in actual UI
        // - fa-solid: Not used anywhere in the codebase
      },
      customizations: {
        customize(name: string, _c: any) {
          // Hardened: block empty, dash, double-dash, multiple dashes, or any accidental output that is not a valid icon name
          if (!name || name === '-' || name === '--' || name.startsWith('--') || /^-+$/.test(name)) return false
          return true
        }
      }
    }),
    presetTypography(),
  ],
  theme: {
    fontFamily: {
      sans: [
        'Inter',
        'apple-system',
        'BlinkMacSystemFont',
        'Segoe UI',
        'Roboto',
        'Helvetica Neue',
        'Arial',
        'sans-serif',
      ],
      mono: [
        'DM Mono',
        'ui-monospace',
        'SFMono-Regular',
        'Menlo',
        'Monaco',
        'Consolas',
        'Liberation Mono',
        'Courier New',
        'monospace',
      ],
      condensed: ['Inter', 'Arial Narrow', 'Arial', 'sans-serif'],
      babies: ['Babies Playtime', 'cursive', 'sans-serif'],
    },
    colors: {
      'card': 'rgb(var(--color-card))',
      'border': 'rgb(var(--color-border))',
      'background': 'rgb(var(--color-background))',
      'foreground': 'rgb(var(--color-foreground))',
      'muted': 'rgb(var(--color-muted))',
      'primary': 'rgb(var(--color-primary))',
      'secondary': 'rgb(var(--color-secondary))',
      'accent': 'rgb(var(--color-accent))',
      'success': 'rgb(var(--color-success))',
      'info': 'rgb(var(--color-info))',
      'warning': 'rgb(var(--color-warning))',
      'error': 'rgb(var(--color-error))',
      'card-foreground': 'rgb(var(--color-foreground))',
      'green': {
        100: '#dcfce7',
        200: '#bbf7d0',
        300: '#86efac',
        400: '#4ade80',
        500: '#22c55e',
        600: '#16a34a',
        700: '#15803d',
        800: '#166534',
        900: '#14532d',
      },
      'emerald': {
        100: '#d1fae5',
        200: '#a7f3d0',
        300: '#6ee7b7',
        400: '#34d399',
        500: '#10b981',
        600: '#059669',
        700: '#047857',
        800: '#065f46',
        900: '#064e3b',
      },
      'plum': {
        100: '#f3e8ff',
        200: '#e9d5ff',
        300: '#d8b4fe',
        400: '#c084fc',
        500: '#a855f7',
        600: '#9333ea',
        700: '#7e22ce',
        800: '#6b21a8',
        900: '#581c87',
      },
    },

    breakpoints: {
      'xs': '320px',
      'sm': '640px',
      'md': '768px',
      'lg': '1024px',
      'xl': '1280px',
      '2xl': '1536px',
    },
    spacing: {
      'responsive-xs': 'clamp(0.25rem, 1vw, 0.5rem)',
      'responsive-sm': 'clamp(0.5rem, 2vw, 1rem)',
      'responsive-md': 'clamp(1rem, 3vw, 1.5rem)',
      'responsive-lg': 'clamp(1.5rem, 4vw, 2.5rem)',
      'responsive-xl': 'clamp(2rem, 5vw, 4rem)',
    },
    fontSize: {
      'responsive-xs': 'clamp(0.75rem, 1.5vw, 0.875rem)',
      'responsive-sm': 'clamp(0.875rem, 2vw, 1rem)',
      'responsive-base': 'clamp(1rem, 2.5vw, 1.125rem)',
      'responsive-lg': 'clamp(1.125rem, 3vw, 1.25rem)',
      'responsive-xl': 'clamp(1.25rem, 3.5vw, 1.5rem)',
      'responsive-2xl': 'clamp(1.5rem, 4vw, 2rem)',
      'responsive-3xl': 'clamp(2rem, 5vw, 3rem)',
    },
  },
  transformers: [],
  safelist: [
    'prose',
    'prose-sm',
    'prose-lg',
    'prose-xl',
    'prose-2xl',
    'dark:prose-invert',
    'container-responsive',
    'grid-responsive',
    'flex-responsive',
    'card-responsive',
    'text-responsive',
    'touch-target',
    'hidden-xs',
    'visible-xs',
    'hidden-sm',
    'visible-sm',
    'hidden-md',
    'visible-md',
    'hidden-lg',
    'visible-lg',
    'mobile-stack',
    'mobile-full-width',
    'mobile-center',
    'mobile-hide',
  ],
})
