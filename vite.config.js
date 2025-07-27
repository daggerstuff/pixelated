import { sentryVitePlugin } from '@sentry/vite-plugin'
import { defineConfig } from 'vite'
import path from 'path'
import fs from 'fs'

import nodePolyfillPlugin from './src/plugins/vite-plugin-node-polyfill'
import nodeExcludePlugin from './src/plugins/vite-plugin-node-exclude'
import externalNodePlugin from './src/plugins/vite-plugin-external-node'
import flexsearchSSRPlugin from './src/plugins/vite-plugin-flexsearch-ssr'
import middlewarePatchPlugin from './src/plugins/vite-plugin-middleware-patch'

const cdnAssetMap = (() => {
  try {
    return JSON.parse(fs.readFileSync('./src/cdn-asset-map.json', 'utf-8'))
  } catch (error) {
    console.warn('CDN asset map not found or invalid, using empty map:', error.message)
    return {}
  }
})()

export default defineConfig({
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
        '**/env/**',
        '**/.env*',
        '**/logs/**',
        '**/tmp/**',
        '**/temp/**'
      ]
    }
  },
  plugins: [
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
              // Escape quotes in localPath for safe replacement
              const quotedLocalPath1 = `"${localPath}"`;
              const quotedLocalPath2 = `'${localPath}'`;
              code = code.replaceAll(quotedLocalPath1, `"${cdnUrl}"`);
              code = code.replaceAll(quotedLocalPath2, `'${cdnUrl}'`);
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
          id.includes('MentalLLaMAPythonBridge')
        ) {
          return false
        }
      },
    },
    ...(process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_DSN
      ? [
          sentryVitePlugin({
            org: process.env.SENTRY_ORG || 'pixelated-empathy-dq',
            project: process.env.SENTRY_PROJECT || 'pixelated',
            authToken: process.env.SENTRY_AUTH_TOKEN,
          }),
        ]
      : []),
  ],
  // Base URL for assets
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
      '@/hooks/useMentalHealthAnalysis': path.resolve(
        './src/hooks/useMentalHealthAnalysis.ts',
      ),
      '@': path.resolve(__dirname, 'src'),
    },
    conditions: ['node', 'import', 'module', 'default'],
    extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json'],
    dedupe: ['react', 'react-dom', 'react/jsx-runtime'],
  },
  build: {
    target: 'node22',
    minify: false,
    emptyOutDir: false,
    sourcemap: true,
    rollupOptions: {
      onwarn(warning, warn) {
        if (warning.code === 'SOURCEMAP_ERROR') {
          return
        }
        if (warning.message.includes('Failed to load source map')) {
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
          three: [/three/, /OrbitControls/],
          chart: [/chart\.js/, /Line\.js$/, /generateCategoricalChart/],
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
      target: 'node22',
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
      'path-to-regexp'
    ],
  },
})
