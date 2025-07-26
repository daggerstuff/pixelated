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
import node from '@astrojs/node'

// AWS Lambda optimized configuration
export default defineConfig({
  site: process.env.PUBLIC_SITE_URL || 'https://pixelatedempathy.com',

  // Use server output for AWS Lambda
  output: 'server',

  // AWS handles routing through CloudFront
  trailingSlash: 'ignore',

  // Build configuration optimized for AWS Lambda
  build: {
    format: 'directory',
    assets: '_astro',
    assetsPrefix: process.env.AWS_CLOUDFRONT_URL || undefined,
    inlineStylesheets: 'auto',
    concurrency: 3, // Balanced for AWS build environments
  },

  // Vite configuration for AWS deployment
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
        name: 'aws-lambda-optimizations',
        resolveId(id) {
          // Block problematic modules for AWS Lambda
          const blockedModules = ['fsevents', 'chokidar', 'sharp', 'canvas']

          if (blockedModules.some((mod) => id.includes(mod))) {
            return { id: 'virtual:empty', external: false }
          }

          // Externalize Node.js built-ins for Lambda
          const nodeModules = [
            'fs',
            'path',
            'crypto',
            'os',
            'child_process',
            'worker_threads',
            'stream',
            'zlib',
            'http',
            'https',
            'net',
            'tls',
            'util',
            'events',
            'string_decoder',
            'readline',
            'inspector',
            'diagnostics_channel',
            'async_hooks',
            'url',
            'module',
            'constants',
            'assert',
          ]

          if (nodeModules.includes(id) || id.startsWith('node:')) {
            return { id, external: true }
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
      // AWS-specific environment variables
      'process.env.AWS_REGION': JSON.stringify(process.env.AWS_REGION),
      'process.env.AWS_DEPLOYMENT': JSON.stringify(process.env.AWS_DEPLOYMENT),
      'process.env.AWS_LAMBDA_FUNCTION_NAME': JSON.stringify(
        process.env.AWS_LAMBDA_FUNCTION_NAME,
      ),
    },

    build: {
      // Optimize for AWS Lambda
      target: 'es2022',
      minify: 'esbuild', // Faster builds for AWS
      sourcemap: 'hidden',
      chunkSizeWarningLimit: 1500, // Lambda has size limits
      commonjsOptions: {
        ignore: ['chokidar', 'fsevents', 'sharp', 'canvas'],
        transformMixedEsModules: true,
      },
      rollupOptions: {
        external: (id) => {
          // Externalize problematic modules for Lambda
          const lambdaExternals = [
            'fsevents',
            'chokidar',
            'sharp',
            'canvas',
            'puppeteer',
            'playwright',
          ]

          if (lambdaExternals.some((mod) => id.includes(mod))) {
            return true
          }

          // Always externalize Node.js built-ins
          if (
            id.startsWith('node:') ||
            [
              'fs',
              'path',
              'crypto',
              'os',
              'child_process',
              'worker_threads',
              'stream',
              'zlib',
              'http',
              'https',
              'net',
              'tls',
              'util',
              'events',
            ].includes(id)
          ) {
            return true
          }

          // Externalize AWS SDK (available in Lambda runtime)
          if (id.includes('@aws-sdk')) {
            return true
          }

          return false
        },
        output: {
          manualChunks: (id) => {
            if (id.includes('node_modules')) {
              if (id.includes('react')) {
                return 'vendor-react'
              }
              if (id.includes('@aws-sdk')) {
                return 'vendor-aws'
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
        'chokidar',
        'fsevents',
        'sharp',
        'canvas',
        'puppeteer',
        'playwright',
        '@aws-sdk/client-s3',
        '@aws-sdk/client-lambda',
      ],
    },

    ssr: {
      // External dependencies for AWS Lambda
      external: [
        '@aws-sdk/client-s3',
        '@aws-sdk/client-lambda',
        '@aws-sdk/client-cloudfront',
        'chokidar',
        'fsevents',
        'sharp',
        'canvas',
      ],
    },
  },

  // Integrations optimized for AWS
  integrations: [
    // Conditionally disable heavy integrations for AWS deployment
    ...(process.env.AWS_DEPLOYMENT !== '1'
      ? [
          expressiveCode({
            themes: ['github-dark', 'github-light'],
            styleOverrides: {
              borderRadius: '0.5rem',
            },
          }),
          flexsearchIntegration(),
        ]
      : []),
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

  // AWS Lambda adapter configuration
  adapter: node({
    mode: 'standalone',
  }),

  // Image optimization for AWS
  image: {
    service: passthroughImageService(),
    domains: [
      'pixelatedempathy.com',
      'cdn.pixelatedempathy.com',
      process.env.AWS_CLOUDFRONT_URL?.replace('https://', '') || '',
    ].filter(Boolean),
    defaultStrategy: 'viewport',
  },

  // Redirects (handled by CloudFront)
  redirects: {
    '/admin': '/admin/dashboard',
    '/docs': '/docs/getting-started',
  },

  // Compressor configuration
  compressHTML: true,

  // Base configuration
  base: process.env.AWS_BASE_PATH || '/',

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
