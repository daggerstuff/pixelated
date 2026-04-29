import path from 'node:path'
import process from 'node:process'

import node from '@astrojs/node'
import react from '@astrojs/react'
import sentry from '@sentry/astro'
import { sentryVitePlugin } from '@sentry/vite-plugin'
import UnoCSS from '@unocss/astro'
import icon from 'astro-icon'
import { defineConfig, passthroughImageService } from 'astro/config'
import { visualizer } from 'rollup-plugin-visualizer'

/** @typedef {import("rollup").RollupLog} RollupLog */
const isRailwayDeploy =
  process.env.DEPLOY_TARGET === 'railway' || !!process.env.RAILWAY_ENVIRONMENT
const isHerokuDeploy =
  process.env.DEPLOY_TARGET === 'heroku' || !!process.env.DYNO
const isFlyioDeploy =
  process.env.DEPLOY_TARGET === 'flyio' || !!process.env.FLY_APP_NAME

const isProduction = process.env.NODE_ENV === 'production'
const isDevelopment = process.env.NODE_ENV === 'development'
// Detect if we're running a build command (not dev server)
const isBuildCommand =
  process.argv.includes('build') ||
  process.env.CI === 'true' ||
  !!process.env.VERCEL
const shouldAnalyzeBundle = process.env.ANALYZE_BUNDLE === '1'
const hasSentryDSN = !!process.env.SENTRY_DSN || !!process.env.PUBLIC_SENTRY_DSN
const sentryRelease =
  process.env.SENTRY_RELEASE ?? process.env.npm_package_version ?? undefined
// const _shouldUseSpotlight = isDevelopment && process.env.SENTRY_SPOTLIGHT === '1';

/**
 * @param {{ ssr: boolean; assets: string[]; filesToDeleteAfterUpload: string[] }} params
 */
function createScopedSentryVitePlugins({
  ssr,
  assets,
  filesToDeleteAfterUpload,
}) {
  /** @type {import("vite").Plugin[]} */
  const plugins = sentryVitePlugin({
    org: process.env.SENTRY_ORG ?? 'pixelated-empathy-dq',
    project: process.env.SENTRY_PROJECT ?? 'pixel-astro',
    authToken: process.env.SENTRY_AUTH_TOKEN,
    telemetry: false,
    release: sentryRelease ? { name: sentryRelease } : undefined,
    sourcemaps: {
      assets,
      ignore: ['**/node_modules/**'],
      filesToDeleteAfterUpload,
    },
  })

  return plugins.map((plugin) => ({
    ...plugin,
    /** @param {import("vite").ConfigEnv} env */
    apply(_, env) {
      return env.command === 'build' && Boolean(env.isSsrBuild) === ssr
    },
  }))
}

const preferredPort = (() => {
  const candidates = [
    process.env.PORT,
    process.env.HTTP_PORT,
    process.env.WEBSITES_PORT,
    process.env.ASTRO_PORT,
  ]
  for (const value of candidates) {
    if (!value) continue
    const parsed = Number.parseInt(value, 10)
    if (Number.isInteger(parsed) && parsed > 0 && parsed < 65536) {
      return parsed
    }
  }
  return 4321
})()

/**
 * @param {string} id
 */
function getChunkName(id) {
  const normalizedId = id.replace(/\\/g, '/')

  if (
    normalizedId.includes('/src/components/three/MultidimensionalEmotionChart')
  ) {
    return 'feature-three-emotion'
  }
  if (normalizedId.includes('/src/components/three/Particle')) {
    return 'feature-three-particle'
  }
  if (
    normalizedId.includes('/src/components/analytics/EnhancedChartComponent')
  ) {
    return 'feature-enhanced-chart'
  }
  if (normalizedId.includes('/src/components/ui/SwiperCarousel')) {
    return 'feature-swiper'
  }
  if (
    normalizedId.includes('/src/components/treatment/TreatmentPlanManager') ||
    normalizedId.includes('/src/components/therapy/TreatmentPlanManager')
  ) {
    return 'feature-treatment-plan'
  }
  if (normalizedId.includes('/src/components/security/FHEDemo')) {
    return 'feature-fhe'
  }
  if (normalizedId.includes('/src/components/demo/FHEDemo')) {
    return 'feature-fhe-demo'
  }
  if (normalizedId.includes('/src/components/chat/TherapyChatSystem')) {
    return 'feature-therapy-chat'
  }
  if (
    normalizedId.includes(
      '/src/components/session/EmotionTemporalAnalysisChart',
    )
  ) {
    return 'feature-emotion-temporal'
  }

  // Split large vendor libraries into separate chunks for better caching
  if (
  ) {
  }
  if (
    normalizedId.includes('/p5/') ||
    normalizedId.includes('/node_modules/p5/') ||
    normalizedId.includes('p5/') ||
    normalizedId.includes('/p5.js/') ||
    normalizedId.includes('/node_modules/p5.js/') ||
    normalizedId.includes('p5.js/')
  ) {
    return 'p5-vendor'
  }
  if (
    normalizedId.includes('/@azure/') ||
    normalizedId.includes('/node_modules/@azure/') ||
    normalizedId.includes('@azure/')
  ) {
    return 'azure-vendor'
  }
  if (
    normalizedId.includes('/@google-cloud/') ||
    normalizedId.includes('/node_modules/@google-cloud/') ||
    normalizedId.includes('@google-cloud/')
  ) {
    return 'google-cloud-vendor'
  }
  if (
    normalizedId.includes('/@opentelemetry/') ||
    normalizedId.includes('/node_modules/@opentelemetry/') ||
    normalizedId.includes('@opentelemetry/')
  ) {
    return 'opentelemetry-vendor'
  }
  if (
  ) {
  }
  if (
    normalizedId.includes('/express/') ||
    normalizedId.includes('/node_modules/express/') ||
    normalizedId.includes('express/')
  ) {
    return 'express-vendor'
  }
  if (
    normalizedId.includes('/mongoose/') ||
    normalizedId.includes('/node_modules/mongoose/') ||
    normalizedId.includes('mongoose/')
  ) {
    return 'mongoose-vendor'
  }
  if (
    normalizedId.includes('/react/') ||
    normalizedId.includes('/node_modules/react/') ||
    normalizedId.includes('react/') ||
    normalizedId.includes('/react-dom/') ||
    normalizedId.includes('/node_modules/react-dom/') ||
    normalizedId.includes('react-dom/')
  ) {
    return 'react-vendor'
  }
  if (
    normalizedId.includes('framer-motion') ||
    normalizedId.includes('/node_modules/framer-motion/') ||
    normalizedId.includes('framer-motion/') ||
    normalizedId.includes('@radix-ui/react-virtualizer') ||
    normalizedId.includes('/node_modules/@radix-ui/react-virtualizer/') ||
    normalizedId.includes('@radix-ui/react-virtualizer/') ||
    normalizedId.includes('lucide-react') ||
    normalizedId.includes('/node_modules/lucide-react/') ||
    normalizedId.includes('lucide-react/')
  ) {
    return 'ui-vendor'
  }
  if (
    normalizedId.includes('/clsx/') ||
    normalizedId.includes('/node_modules/clsx/') ||
    normalizedId.includes('clsx/') ||
    normalizedId.includes('/date-fns/') ||
    normalizedId.includes('/node_modules/date-fns/') ||
    normalizedId.includes('date-fns/') ||
    normalizedId.includes('/axios/') ||
    normalizedId.includes('/node_modules/axios/') ||
    normalizedId.includes('axios/')
  ) {
    return 'utils-vendor'
  }
  if (
    normalizedId.includes('/recharts/') ||
    normalizedId.includes('/node_modules/recharts/') ||
    normalizedId.includes('recharts/') ||
    normalizedId.includes('/react-chartjs-2/') ||
    normalizedId.includes('/node_modules/react-chartjs-2/') ||
    normalizedId.includes('react-chartjs-2/')
  ) {
    return 'charts-vendor'
  }
  if (
    normalizedId.includes('/chart.js/') ||
    normalizedId.includes('/node_modules/chart.js/') ||
    normalizedId.includes('chart.js/') ||
    normalizedId.includes('/chart.js') ||
    normalizedId.includes('/node_modules/chart.js') ||
    normalizedId.includes('chart.js')
  ) {
    return 'chartjs-vendor'
  }
  if (
    normalizedId.includes('three') ||
    normalizedId.includes('/node_modules/three/') ||
    normalizedId.includes('three/') ||
    normalizedId.includes('@react-three') ||
    normalizedId.includes('/node_modules/@react-three/') ||
    normalizedId.includes('@react-three/')
  ) {
    return 'three-vendor'
  }
  if (
    normalizedId.includes('/swiper/') ||
    normalizedId.includes('/node_modules/swiper/') ||
    normalizedId.includes('swiper/')
  ) {
    return 'swiper-vendor'
  }
  // Split large vendor libraries into separate chunks for better caching
  if (
    normalizedId.includes('/node_modules/@aws-sdk/') ||
    normalizedId.includes('\\node_modules\\@aws-sdk\\')
  ) {
    return 'aws-sdk-vendor'
  }
  if (
    normalizedId.includes('/node_modules/@azure/') ||
    normalizedId.includes('\\node_modules\\@azure\\')
  ) {
    return 'azure-vendor'
  }
  if (
    normalizedId.includes('/node_modules/@google-cloud/') ||
    normalizedId.includes('\\node_modules\\@google-cloud\\')
  ) {
    return 'google-cloud-vendor'
  }
  if (
    normalizedId.includes('/node_modules/@opentelemetry/') ||
    normalizedId.includes('\\node_modules\\@opentelemetry\\')
  ) {
    return 'opentelemetry-vendor'
  }
  if (
  ) {
  }
  if (
    normalizedId.includes('/node_modules/express/') ||
    normalizedId.includes('\\node_modules\\express\\')
  ) {
    return 'express-vendor'
  }
  if (
    normalizedId.includes('/node_modules/mongoose/') ||
    normalizedId.includes('\\node_modules\\mongoose\\')
  ) {
    return 'mongoose-vendor'
  }
  if (normalizedId.includes('/node_modules/')) {
    return 'vendor'
  }
  return null
}

const adapter = (() => {
  if (isRailwayDeploy) {
    console.log('🚂 Using Node adapter for Railway deployment')
    return node({
      mode: 'standalone',
    })
  }

  if (isHerokuDeploy) {
    console.log('🟣 Using Node adapter for Heroku deployment')
    return node({
      mode: 'standalone',
    })
  }

  // Fly.io deployment
  if (isFlyioDeploy) {
    console.log('✈️ Using Node adapter for Fly.io deployment')
    return node({
      mode: 'standalone',
    })
  }

  // Default: Node adapter for Kubernetes/standard deployments
  console.log('🟢 Using Node adapter for standard deployment')
  return node({
    mode: 'standalone',
  })
})()

// https://astro.build/config
export default defineConfig({
  site: process.env.PUBLIC_SITE_URL ?? 'https://pixelatedempathy.com',
  output: 'server',
  adapter,
  trailingSlash: 'ignore',
  build: {
    format: 'directory',
    // Enable source maps in production for Sentry (hidden, not served to users)
    sourcemap: hasSentryDSN || !isProduction,
    copy: [
      {
        from: 'templates/email',
        to: 'templates/email',
      },
    ],
    rollupOptions: {
      output: {
        // Manual chunk splitting for better caching
        manualChunks: getChunkName,
        // Optimized chunk naming for better caching
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },
  vite: {
    server: {
      watch: {
        ignored: [
          // Aggressive node_modules exclusion at Vite level
          /**
           * @param {string} p
           */
          (p) =>
            p.includes('/node_modules/') ||
            p.includes('\\node_modules\\') ||
            p.includes('/.venv/') ||
            p.includes('\\.venv\\') ||
            p.includes('/ai/') ||
            p.includes('\\ai\\'),
          '**/node_modules/**',
          '/node_modules/**',
          'node_modules/**',
          './node_modules/**',
        ],
      },
    },
    build: {
      // Enable hidden source maps in production for Sentry upload (not served to users)
      sourcemap: !isProduction || hasSentryDSN ? 'hidden' : false,
      target: 'node24',
      chunkSizeWarningLimit: isProduction ? 500 : 1500,
      // Re-enable minification for production to reduce chunk sizes
      minify: isProduction ? 'terser' : false,
      terserOptions: isProduction
        ? {
            compress: {
              drop_console: true,
              drop_debugger: true,
              pure_funcs: ['console.log', 'console.info', 'console.debug'],
            },
            mangle: {
              safari10: true,
            },
          }
        : {},
      rollupOptions: {
        // Limit parallel file operations to prevent resource exhaustion
        maxParallelFileOps: 2,
        external: [
          '@google-cloud/storage',
          '@aws-sdk/client-s3',
          '@aws-sdk/client-dynamodb',
          '@aws-sdk/client-kms',
          'redis',
          'ioredis',
          'pg',
          'mysql2',
          'sqlite3',
          'better-sqlite3',
          'axios',
          'bcryptjs',
          'jsonwebtoken',
          'pdfkit',
          '@tensorflow/tfjs',
          '@tensorflow/tfjs-layers',
          'three',
          '@react-three/fiber',
          '@react-three/drei',
          'mongodb',
          'recharts',
          'chart.js',
          '@opentelemetry/api',
          '@opentelemetry/otlp-exporter-base',
          '@opentelemetry/exporter-trace-otlp-http',
          '@opentelemetry/exporter-metrics-otlp-http',
          '@opentelemetry/otlp-transformer',
          /^@opentelemetry\//,
        ],
        /** @param {RollupLog} warning */
        /** @param {(warning: RollupLog) => void} warn */
        onwarn(warning, warn) {
          if (
            warning.code === 'SOURCEMAP_ERROR' ||
            warning.message.includes("didn't generate a sourcemap")
          ) {
            return
          }
          if (
            warning.message.includes(
              'externalized for browser compatibility',
            ) ||
            warning.message.includes('experimentalDisableStreaming') ||
            (warning.message.includes('dynamically imported') &&
              warning.message.includes('statically imported')) ||
            warning.message.includes('icon "-"') ||
            warning.message.includes("failed to load icon '-'")
          ) {
            return
          }
          warn(warning)
        },
      },
    },
    plugins: [
      ...(hasSentryDSN
        ? [
            ...createScopedSentryVitePlugins({
              ssr: false,
              assets: [
                './dist/client/_astro/**/*.js',
                './dist/client/_astro/**/*.js.map',
              ],
              filesToDeleteAfterUpload: ['./dist/client/_astro/**/*.map'],
            }),
            ...createScopedSentryVitePlugins({
              ssr: true,
              assets: ['./dist/server/**/*.mjs', './dist/server/**/*.mjs.map'],
              filesToDeleteAfterUpload: ['./dist/server/**/*.map'],
            }),
          ]
        : []),
      // Bundle analyzer for production builds
      shouldAnalyzeBundle &&
        visualizer({
          filename: 'dist/bundle-analysis.html',
          open: true,
          gzipSize: true,
          brotliSize: true,
        }),
    ].filter(Boolean),
    resolve: {
      alias: {
        '~': path.resolve('./src'),
        '@': path.resolve('./src'),
        '@components': path.resolve('./src/components'),
        '@layouts': path.resolve('./src/layouts'),
        '@utils': path.resolve('./src/utils'),
        '@lib': path.resolve('./src/lib'),
        stream: 'stream-browserify',
        zlib: 'browserify-zlib',
        buffer: 'buffer',
        util: 'util',
      },
      extensions: ['.astro', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.json'],
      preserveSymlinks: false,
      mainFields: ['module', 'main'],
      conditions: ['import', 'module', 'browser', 'default'],
    },
    ssr: {
      noExternal: [
        'stream-browserify',
        'browserify-zlib',
        'buffer',
        'util',
        'path-browserify',
        'events',
      ],
      external: [
        '@google-cloud/storage',
        '@aws-sdk/client-s3',
        '@aws-sdk/client-dynamodb',
        '@aws-sdk/client-kms',
        'redis',
        'ioredis',
        'pg',
        'mysql2',
        'sqlite3',
        'better-sqlite3',
        'axios',
        'bcryptjs',
        'jsonwebtoken',
        'pdfkit',
        'sharp',
        'canvas',
        'puppeteer',
        'playwright',
        '@sentry/profiling-node',
        '@tensorflow/tfjs',
        '@tensorflow/tfjs-layers',
        'three',
        '@react-three/fiber',
        '@react-three/drei',
        'mongodb',
        'recharts',
        'chart.js',
        '@opentelemetry/api',
        '@opentelemetry/otlp-exporter-base',
        '@opentelemetry/exporter-trace-otlp-http',
        '@opentelemetry/exporter-metrics-otlp-http',
        '@opentelemetry/otlp-transformer',
        /^@opentelemetry\//,
      ],
    },
    optimizeDeps: {
      entries: [
        'src/pages/**/*.{ts,tsx,js,jsx,astro}',
        'src/layouts/**/*.{ts,tsx,js,jsx,astro}',
        'src/components/**/*.{ts,tsx,js,jsx,astro}',
        'src/middleware.ts',
      ],
      exclude: [
        '@aws-sdk/client-s3',
        '@aws-sdk/client-kms',
        'sharp',
        'canvas',
        'puppeteer',
        'playwright',
        '@sentry/profiling-node',
        'pdfkit',
        'axios',
        'bcryptjs',
        'jsonwebtoken',
        'recharts',
        'lucide-react',
        '@tensorflow/tfjs',
        '@tensorflow/tfjs-layers',
        'three',
        '@react-three/fiber',
        '@react-three/drei',
        'mongodb',
        'recharts',
        'chart.js',
        '@spotlightjs/astro',
        'framer-motion',
        'zustand',
        'jotai',
        '@tanstack/react-query',
      ],
    },
  },
  integrations: (() => {
    const MIN_DEV = process.env.MIN_DEV === '1'
    const base = [
      react({
        include: ['**/react/*', '**/components/**/*'],
        experimentalReactChildren: true,
      }),
    ]
    if (MIN_DEV) return base
    return [
      ...base,
      UnoCSS({ injectReset: true }),
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
      ...(hasSentryDSN
        ? [
            sentry({
              telemetry: false,
              // Upload sourcemaps through the Vite plugin so each Astro build
              // phase only uploads the files it actually emitted.
              sourcemaps: {
                disable: true,
              },
            }),
            // Temporarily disable SpotlightJS due to build issues
            // ...(shouldUseSpotlight ? [spotlightjs()] : [])
          ]
        : []),
    ]
  })(),
  markdown: {
    shikiConfig: {
      theme: 'github-dark',
      wrap: true,
    },
  },
  security: {
    checkOrigin: true,
  },
  server: {
    port: preferredPort,
    host: '0.0.0.0',
    strictPort: false,
    watch: {
      followSymlinks: false,
      ignored: [
        // Hard guard first: function ignore for node_modules and .venv anywhere
        /**
         * @param {string} p
         */
        (p) =>
          p.includes('/node_modules/') ||
          p.includes('\\node_modules\\') ||
          p.includes('/.venv/') ||
          p.includes('\\.venv\\') ||
          p.includes('/ai/') ||
          p.includes('\\ai\\'),
        // Python virtual environments and cache
        '**/.venv/**',
        '.venv/**',
        '**/.uv/**',
        '.uv/**',
        '**/.python/**',
        '.python/**',
        '**/site-packages/**',
        '**/venv/**',
        'venv/**',
        '**/__pycache__/**',
        '__pycache__/**',
        '**/*.py',
        '**/*.pyc',
        '**/*.pyo',
        '**/*.pyd',
        '**/.ruff_cache/**',
        '.ruff_cache/**',
        '**/.pytest_cache/**',
        '.pytest_cache/**',
        // AI and data directories
        '/ai/**',
        '**/ai/**',
        '**/dataset/**',
        '**/MER2025/**',
        '**/VideoChat2/**',
        // Build and cache directories
        '/logs/**',
        'logs/**',
        '/tmp/**',
        'tmp/**',
        '/temp/**',
        'temp/**',
        '/coverage/**',
        'coverage/**',
        // Node modules (should already be ignored but being explicit)
        '**/node_modules/**',
        '/node_modules/**',
        'node_modules/**',
        // pnpm and Vite caches inside node_modules
        '**/node_modules/.pnpm/**',
        'node_modules/.pnpm/**',
        '**/node_modules/.vite/**',
        'node_modules/.vite/**',
        '**/node_modules/.cache/**',
        'node_modules/.cache/**',
        // miscellaneous caches
        '**/.pnpm/**',
        '.pnpm/**',
        '**/.vite/**',
        '.vite/**',
        '**/.cache/**',
        '.cache/**',
        // MCP server
        '/mcp_server/**',
        'mcp_server/**',
        '**/mcp_server/**',
        // Other ignored paths
        '/env/**',
        'env/**',
        '**/.git/**',
        '**/.DS_Store',
        '**/dist/**',
        '**/.astro/**',
        // Final guard: regex-based ignore for ai/.venv on any platform
        /\/ai\/\.venv\//,
        // Guard for any .venv path (root or nested)
        /\/.venv\//,
        /\.venv\//,
      ],
      usePolling: false,
    },
    fs: {
      strict: true,
      allow: [
        path.resolve('./src'),
        path.resolve('./public'),
        path.resolve('./.astro'),
      ],
      deny: [
        'node_modules',
        '/node_modules',
        '**/node_modules/**',
        './node_modules',
        './node_modules/**',
        'ai',
        '/ai',
        '**/ai/**',
        '.venv',
        '/.venv',
        '**/.venv/**',
      ],
    },
  },

  preview: {
    port: 4322,
    host: '0.0.0.0',
  },
  image: {
    service: passthroughImageService(),
    domains: ['pixelatedempathy.com', 'cdn.pixelatedempathy.com'],
  },
  redirects: {
    '/admin': '/admin/dashboard',
    '/docs': '/docs/getting-started',
  },
  devToolbar: {
    enabled: isDevelopment,
  },
})
