import { defineConfig, presetUno, presetAttributify, presetIcons, presetTypography, presetWebFonts } from 'unocss'

export default defineConfig({
  presets: [
    presetUno(),
    presetAttributify(),
    presetIcons({
      collections: {
        carbon: () => import('@iconify-json/carbon/icons.json').then(i => i.default),
        mdi: () => import('@iconify-json/mdi/icons.json').then(i => i.default),
      },
    }),
    presetTypography(),
    presetWebFonts({
      fonts: {
        sans: 'Inter:400,500,600,700',
        mono: 'JetBrains Mono:400,500,600',
      },
    }),
  ],

  // Custom theme configuration matching our design system
  theme: {
    colors: {
      // Primary color scale (OKLCH-based)
      primary: {
        50: 'oklch(96.5% 0.02 41.116)',
        100: 'oklch(92.1% 0.04 41.116)',
        200: 'oklch(87.6% 0.08 41.116)',
        300: 'oklch(82.1% 0.12 41.116)',
        400: 'oklch(76.3% 0.16 41.116)',
        500: 'oklch(70.5% 0.204 54.09)',
        600: 'oklch(64.6% 0.222 41.116)',
        700: 'oklch(58.2% 0.24 41.116)',
        800: 'oklch(51.8% 0.26 41.116)',
        900: 'oklch(45.4% 0.28 41.116)',
        950: 'oklch(39.1% 0.30 41.116)',
      },
      // Secondary color scale
      secondary: {
        50: 'oklch(96.8% 0.02 276.42)',
        100: 'oklch(92.4% 0.04 276.42)',
        200: 'oklch(87.9% 0.08 276.42)',
        300: 'oklch(82.4% 0.12 276.42)',
        400: 'oklch(76.6% 0.149 282.9)',
        500: 'oklch(64.6% 0.149 282.9)',
        600: 'oklch(58.2% 0.158 276.42)',
        700: 'oklch(51.8% 0.167 276.42)',
        800: 'oklch(45.4% 0.176 276.42)',
        900: 'oklch(39.1% 0.185 276.42)',
        950: 'oklch(32.8% 0.194 276.42)',
      },
      // Accent colors
      accent: {
        50: 'oklch(96.2% 0.03 101.93)',
        100: 'oklch(91.8% 0.06 101.93)',
        200: 'oklch(87.3% 0.09 101.93)',
        300: 'oklch(81.8% 0.12 101.93)',
        400: 'oklch(78.9% 0.173 108.41)',
        500: 'oklch(72.1% 0.182 101.93)',
        600: 'oklch(65.3% 0.191 101.93)',
        700: 'oklch(58.5% 0.20 101.93)',
        800: 'oklch(51.7% 0.21 101.93)',
        900: 'oklch(44.9% 0.22 101.93)',
        950: 'oklch(38.1% 0.23 101.93)',
      },
      // Neutral colors (dark theme optimized)
      neutral: {
        50: 'oklch(95.1% 0.004 94.33)',
        100: 'oklch(90.5% 0.007 91.03)',
        200: 'oklch(82.1% 0.01 87.72)',
        300: 'oklch(70.5% 0.015 83.42)',
        400: 'oklch(58.2% 0.015 79.12)',
        500: 'oklch(47.8% 0.012 73.34)',
        600: 'oklch(37.4% 0.01 67.558)',
        700: 'oklch(27.8% 0.007 58.21)',
        800: 'oklch(19.8% 0.005 56.04)',
        900: 'oklch(14.7% 0.004 49.25)',
        950: 'oklch(10.2% 0.003 42.15)',
      },
      // Semantic colors
      background: 'var(--color-neutral-950)',
      foreground: 'var(--color-neutral-100)',
      card: 'var(--color-neutral-900)',
      'card-foreground': 'var(--color-neutral-100)',
      popover: 'var(--color-neutral-900)',
      'popover-foreground': 'var(--color-neutral-100)',
      muted: 'var(--color-neutral-700)',
      'muted-foreground': 'var(--color-neutral-500)',
      border: 'var(--color-neutral-800)',
      input: 'var(--color-neutral-800)',
      ring: 'var(--color-primary-500)',
    },

    // Animation durations matching design system
    animation: {
      'fade-in': 'fadeIn 0.5s ease-out',
      'fade-in-up': 'fadeInUp 0.6s ease-out',
      'fade-in-down': 'fadeInDown 0.6s ease-out',
      'fade-in-left': 'fadeInLeft 0.6s ease-out',
      'fade-in-right': 'fadeInRight 0.6s ease-out',
      'slide-in-up': 'slideInUp 0.5s ease-out',
      'slide-in-down': 'slideInDown 0.5s ease-out',
      'scale-in': 'scaleIn 0.3s ease-out',
      'bounce-in': 'bounceIn 0.6s ease-out',
      'float': 'float 6s ease-in-out infinite',
      'pulse-slow': 'pulse 3s ease-in-out infinite',
      'spin-slow': 'spin 4s linear infinite',
    },

    // Custom spacing scale
    spacing: {
      '4xs': '0.125rem',    // 2px
      '3xs': '0.25rem',     // 4px
      '2xs': '0.5rem',      // 8px
      'xs': '0.75rem',      // 12px
      'sm': '1rem',         // 16px
      'md': '1.5rem',       // 24px
      'lg': '2rem',         // 32px
      'xl': '3rem',         // 48px
      '2xl': '4rem',        // 64px
      '3xl': '6rem',        // 96px
      '4xl': '8rem',        // 128px
      '5xl': '12rem',       // 192px
      '6xl': '16rem',       // 256px
    },

    // Custom border radius
    borderRadius: {
      '4xs': '0.125rem',
      '3xs': '0.25rem',
      '2xs': '0.375rem',
      'xs': '0.5rem',
      'sm': '0.625rem',
      'md': '0.75rem',
      'lg': '1rem',
      'xl': '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.75rem',
      '4xl': '2rem',
      '5xl': '2.5rem',
      '6xl': '3rem',
    },

    // Custom shadows
    boxShadow: {
      'sm': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
      'md': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
      'lg': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
      'xl': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
      '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      'inner': 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.05)',
      'glow': '0 0 20px rgba(59, 130, 246, 0.3)',
      'glow-lg': '0 0 40px rgba(59, 130, 246, 0.4)',
      'glow-primary': '0 0 20px var(--color-primary-500)',
      'glow-secondary': '0 0 20px var(--color-secondary-500)',
      'glow-accent': '0 0 20px var(--color-accent-500)',
    },
  },

  // Custom rules for our components
  rules: [
    // Gradient backgrounds
    [/^bg-gradient-(\w+)-(\w+)$/, ([, _direction, gradient]) => {
      const gradients = {
        primary: 'linear-gradient(135deg, var(--color-primary-600), var(--color-secondary-600))',
        secondary: 'linear-gradient(135deg, var(--color-secondary-600), var(--color-accent-500))',
        accent: 'linear-gradient(135deg, var(--color-accent-500), var(--color-primary-500))',
        dark: 'linear-gradient(135deg, var(--color-neutral-950), var(--color-neutral-800))',
        light: 'linear-gradient(135deg, var(--color-neutral-100), var(--color-neutral-300))',
      };

// directions object removed - was unused

      return {
        background: gradients[gradient] || `linear-gradient(135deg, var(--color-${gradient}-600), var(--color-${gradient}-500))`
      };
    }],

    // Dark mode utilities
    ['dark', {
      '@media (prefers-color-scheme: dark)': {
        'color-scheme': 'dark'
      }
    }],

    // Card utilities
    ['card', {
      'background-color': 'var(--bg-secondary)',
      'border': '1px solid var(--border-secondary)',
      'border-radius': 'var(--card-radius)',
      'padding': 'var(--card-padding)',
      'box-shadow': 'var(--card-shadow)',
      'transition': 'all var(--duration-normal) var(--ease-in-out)',
    }],

    ['card-hover', {
      'box-shadow': 'var(--card-shadow-hover)',
      'transform': 'translateY(-2px)',
    }],

    // Button utilities
    ['btn', {
      'display': 'inline-flex',
      'align-items': 'center',
      'justify-content': 'center',
      'padding': 'var(--button-padding-y) var(--button-padding-x)',
      'border-radius': 'var(--button-radius)',
      'font-weight': 'var(--button-font-weight)',
      'transition': 'all var(--duration-fast) var(--ease-out)',
      'cursor': 'pointer',
      'border': 'none',
      'text-decoration': 'none',
    }],

    ['btn-primary', {
      'background-color': 'var(--color-primary-600)',
      'color': 'white',
    }],

    ['btn-secondary', {
      'background-color': 'var(--bg-tertiary)',
      'color': 'var(--text-primary)',
      'border': '1px solid var(--border-primary)',
    }],

    // Text gradient
    ['text-gradient', {
      'background': 'linear-gradient(135deg, var(--color-primary-500), var(--color-secondary-500))',
      '-webkit-background-clip': 'text',
      '-webkit-text-fill-color': 'transparent',
      'background-clip': 'text',
    }],

    // Glass morphism
    ['glass', {
      'background': 'rgba(255, 255, 255, 0.1)',
      'backdrop-filter': 'blur(10px)',
      'border': '1px solid rgba(255, 255, 255, 0.2)',
    }],

    ['glass-dark', {
      'background': 'rgba(0, 0, 0, 0.2)',
      'backdrop-filter': 'blur(10px)',
      'border': '1px solid rgba(255, 255, 255, 0.1)',
    }],
  ],

  // Custom shortcuts
  shortcuts: {
    // Layout shortcuts
    'flex-col-center': 'flex flex-col items-center justify-center',
    'flex-col-start': 'flex flex-col items-start justify-center',
    'flex-center': 'flex items-center justify-center',
    'flex-between': 'flex items-center justify-between',
    'grid-center': 'grid place-items-center',

    // Typography shortcuts
    'text-balance': 'text-wrap-balance',
    'text-pretty': 'text-wrap-pretty',

    // Component shortcuts
    'card-base': 'bg-secondary border border-border-secondary rounded-lg p-6 shadow-md',
    'card-hover': 'hover:shadow-xl hover:-translate-y-1 transition-all duration-300',
    'btn-base': 'inline-flex items-center justify-center px-4 py-2 rounded-md font-medium transition-colors duration-200',
    'input-base': 'w-full px-3 py-2 border border-border-primary rounded-md bg-secondary text-primary placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',

    // Animation shortcuts
    'animate-float': 'animate-float',
    'animate-pulse-slow': 'animate-pulse-slow',
    'animate-glow': 'shadow-glow-primary',

    // Dark mode shortcuts
    'dark-text': 'text-neutral-200 dark:text-neutral-300',
    'dark-bg': 'bg-neutral-900 dark:bg-neutral-950',
    'dark-border': 'border-neutral-800 dark:border-neutral-700',
  },

  // Animation keyframes
  keyframes: {
    fadeIn: {
      '0%': { opacity: '0' },
      '100%': { opacity: '1' },
    },
    fadeInUp: {
      '0%': { opacity: '0', transform: 'translateY(30px)' },
      '100%': { opacity: '1', transform: 'translateY(0)' },
    },
    fadeInDown: {
      '0%': { opacity: '0', transform: 'translateY(-30px)' },
      '100%': { opacity: '1', transform: 'translateY(0)' },
    },
    fadeInLeft: {
      '0%': { opacity: '0', transform: 'translateX(-30px)' },
      '100%': { opacity: '1', transform: 'translateX(0)' },
    },
    fadeInRight: {
      '0%': { opacity: '0', transform: 'translateX(30px)' },
      '100%': { opacity: '1', transform: 'translateX(0)' },
    },
    slideInUp: {
      '0%': { transform: 'translateY(100%)' },
      '100%': { transform: 'translateY(0)' },
    },
    slideInDown: {
      '0%': { transform: 'translateY(-100%)' },
      '100%': { transform: 'translateY(0)' },
    },
    scaleIn: {
      '0%': { opacity: '0', transform: 'scale(0.9)' },
      '100%': { opacity: '1', transform: 'scale(1)' },
    },
    bounceIn: {
      '0%': { opacity: '0', transform: 'scale(0.3)' },
      '50%': { transform: 'scale(1.05)' },
      '70%': { transform: 'scale(0.9)' },
      '100%': { opacity: '1', transform: 'scale(1)' },
    },
    float: {
      '0%, 100%': { transform: 'translateY(0px) rotate(0deg)' },
      '33%': { transform: 'translateY(-20px) rotate(5deg)' },
      '66%': { transform: 'translateY(-10px) rotate(-3deg)' },
    },
    pulse: {
      '0%, 100%': { opacity: '1' },
      '50%': { opacity: '0.5' },
    },
    spin: {
      '0%': { transform: 'rotate(0deg)' },
      '100%': { transform: 'rotate(360deg)' },
    },
  },

  // Dark mode specific styles
  preflights: [
    {
      getCSS: () => `
        @media (prefers-color-scheme: dark) {
          :root {
            color-scheme: dark;
          }

          .dark\\:bg-neutral-950 {
            background-color: var(--color-neutral-950);
          }

          .dark\\:text-neutral-300 {
            color: var(--color-neutral-300);
          }

          .dark\\:border-neutral-700 {
            border-color: var(--color-neutral-700);
          }

          .dark\\:shadow-glow-primary {
            box-shadow: 0 0 20px var(--color-primary-500);
          }
        }
      `,
    },
  ],

  // Responsive breakpoints matching design system
  breakpoints: {
    'xs': '475px',
    'sm': '640px',
    'md': '768px',
    'lg': '1024px',
    'xl': '1280px',
    '2xl': '1536px',
    '3xl': '1920px',
  },

  // Extractors for Astro components
  extractors: [
    {
      extractor: (code) => {
        // Extract class names from Astro components
        const classMatches = code.match(/class(?:Name)?=["'`]([^"'`]*?)["'`]/g) || []
        return classMatches.flatMap((match) => {
          const classes = match.replace(/class(?:Name)?=["'`]/, '').replace(/["'`]$/, '')
          return classes.split(/\s+/).filter(Boolean)
        })
      },
      extensions: ['astro'],
    },
  ],

  // Include all utilities
  include: [
    /\.astro$/,
    /\.tsx?$/,
    /\.jsx?$/,
  ],

  // Exclude node_modules
  exclude: [
    /node_modules/,
    /\.git/,
  ],
})