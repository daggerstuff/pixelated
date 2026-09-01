import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

import node from '@astrojs/node'
import react from '@astrojs/react'
import vercel from '@astrojs/vercel'
import sentry from '@sentry/astro'
import { sentryVitePlugin } from '@sentry/vite-plugin'
import UnoCSS from '@unocss/astro'
import { defineConfig, passthroughImageService } from 'astro/config'
import { visualizer } from 'rollup-plugin-visualizer'
import { loadEnv, createLogger } from 'vite'

/** @typedef {import("rollup").RollupLog} RollupLog */
// ECS Fargate requires the Node adapter.
// Force the Node adapter regardless of any Vercel-provided env vars
// (VERCEL, DEPLOY_TARGET) that the Vercel build sandbox injects automatically.
const isVercelDeploy = !!process.env.VERCEL

const isProduction = process.env.NODE_ENV === 'production'
const isDevelopment = process.env.NODE_ENV === 'development'

// Explicitly load environment variables from .env files into process.env
// for use during configuration evaluation (e.g. Sentry DSN check).
const loadedEnv = loadEnv(
  process.env.NODE_ENV ?? 'development',
  process.cwd(),
  '',
)
Object.assign(process.env, loadedEnv)

const shouldAnalyzeBundle = process.env.ANALYZE_BUNDLE === '1'
const hasSentryDSN =
  !!process.env.SENTRY_DSN ||
  !!process.env.PUBLIC_SENTRY_DSN ||
  !!process.env.SENTRY_PUBLIC_DSN ||
  !!process.env.VITE_SENTRY_DSN
const sentryRelease =
  process.env.SENTRY_RELEASE ?? process.env.npm_package_version ?? undefined

/**
 * @typedef {{ ssr: boolean, assets: string[], filesToDeleteAfterUpload: string[] }} SentryPluginOptions
 */

/**
 * Scope Sentry sourcemap uploads to client/SSR build phases only.
 * Without this, the prerender Vite environment triggers
 * "Didn't find any matching sources for debug ID upload".
 * @param {SentryPluginOptions} opts
 * @returns {Array<import('vite').Plugin>}
 */
function createScopedSentryVitePlugins({
  ssr,
  assets,
  filesToDeleteAfterUpload,
}) {
  return sentryVitePlugin({
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
  }).map((plugin) => ({
    ...plugin,
    /**
     * @param {{build?: { ssr?: boolean }}} config
     * @param {{ command: string }} env
     * @returns {boolean}
     */
    apply(config, env) {
      if (env.command !== 'build') {
        return false
      }
      return Boolean(config.build?.ssr) === ssr
    },
  }))
}

/**
 * Astro's `site` config must be a valid absolute URL.
 * Some CI environments provide hostnames without protocol; normalize safely.
 * @param {string | undefined} value
 */
function normalizeSiteUrl(value) {
  if (!value) return 'https://pixelatedempathy.com'
  try {
    return new URL(value).toString()
  } catch {
    try {
      return new URL(`https://${value}`).toString()
    } catch {
      return 'https://pixelatedempathy.com'
    }
  }
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

const adapter = (() => {
  if (isVercelDeploy) {
    console.log('▲ Using Vercel adapter for Vercel deployment')
    return vercel({
      // "web" produces a proper Vercel serverless function (for Vercel's runtime),
      // matching the shape Vercel expects and routing all requests through it.
      // "serve" (the default) targets self-hosted edge runtimes and is why
      // Vercel returns 404 NOT_FOUND — it can't find a serverless handler.
      web: true,
      // paths containing "+" characters that decodeURIComponent misinterprets.
      nft: false,
      excludeFiles: ['./ai/**/*'],
    })
  }
  console.log('🟢 Using Node adapter for standard deployment')
  return node({
    mode: 'middleware',
  })
})()

// https://astro.build/config
export default defineConfig({
  srcDir: './apps/web/src',
  publicDir: './apps/web/public',
  site: normalizeSiteUrl(process.env.PUBLIC_SITE_URL),
  output: 'server',
  adapter,
  trailingSlash: 'ignore',
  build: {
    // Node adapter handler lands in entry2.mjs because Astro middleware keeps entry.mjs.
    serverEntry: isVercelDeploy ? 'index.js' : 'entry2.mjs',
    format: 'directory',
    // Enable hidden source maps in production for Sentry upload.
    // "hidden" generates .map files but omits the //# sourceMappingURL comment
    // so maps are never exposed to users, yet Sentry can still use them.
    sourcemap: hasSentryDSN ? 'hidden' : !isProduction,
    copy: [
      {
        from: 'content/templates/email',
        to: 'content/templates/email',
      },
    ],
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
        /**
         * Suppress sourcemap warnings from Astro's internal plugins
         * (astro:build, astro:transitions) that transform output but don't
         * generate sourcemaps. These use Rollup code SOURCEMAP_BROKEN.
         * @param {Record<string, unknown> & { code?: string; message?: string }} warning
         */
        onwarn(warning, defaultHandler) {
          const astroInternalPlugins = ['astro:build', 'astro:transitions']
          const isAstroInternalSourcemapWarning =
            astroInternalPlugins.includes(warning.plugin) &&
            (warning.code === 'SOURCEMAP_BROKEN' ||
              warning.code === 'SOURCEMAP_ERROR' ||
              (typeof warning.message === 'string' &&
                warning.message.includes(
                  'Sourcemap is likely to be incorrect',
                )))

          if (isAstroInternalSourcemapWarning) {
            return
          }
          defaultHandler?.(warning)
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
      {
        name: 'fix-vite-client-input',
        buildApp: {
          order: 'pre',
          async handler(builder) {
            const originalBuild = builder.build.bind(builder)
            builder.build = async (environment) => {
              if (environment.name === 'client') {
                const rolldownOptions =
                  environment.config.build?.rolldownOptions
                if (rolldownOptions) {
                  const { checks: _checks, ...rollupCompatibleOptions } =
                    rolldownOptions
                  environment.config.build.rollupOptions = {
                    ...(environment.config.build.rollupOptions ?? {}),
                    ...rollupCompatibleOptions,
                  }
                }
              }
              return originalBuild(environment)
            }
          },
        },
      },
      {
        name: 'fix-vite-ssr-input',
        enforce: 'post',
        resolveId(id) {
          if (id === 'virtual:dummy-ssr-entry') {
            return '\0virtual:dummy-ssr-entry'
          }
        },
        load(id) {
          if (id === '\0virtual:dummy-ssr-entry') {
            return 'export default {}'
          }
        },
        config(config) {
          if (config.environments) {
            const ASTRO_MANAGED_ENVS = new Set(['client', 'server', 'ssr'])

            for (const [name, env] of Object.entries(config.environments)) {
              // Propagate top-level build.sourcemap to all environments.
              // Astro 7 only forwards build.sourcemap to the
              // "client" environment (see
              // vite-build-config.js line 127), leaving
              // ssr/server/prerender with sourcemap=false.
              // This causes the Sentry Vite plugin to warn about
              // "no sourcemap found" for every SSR/prerender JS chunk.
              // Fix: inherit the top-level setting unless an environment
              // explicitly overrides it.
              if (env.build && config.build?.sourcemap != null) {
                env.build.sourcemap ??= config.build.sourcemap
              }

              // Propagate rollupOptions.onwarn to each environment build.
              // Astro spawns separate Vite builds per environment (client, ssr,
              // prerender). Vite's top-level build.rollupOptions.onwarn only
              // applies to the client environment. Without propagation, sourcemap
              // warnings from Astro's internal plugins (astro:build,
              // astro:transitions) leak through in the other environments.
              const topLevelOnwarn = config.build?.rollupOptions?.onwarn
              if (typeof topLevelOnwarn === 'function') {
                env.build ??= {}
                env.build.rollupOptions ??= {}
                if (typeof env.build.rollupOptions.onwarn !== 'function') {
                  env.build.rollupOptions.onwarn = topLevelOnwarn
                }
              }

              if (env.build?.rolldownOptions) {
                // Ensure rollupOptions exists
                env.build.rollupOptions = env.build.rollupOptions ?? {}

                // Copy rolldown input into rollupOptions for SSR/server builds.
                // Do not override entryFileNames — Astro names the adapter bundle
                // serverEntry (entry.mjs) and keeps middleware in a separate chunk.
                if (name === 'ssr' || name === 'server') {
                  // Ensure rollupOptions exists
                  env.build.rollupOptions = env.build.rollupOptions ?? {}

                  // Copy properties
                  if (env.build.rolldownOptions.input) {
                    // Copy as an object to match what Astro/Vercel expects.
                    // Preserve adapter input keys (e.g. `index`) — renaming to `entry`
                    // breaks Astro's isRolldownInput() matching and misnames the
                    // server bundle (entry.js / entry2.mjs collisions).
                    if (typeof env.build.rolldownOptions.input === 'string') {
                      env.build.rollupOptions.input = {
                        entry: env.build.rolldownOptions.input,
                      }
                    } else if (Array.isArray(env.build.rolldownOptions.input)) {
                      env.build.rollupOptions.input = Object.fromEntries(
                        env.build.rolldownOptions.input.map((v, i) => [
                          i === 0 ? 'entry' : `entry_${i}`,
                          v,
                        ]),
                      )
                    } else if (
                      typeof env.build.rolldownOptions.input === 'object' &&
                      env.build.rolldownOptions.input !== null
                    ) {
                      env.build.rollupOptions.input = {
                        ...env.build.rolldownOptions.input,
                      }
                    } else {
                      env.build.rollupOptions.input =
                        env.build.rolldownOptions.input
                    }
                  }
                } else if (name === 'prerender') {
                  // For prerender env, do a normal spread without forcing entry.mjs
                  env.build.rollupOptions = {
                    ...env.build.rollupOptions,
                    ...env.build.rolldownOptions,
                  }
                }
              }

              // Astro-managed environment names — their inputs are set by Astro
              // during the build and must not be overridden with a dummy entry.
              // Injecting a dummy input here causes the SSR manifest to contain a
              // script entry with an undefined file path, which crashes
              // splitAssetPath() at runtime (PIXEL-FAST-14).
              if (ASTRO_MANAGED_ENVS.has(name)) continue

              const input = env.build?.rollupOptions?.input
              const inputIsEmpty =
                !input ||
                (Array.isArray(input) && input.length === 0) ||
                (typeof input === 'object' &&
                  !Array.isArray(input) &&
                  Object.keys(input).length === 0)

              if (inputIsEmpty && env.build) {
                env.build.rollupOptions = env.build.rollupOptions ?? {}
                env.build.rollupOptions.input = 'virtual:dummy-ssr-entry'
              }
            }
          }
        },
      },
      {
        name: 'trace-mongodb',
        enforce: 'pre',
        resolveId(source, importer) {
          if (
            this.environment?.name === 'client' &&
            (source.includes('mongodb') || source.includes('zstd'))
          ) {
            console.error(
              `\n\n[CLIENT TRACE] ${importer} IMPORTS ${source}\n\n`,
            )
          }
        },
      },
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
        '~': path.resolve('./apps/web/src'),
        '@': path.resolve('./apps/web/src'),
        '@components': path.resolve('./apps/web/src/components'),
        '@layouts': path.resolve('./apps/web/src/layouts'),
        '@utils': path.resolve('./apps/web/src/utils'),
        '@lib': path.resolve('./apps/web/src/lib'),
        'framer-motion': path.resolve('./apps/web/src/lib/shims/framer-motion.tsx'),
        '@radix-ui/react-tooltip': path.resolve(
          './apps/web/src/lib/shims/radix-tooltip.tsx',
        ),
        'astro-icon/components': path.resolve(
          './apps/web/src/components/ui/astro-icon-components.ts',
        ),
        'stream': 'stream-browserify',
        'zlib': 'browserify-zlib',
        'buffer': 'buffer',
        'util': 'util',
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
        'path-browserify',
        'events',
      ],
      external: [
        // ── Node built-ins ─────────────────────────────────────────────────
        // Marking these as SSR externals prevents Vite's dep scanner from
        // treating them as browser modules and emitting "externalized for
        // browser compatibility" warnings on server-side source files.
        'node:async_hooks',
        'node:buffer',
        'node:child_process',
        'node:crypto',
        'node:dns',
        'node:events',
        'node:fs',
        'node:fs/promises',
        'node:http',
        'node:https',
        'node:net',
        'node:os',
        'node:path',
        'node:process',
        'node:stream',
        'node:stream/promises',
        'node:tls',
        'node:url',
        'node:util',
        'node:worker_threads',
        'node:zlib',
        // bare specifiers (legacy imports without node: prefix)
        'async_hooks',
        'buffer',
        'child_process',
        'crypto',
        'dns',
        'events',
        'fs',
        'fs/promises',
        'http',
        'https',
        'net',
        'os',
        'path',
        'process',
        'stream',
        'tls',
        'url',
        'util',
        'worker_threads',
        'zlib',
        // ── Third-party server-only packages ───────────────────────────────
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
        'mongodb',
        'recharts',
        'chart.js',
        '@opentelemetry/api',
        '@opentelemetry/otlp-exporter-base',
        '@opentelemetry/exporter-trace-otlp-http',
        '@opentelemetry/exporter-metrics-otlp-http',
        '@opentelemetry/otlp-transformer',
      ],
    },
    optimizeDeps: {
      // Only scan client-facing entrypoints — exclude server-only trees entirely.
      // This prevents "externalized for browser compatibility" noise from files
      // that legitimately import Node built-ins (crypto, fs, path, …).
      entries: [
        'apps/web/src/pages/**/*.{ts,tsx,js,jsx,astro}',
        'apps/web/src/layouts/**/*.{ts,tsx,js,jsx,astro}',
        'apps/web/src/components/**/*.{ts,tsx,js,jsx,astro}',
        'apps/web/src/middleware.ts',
      ],
      // Explicitly pre-bundle zod so Vite always produces a stable dep chunk.
      // Without this, zod (pulled in transitively via @pixelated/memory-schema)
      // can produce a stale/missing chunk (e.g. settings-XXXXXXXX.js) after a
      // lockfile update, causing "Failed to fetch dynamically imported module"
      // errors on pages that load TherapyGate → memory-schema → zod.
      include: ['zod'],
      exclude: [
        // ── Server-only source directories ─────────────────────────────────
        'apps/web/src/lib/security',
        'apps/web/src/lib/crypto',
        'apps/web/src/lib/server',
        'apps/web/src/lib/server-only',
        'apps/web/src/lib/auth',
        'apps/web/src/lib/websocket',
        'apps/web/src/lib/agent-note-collab',
        'apps/web/src/lib/logging',
        'apps/web/src/lib/middleware',
        'apps/web/src/lib/monitoring',
        'apps/web/src/lib/backup',
        'apps/web/src/lib/fhe',
        'apps/web/src/lib/security/threat-detection',
        'apps/web/src/lib/security/threat-intelligence',
        'apps/web/src/lib/visual-regression',
        'apps/web/src/scripts',
        'apps/web/src/server.prod.ts',
        // ── Node built-ins (never pre-bundle) ──────────────────────────────
        'node:async_hooks',
        'node:buffer',
        'node:child_process',
        'node:crypto',
        'node:dns',
        'node:events',
        'node:fs',
        'node:fs/promises',
        'node:http',
        'node:https',
        'node:net',
        'node:os',
        'node:path',
        'node:process',
        'node:stream',
        'node:tls',
        'node:url',
        'node:util',
        'node:worker_threads',
        'node:zlib',
        'crypto',
        'fs',
        'fs/promises',
        'path',
        'util',
        'stream',
        'os',
        'child_process',
        'worker_threads',
        'http',
        'https',
        'net',
        'tls',
        // ── Third-party server-only packages ───────────────────────────────
        '@aws-sdk/client-s3',
        '@aws-sdk/client-kms',
        '@google-cloud/storage',
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
        'mongodb',
        'chart.js',
        '@spotlightjs/astro',
        'zustand',
        'jotai',
        '@tanstack/react-query',
      ],
    },
    customLogger: (() => {
      const logger = createLogger()
      const originalWarn = logger.warn.bind(logger)
      logger.warn = (msg, opts) => {
        // Drop the "externalized for browser compatibility" dep-scan noise.
        // These are all intentional server-side imports; the warning is
        // meaningless for an SSR-only project using @astrojs/node.
        if (msg.includes('has been externalized for browser compatibility'))
          return
        originalWarn(msg, opts)
      }
      return logger
    })(),
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
      // Inject build version into service worker for per-deploy cache busting
      {
        name: 'sw-version-injector',
        hooks: {
          'astro:build:done': async ({ dir }) => {
            const swPath = path.join(dir.pathname, 'sw.js')
            try {
              const swContent = await readFile(swPath, 'utf-8')
              const buildHash = process.env.SENTRY_RELEASE ?? `v-${Date.now()}`
              const versioned = swContent.replace(
                /__SW_VERSION__/g,
                `v-${buildHash}`,
              )
              await writeFile(swPath, versioned, 'utf-8')
              console.log(
                `[sw-version-injector] Injected version ${buildHash} into sw.js`,
              )
            } catch (err) {
              console.warn(
                '[sw-version-injector] Could not inject SW version:',
                err,
              )
            }
          },
        },
      },
      ...(hasSentryDSN
        ? [
            sentry({
              telemetry: false,
              org: process.env.SENTRY_ORG ?? 'pixelated-empathy-dq',
              project: process.env.SENTRY_PROJECT ?? 'pixel-astro',
              authToken: process.env.SENTRY_AUTH_TOKEN,
              // Tag uploaded files with the current release so server
              // events that carry a matching SENTRY_RELEASE can be
              // symbolicated against the uploaded maps.
              release: sentryRelease
                ? { name: sentryRelease }
                : undefined,
              // Upload client + server sourcemaps. Without this, every
              // captured event arrives in Sentry as the bundled filename
              // and is unsymbolicated (no useful stack traces).
              sourcemaps: {
                assets: [
                  './dist/client/_astro/**/*.js',
                  './dist/client/_astro/**/*.js.map',
                  './dist/server/**/*.mjs',
                  './dist/server/**/*.mjs.map',
                ],
                filesToDeleteAfterUpload: [
                  './dist/client/_astro/**/*.map',
                  './dist/server/**/*.map',
                ],
              },
            }),
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
    inlineScriptNonce: false,
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
        path.resolve('./apps/web/src'),
        path.resolve('./apps/web/public'),
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
    headers: {
      'Cache-Control': 'public, max-age=31536000, immutable',
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
    // Auth de-duplication: one login and one register surface.
    '/signin': { status: 301, destination: '/login' },
    '/signup': { status: 301, destination: '/register' },
    // Chat consolidation: retired demo-grade and dead-mock chat pages.
    '/ai-chat': { status: 301, destination: '/chat' },
    '/mental-health-chat': { status: 301, destination: '/chat' },
  },
  devToolbar: {
    enabled: isDevelopment,
  },
})
