import path from 'node:path'
import process from 'node:process'
import mdx from '@astrojs/mdx'
import react from '@astrojs/react'
import UnoCSS from '@unocss/astro'
import { defineConfig, passthroughImageService } from 'astro/config'
import flexsearchIntegration from './src/integrations/search.js'
import expressiveCode from 'astro-expressive-code'
import icon from 'astro-icon'
import flexsearchSSRPlugin from './src/plugins/vite-plugin-flexsearch-ssr'
import sentry from '@sentry/astro'
import markdoc from '@astrojs/markdoc'
import keystatic from '@keystatic/astro'
import vercel from '@astrojs/vercel/serverless'

// Vercel-optimized configuration
export default defineConfig({
  site: process.env.PUBLIC_SITE_URL || 'https://pixelatedempathy.com',

  // Use hybrid output for Vercel - static by default, server when needed
  output: 'hybrid',

  // Vercel handles routing optimally
  trailingSlash: 'ignore',

  // Build configuration optimized for Vercel
  build: {
    format: 'directory',
    assets: '_astro',
    inlineStylesheets: 'auto',
    concurrency: 4, // Higher concurrency for Vercel's build environment
  },

  // Vite configuration optimized for Vercel
  vite: {
    resolve: {
      alias: {
        '~': path.resolve('./src'),
        '@': path.resolve('./src'),
        '@components': path.resolve('./src/components'),
        '@layouts': path.resolve('./src/layouts'),
        '@utils': path.resolve('./src/utils'),
        '@lib': path.resolve('./src/lib'),
      },
      conditions: ['node', 'import', 'module', 'browser', 'default'],
    },

    plugins: [
      flexsearchSSRPlugin(),
      {
        name: 'disable-sentry-telemetry',
        config() {
          return {
            define: {
              'process.env.SENTRY_DISABLE_TELEMETRY': 'true',
            },
          }
        },
      },
      {
        name: 'vercel-optimizations',
        resolveId(id) {
          // Block server-only modules for Vercel edge functions
          const serverOnlyModules = [
            'fsevents',
            'chokidar',
            'sharp',
            'canvas',
            'puppeteer',
            'playwright',
          ]

          if (serverOnlyModules.some((mod) => id.includes(mod))) {
            return { id: 'virtual:empty', external: false }
          }

          return null
        },
        load(id) {
          if (id === 'virtual:empty') {
            return 'export default {};'
          }
        },
      },
    ],

    // Handle KaTeX font assets
    assetsInclude: ['**/*.woff', '**/*.woff2', '**/*.ttf'],

    // Suppress warnings during build
    logLevel: 'warn',

    define: {
      // Environment variables for Vercel
      'process.env.VERCEL_ENV': JSON.stringify(process.env.VERCEL_ENV),
      'process.env.VERCEL_URL': JSON.stringify(process.env.VERCEL_URL),
    },

    build: {
      // Optimize for Vercel serverless functions
      target: 'es2022',
      minify: 'esbuild', // Faster than terser for Vercel
      sourcemap: 'hidden',
      chunkSizeWarningLimit: 1000, // Smaller chunks for serverless
      rollupOptions: {
        external: (id) => {
          // Externalize heavy server-only modules
          const heavyModules = [
            'sharp',
            'canvas',
            'puppeteer',
            'playwright',
            'fsevents',
            'chokidar',
          ]
          return heavyModules.some((mod) => id.includes(mod))
        },
        output: {
          manualChunks: (id) => {
            if (id.includes('node_modules')) {
              if (id.includes('react')) {
                return 'vendor-react'
              }
              if (id.includes('@headlessui') || id.includes('@heroicons')) {
                return 'vendor-ui'
              }
              if (id.includes('date-fns') || id.includes('clsx')) {
                return 'vendor-utils'
              }
              return 'vendor'
            }
          },
        },
      },
    },

    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        '@headlessui/react',
        '@heroicons/react/24/outline',
        '@heroicons/react/24/solid',
      ],
      exclude: [
        'msw',
        'virtual:keystatic-config',
        'sharp',
        'canvas',
        'puppeteer',
        'playwright',
        'fsevents',
        'chokidar',
      ],
    },

    ssr: {
      // External dependencies for Vercel serverless
      external: [
        'sharp',
        'canvas',
        'puppeteer',
        'playwright',
        'fsevents',
        'chokidar',
      ],
    },
  },

  // Integrations optimized for Vercel
  integrations: [
    expressiveCode({
      themes: ['github-dark', 'github-light'],
      styleOverrides: {
        borderRadius: '0.5rem',
      },
    }),
    react(),
    mdx({
      components: path.resolve('./mdx-components.js'),
    }),
    UnoCSS({
      injectReset: true,
      mode: 'global',
      safelist: ['font-sans', 'font-mono', 'font-condensed'],
      configFile: './uno.config.ts',
    }),
    icon({
      include: {
        lucide: [
          'calendar',
          'user',
          'settings',
          'heart',
          'brain',
          'shield-check',
          'info',
          'arrow-left',
          'shield',
          'user-plus',
        ],
      },
      svgdir: './src/icons',
    }),
    flexsearchIntegration(),
    markdoc(),
    ...(process.env.SKIP_KEYSTATIC !== 'true' ? [keystatic()] : []),
    sentry({
      dsn: process.env.SENTRY_DSN,
      sourceMapsUploadOptions: {
        project: process.env.SENTRY_PROJECT || 'pixel-astro',
        org: process.env.SENTRY_ORG || 'pixelated-empathy-dq',
        authToken: process.env.SENTRY_AUTH_TOKEN,
      },
      telemetry: false,
    }),
  ],

  // Markdown configuration
  markdown: {
    shikiConfig: {
      theme: 'github-dark',
      wrap: true,
    },
  },

  // Security headers
  security: {
    checkOrigin: true,
  },

  // Server configuration for development
  server: {
    port: 4321,
    host: true,
  },

  // Preview configuration
  preview: {
    port: 4322,
    host: true,
  },

  // Vercel adapter configuration
  adapter: vercel({
    webAnalytics: {
      enabled: true,
    },
    speedInsights: {
      enabled: true,
    },
    functionPerRoute: false, // Use single function for better cold start performance
    edgeMiddleware: true,
  }),

  // Image optimization for Vercel
  image: {
    service: passthroughImageService(),
    domains: ['pixelatedempathy.com', 'cdn.pixelatedempathy.com', 'vercel.app'],
    defaultStrategy: 'viewport',
  },

  // Redirects
  redirects: {
    '/admin': '/admin/dashboard',
    '/docs': '/docs/getting-started',
  },

  // Compressor configuration
  compressHTML: true,

  // Environment-specific configuration
  ...(process.env.NODE_ENV === 'development' && {
    devToolbar: {
      enabled: true,
    },
  }),

  ...(process.env.NODE_ENV === 'production' && {
    devToolbar: {
      enabled: false,
    },
  }),
})
