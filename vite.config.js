import { sentryVitePlugin } from '@sentry/vite-plugin'
import { defineConfig } from 'vite'
import path from 'path'
import fs from 'fs'

import nodePolyfillPlugin from './src/plugins/vite-plugin-node-polyfill'
import nodeExcludePlugin from './src/plugins/vite-plugin-node-exclude'
import externalNodePlugin from './src/plugins/vite-plugin-external-node'
import flexsearchSSRPlugin from './src/plugins/vite-plugin-flexsearch-ssr'
import middlewarePatchPlugin from './src/plugins/vite-plugin-middleware-patch'
import rewriteLoggerImportPlugin from './src/plugins/vite-plugin-rewrite-logger-import'

const cdnAssetMap = (() => {
  try {
    return JSON.parse(fs.readFileSync('./src/cdn-asset-map.json', 'utf-8'))
  } catch (error) {
    console.warn(
      'CDN asset map not found or invalid, using empty map:',
      error.message,
    )
    return {}
  }
})()

console.log('Sentry ENV Check:')
console.log('SENTRY_AUTH_TOKEN:', process.env.SENTRY_AUTH_TOKEN)
console.log('SENTRY_DSN:', process.env.SENTRY_DSN)
console.log('SENTRY_ORG:', process.env.SENTRY_ORG)
console.log('SENTRY_PROJECT:', process.env.SENTRY_PROJECT)

export default defineConfig({
  cacheDir: process.env.CI
    ? '$(Agent.WorkFolder)/.vite-cache'
    : 'node_modules/.vite',
  server: {
    watch: {
      ignored: [
        '**/node_modules/**',
        '**/ai/**',
        '**/dataset/**',
        '**/MER2025/**',
        '**/VideoChat2/**',
        '**/.git/**',
        '**/dist/**',
        '**/build/**',
        '**/*.py',
        '**/*.pyc',
        '**/__pycache__/**',
        '**/venv/**',
        '**/.venv/**',
        '**/env/**',
        '**/.env*',
        '**/logs/**',
        '**/tmp/**',
        '**/temp/**',
      ],
    },
  },
  plugins: [
    rewriteLoggerImportPlugin(),
    {
      name: 'cdn-asset-replacer',
      transform(code, id) {
        try {
          if (
            id.endsWith('.astro') ||
            id.endsWith('.tsx') ||
            id.endsWith('.jsx') ||
            id.endsWith('.ts') ||
            id.endsWith('.js')
          ) {
            Object.entries(cdnAssetMap).forEach(([localPath, cdnUrl]) => {
              const quotedLocalPath1 = `"${localPath}"`
              const quotedLocalPath2 = `'${localPath}'`
              code = code.replaceAll(quotedLocalPath1, `"${cdnUrl}"`)
              code = code.replaceAll(quotedLocalPath2, `'${cdnUrl}'`)
            })
          }
          return code
        } catch (error) {
          console.warn(`CDN asset replacement failed for ${id}:`, error.message)
          return code
        }
      },
    },
    nodePolyfillPlugin(),
    nodeExcludePlugin(),
    externalNodePlugin(),
    flexsearchSSRPlugin(),
    middlewarePatchPlugin(),
    {
      name: 'exclude-server-only',
      resolveId(id) {
        if (
          id.includes('/server-only/') ||
          id.includes('MentalLLaMAPythonBridge') ||
          id === 'mongodb' ||
          id.includes('mongodb')
        ) {
          return false
        }
      },
    },
    ...(process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_DSN
      ? [
          sentryVitePlugin({
            org: process.env.SENTRY_ORG || 'pixelated-empathy-dq',
            project: process.env.SENTRY_PROJECT || 'pixel-astro',
            authToken: process.env.SENTRY_AUTH_TOKEN,
          }),
        ]
      : []),
    sentryVitePlugin({
      org: 'pixelated-empathy-dq',
      project: 'pixel-astro',
    }),
  ],
  base:
    process.env.NODE_ENV === 'production'
      ? process.env.CDN_BASE_URL || '/'
      : '/',

  resolve: {
    alias: {
      'node:process': path.resolve('./src/lib/polyfills/browser-polyfills.ts'),
      'node:crypto': path.resolve('./src/lib/polyfills/browser-polyfills.ts'),
      'node:path': path.resolve('./src/lib/polyfills/browser-polyfills.ts'),
      'node:fs': path.resolve('./src/lib/polyfills/browser-polyfills.ts'),
      'node:child_process': path.resolve(
        './src/lib/polyfills/browser-polyfills.ts',
      ),
      'node:stream': path.resolve('./src/lib/polyfills/browser-polyfills.ts'),
      'node:util': path.resolve('./src/lib/polyfills/browser-polyfills.ts'),
      'node:events': path.resolve('./src/lib/polyfills/browser-polyfills.ts'),
      'node:os': path.resolve('./src/lib/polyfills/browser-polyfills.ts'),
      'node:http': path.resolve('./src/lib/polyfills/browser-polyfills.ts'),
      'node:https': path.resolve('./src/lib/polyfills/browser-polyfills.ts'),
      'node:zlib': path.resolve('./src/lib/polyfills/browser-polyfills.ts'),
      'node:net': path.resolve('./src/lib/polyfills/browser-polyfills.ts'),
      'node:tls': path.resolve('./src/lib/polyfills/browser-polyfills.ts'),
      'process': path.resolve('./src/lib/polyfills/browser-polyfills.ts'),
      'crypto': path.resolve('./src/lib/polyfills/browser-polyfills.ts'),
      'path': path.resolve('./src/lib/polyfills/browser-polyfills.ts'),
      'fs/promises': path.resolve('./src/lib/polyfills/browser-polyfills.ts'),
      'fs': path.resolve('./src/lib/polyfills/browser-polyfills.ts'),
      'child_process': path.resolve('./src/lib/polyfills/browser-polyfills.ts'),
      'stream': path.resolve('./src/lib/polyfills/browser-polyfills.ts'),
      'util': path.resolve('./src/lib/polyfills/browser-polyfills.ts'),
      'events': path.resolve('./src/lib/polyfills/browser-polyfills.ts'),
      'os': path.resolve('./src/lib/polyfills/browser-polyfills.ts'),
      'http': path.resolve('./src/lib/polyfills/browser-polyfills.ts'),
      'https': path.resolve('./src/lib/polyfills/browser-polyfills.ts'),
      'zlib': path.resolve('./src/lib/polyfills/browser-polyfills.ts'),
      'net': path.resolve('./src/lib/polyfills/browser-polyfills.ts'),
      'tls': path.resolve('./src/lib/polyfills/browser-polyfills.ts'),
      // Alias MongoDB to a client-safe polyfill
      'mongodb': path.resolve('./src/lib/polyfills/browser-polyfills.ts'),
      '@lib': path.resolve(__dirname, 'src/lib'),
      '@/hooks/useMentalHealthAnalysis': path.resolve(
        './src/hooks/useMentalHealthAnalysis.ts',
      ),
      '@': path.resolve(__dirname, 'src'),
      '~': path.resolve(__dirname, 'src'),
    },
    conditions: ['node', 'import', 'module', 'default'],
    extensions: ['.ts', '.tsx', '.mjs', '.js', '.jsx', '.json'],
    dedupe: ['react', 'react-dom', 'react/jsx-runtime'],
  },
  build: {
    target: 'node24',
    minify: false,
    emptyOutDir: false,
    sourcemap: true,
    rollupOptions: {
      onwarn(warning, warn) {
        // Suppress SORUCEMAP warnings
        if (warning.code === 'SOURCEMAP_ERROR') {
          return
        }
        if (
          warning.message &&
          warning.message.includes('Failed to load source map')
        ) {
          return
        }
        // Suppress Vite 'externalized for browser compatibility' and Unocss icon '-' warnings
        if (
          warning.message &&
          (warning.message.includes('externalized for browser compatibility') ||
            warning.message.includes('icon "-"') ||
            warning.message.includes("failed to load icon '-'"))
        ) {
          return
        }
        warn(warning)
      },
      external: (id) => {
        if (
          id.includes('/server-only/') ||
          id.includes('MentalLLaMAPythonBridge')
        ) {
          return true
        }
        // Exclude MongoDB from client-side bundles
        if (id === 'mongodb' || id.includes('mongodb')) {
          return true
        }
        const nodeBuiltins = [
          'node:fs',
          'node:fs/promises',
          'node:path',
          'node:os',
          'node:http',
          'node:https',
          'node:util',
          'node:child_process',
          'node:diagnostics_channel',
          'node:worker_threads',
          'node:stream',
          'node:stream/web',
          'node:zlib',
          'node:net',
          'node:tls',
          'node:inspector',
          'node:readline',
          'node:events',
          'node:crypto',
          'node:buffer',
          'node:async_hooks',
          'node:process',
          'fs',
          'fs/promises',
          'path',
          'os',
          'http',
          'https',
          'util',
          'child_process',
          'diagnostics_channel',
          'worker_threads',
          'stream',
          'zlib',
          'net',
          'tls',
          'inspector',
          'readline',
          'events',
          'crypto',
          'buffer',
          'async_hooks',
          'process',
          '@fastify/otel',
        ]
        return nodeBuiltins.includes(id)
      },
      output: {
        format: 'esm',
        intro: `
          // Polyfill Node.js globals
          if (typeof process === 'undefined') {
            globalThis.process = { env: {} };
          }
          if (typeof Buffer === 'undefined') {
            globalThis.Buffer = { from: () => new Uint8Array() };
          }
        `,
        manualChunks: {
          astroMiddleware: [
            'astro/dist/core/middleware/sequence',
            'astro/dist/core/middleware/index',
            'astro-internal:middleware',
          ],
          react: ['react', 'react-dom', 'react/jsx-runtime'],
          three: [/three/, /OrbitControls/, /@react-three/],
          tensorflow: [/@tensorflow/],
          mongodb: [/mongodb/],
          recharts: [/recharts/],
          chartjs: [/chart\.js/],
          charts: [
            /Line\.js$/,
            /generateCategoricalChart/,
            /CartesianChart/,
            /AreaChart/,
            /BarChart/,
          ],
          fhe: [/fhe/],
          emotionViz: [
            /MultidimensionalEmotionChart/,
            /EmotionTemporalAnalysisChart/,
            /EmotionDimensionalAnalysis/,
            /EmotionProgressDemo/,
            /EmotionVisualization/,
          ],
          uiComponents: [/Particle/, /SwiperCarousel/, /TherapyChatSystem/],
          dashboards: [
            /AnalyticsDashboard/,
            /AuditLogDashboard/,
            /ConversionDashboard/,
            /TreatmentPlanManager/,
          ],
          auth: [/useAuth/, /LoginForm/, /RegisterForm/],
          forms: [
            /Form/,
            /input/,
            /select/,
            /checkbox/,
            /button/,
            /label/,
            /slider/,
            /switch/,
          ],
        },
      },
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      platform: 'node',
      target: 'node24',
      define: {
        'process.env.BUILDING_FOR_AWS': JSON.stringify('1'),
        'process.env.NODE_ENV': JSON.stringify(
          process.env.NODE_ENV || 'development',
        ),
      },
    },
    exclude: ['@fastify/otel'],
  },
  ssr: {
    target: 'node',
    optimizeDeps: {
      disabled: false,
    },
    external: [
      'node:fs',
      'node:fs/promises',
      'node:path',
      'node:os',
      'node:http',
      'node:https',
      'node:util',
      'node:child_process',
      'node:diagnostics_channel',
      'node:worker_threads',
      'node:stream',
      'node:stream/web',
      'node:zlib',
      'node:net',
      'node:tls',
      'node:inspector',
      'node:readline',
      'node:events',
      'node:crypto',
      'node:buffer',
      'node:async_hooks',
      'node:process',
      'fs',
      'fs/promises',
      'path',
      'os',
      'http',
      'https',
      'util',
      'child_process',
      'diagnostics_channel',
      'worker_threads',
      'stream',
      'zlib',
      'net',
      'tls',
      'inspector',
      'readline',
      'events',
      'crypto',
      'buffer',
      'async_hooks',
      'process',
      '@fastify/otel',
      'path-to-regexp',
      'mongodb',
    ],
  },
})
