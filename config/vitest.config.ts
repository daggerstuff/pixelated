import path from 'node:path'

import react from '@vitejs/plugin-react'
import { getViteConfig } from 'astro/config'
import tsconfigPaths from 'vite-tsconfig-paths'
/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'

const projectRoot = process.cwd()
const memorySchemaAlias = {
  find: '@pixelated/memory-schema',
  replacement: path.resolve(projectRoot, 'packages/memory-schema/src/index.ts'),
}
const baseNodeTestGlobs = [
  'apps/web/src/tests/health-monitor.test.ts',
  'apps/web/src/tests/hipaa-compliance.test.ts',
  'apps/web/src/lib/logging/__tests__/audit-logger.test.ts',
  'apps/web/src/pages/api/**/*.test.ts',
  'apps/web/src/pages/api/**/*.spec.ts',
  'apps/web/src/pages/api/**/__tests__/**/*.test.ts',
  'apps/web/src/api/routes/__tests__/**/*.test.ts',
  'apps/web/src/api/middleware/__tests__/**/*.test.ts',
  'apps/web/src/api/memory/__tests__/**/*.test.ts',
  'apps/web/src/lib/auth/**/*.test.ts',
  'apps/web/src/lib/services/product-memory-gateway.test.ts',
  'apps/web/src/lib/services/redis/__tests__/CacheInvalidation.integration.test.ts',
  'tests/unit/auth0/**/*.test.ts',
  'tests/integration/auth0/**/*.test.ts',
  'apps/web/src/lib/redis.test.ts',
  'apps/web/src/lib/services/notification/__tests__/NotificationService.test.ts',
  'apps/web/src/lib/__tests__/security-implementation.test.ts',
  'apps/web/src/lib/ai/__tests__/getAIService.test.ts',
  'apps/web/src/lib/ai/__tests__/providers.test.ts',
  'apps/web/src/lib/ai/services/__tests__/FineTuningAIService.test.ts',
  'apps/web/src/lib/graphql/__tests__/graphql.test.ts',
  'apps/web/src/lib/graphql/__tests__/client.test.ts',
] as const

const ciNodeTestGlobs = process.env['CI']
  ? [
      'tests/integration/auth0/**/*.test.ts',
      'tests/integration/patient-psi-crisis.test.ts',
      'apps/web/src/lib/ai/services/PatientResponseService.test.ts',
      'apps/web/src/lib/services/redis/__tests__/RedisService.integration.test.ts',
      'apps/web/src/lib/services/redis/__tests__/Analytics.integration.test.ts',
      'apps/web/src/lib/services/redis/__tests__/CacheInvalidation.integration.test.ts',
      'tests/integration/bias-detection-api.integration.test.ts',
    ]
  : []

// CPU-bound load/performance tests excluded from default runs
// Run them explicitly with: VITEST_TARGET_TESTS="<path>" pnpm vitest run -c vitest.config.ts
const cpuBoundNodeTestExcludes = [
  'apps/web/src/lib/ai/bias-detection/__tests__/BiasDetectionEngine.load.test.ts',
  'apps/web/src/lib/ai/bias-detection/__tests__/BiasDetectionEngine.performance.test.ts',
]

const nodeTestGlobs: string[] = [...baseNodeTestGlobs, ...ciNodeTestGlobs]
const coverageEnabled =
  process.env['VITEST_COVERAGE_ENABLED'] === 'true'
    ? true
    : process.env['VITEST_COVERAGE_ENABLED'] === 'false'
      ? false
      : !process.env['CI']

const targetedTestGlobs = process.env['VITEST_TARGET_TESTS']
  ? (process.env['VITEST_TARGET_TESTS'].includes(';') ||
    process.env['VITEST_TARGET_TESTS'].includes('{')
      ? process.env['VITEST_TARGET_TESTS'].split(';')
      : process.env['VITEST_TARGET_TESTS'].split(',')
    )
      .map((entry) => entry.trim())
      .filter(Boolean)
  : []
const targetedNodeTestGlobs = targetedTestGlobs.filter(
  (entry) =>
    (entry.includes('/api/') ||
      entry.includes('/lib/') ||
      entry.startsWith('agents/')) &&
    !entry.includes('__tests__/AIChat'),
)
const targetedJsdomTestGlobs = targetedTestGlobs.filter(
  (entry) => !targetedNodeTestGlobs.includes(entry),
)
const astroViteConfig = getViteConfig({}, {})
const astroVite = await astroViteConfig({
  mode: process.env['VITEST_MODE'] ?? 'test',
  command: 'serve',
})
const astroPlugins = astroVite.plugins ?? []

export default defineConfig({
  plugins: [react(), ...astroPlugins],
  define: {
    global: 'globalThis',
  },
  optimizeDeps: {
    exclude: ['chokidar', 'fsevents'],
    include: ['msw/node', 'graphql-request'],
  },
  ssr: {
    noExternal: ['msw'],
  },
  resolve: {
    alias: [
      memorySchemaAlias,
      {
        find: '@/',
        replacement: `${path.resolve(process.cwd(), 'apps/web/src')}/`,
      },
      {
        find: 'react-dom/test-utils',
        replacement: path.resolve(
          projectRoot,
          '__mocks__/react-dom/test-utils.js',
        ),
      },
      {
        find: /@testing-library\/react\/dist\/act-compat\.js$/,
        replacement: path.resolve(
          projectRoot,
          'apps/web/src/test/testing-library-act-compat.ts',
        ),
      },
      {
        find: /react-dom\/cjs\/react-dom-test-utils\.production\.js$/,
        replacement: path.resolve(
          projectRoot,
          '__mocks__/react-dom/cjs/react-dom-test-utils.production.js',
        ),
      },
    ],
    conditions: ['node', 'import', 'module', 'default'],
  },
  test: {
    pool: 'forks',
    // Vitest 4 removed `poolOptions.forks.memoryLimit`. The forks pool ignores
    // memory limits entirely; for vm pools it's `vmMemoryLimit` instead. To keep
    // the PIX-223 OOM guard, cap each worker's V8 heap directly via execArgv.
    execArgv: process.env['CI'] ? ['--max-old-space-size=1024'] : undefined,
    // PIX-223/OOM: In CI the forks pool runs `maxWorkers` parallel child
    // processes, each accumulating native jsdom/Astro/MSW allocations beyond
    // V8's heap cap.  The 8 GB GitHub Actions runner cannot safely run 2 workers
    // (parent + 2 × worker + OS overhead ≈ 8 GB peak).  Set to 1 to run one
    // test file at a time, leaving ~5-6 GB for native memory per worker.
    maxWorkers: process.env['CI'] ? 1 : 8,
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./apps/web/src/test/setup.ts'],
    css: {
      modules: {
        classNameStrategy: 'non-scoped' as const,
      },
    },
    include:
      targetedTestGlobs.length > 0
        ? targetedTestGlobs
        : [
            'apps/web/src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
            'tests/integration/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
          ],
    exclude: [
      '**/node_modules/**',
      'apps/web/src/tests/simple-browser-compatibility.test.ts',
      'apps/web/src/tests/browser-compatibility.test.ts',
      'apps/web/src/tests/mobile-compatibility.test.ts',
      'apps/web/src/tests/cross-browser-compatibility.test.ts',
      'apps/web/src/e2e/breach-notification.spec.ts',
      'apps/web/src/tests/performance.test.ts',
      'apps/web/src/tests/responsive-navigation.test.js',
      'tests/integration/complete-system.integration.test.ts',
      'tests/e2e/**/*',
      'tests/browser/**/*',
      'tests/accessibility/**/*',
      'tests/performance/**/*',
      'tests/security/**/*',
      'backups/**',
      'backups/**/*',
      'worktrees/**',
      'ai/.venv/**',
      ...nodeTestGlobs,
    ],
    projects: [
      {
        plugins: [react(), ...astroPlugins],
        resolve: {
          alias: [
            memorySchemaAlias,
            {
              find: '@/',
              replacement: `${path.resolve(process.cwd(), 'apps/web/src')}/`,
            },
            {
              find: 'react-dom/test-utils',
              replacement: path.resolve(
                process.cwd(),
                '__mocks__/react-dom/test-utils.js',
              ),
            },
            {
              find: /@testing-library\/react\/dist\/act-compat\.js$/,
              replacement: path.resolve(
                process.cwd(),
                'apps/web/src/test/testing-library-act-compat.ts',
              ),
            },
            {
              find: /react-dom\/cjs\/react-dom-test-utils\.production\.js$/,
              replacement: path.resolve(
                process.cwd(),
                '__mocks__/react-dom/cjs/react-dom-test-utils.production.js',
              ),
            },
            {
              find: 'react/jsx-dev-runtime',
              replacement: path.resolve(
                process.cwd(),
                'node_modules/react/jsx-dev-runtime.js',
              ),
            },
            {
              find: 'react/jsx-runtime',
              replacement: path.resolve(
                process.cwd(),
                'node_modules/react/jsx-runtime.js',
              ),
            },
          ],
          conditions: ['node', 'import', 'module', 'default'],
        },
        test: {
          globals: true,
          setupFiles: ['./apps/web/src/test/setup.ts'],
          name: 'jsdom',
          include:
            targetedTestGlobs.length > 0
              ? targetedJsdomTestGlobs
              : [
                  'apps/web/src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
                  'tests/integration/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
                ],
          environment: 'jsdom',
          // PIX-223/OOM: keep per-file isolation in CI. With isolate:false the
          // jsdom worker fork accumulates module/jsdom state across hundreds of
          // files and exhausts the V8 heap (crash at ~4 GB). Isolation bounds
          // memory per file; execArgv(--max-old-space-size) caps each worker at
          // the top-level test config to recycle OOM-prone workers (forks pool
          // has no memoryLimit in Vitest 4).
          isolate: true,
          exclude: [
            '**/node_modules/**',
            ...nodeTestGlobs,
            'apps/web/src/lib/security/__tests__/**/*.test.ts',
            'apps/web/src/lib/ai/bias-detection/__tests__/**/*.test.ts',
            'apps/web/src/lib/security/threat-detection/**/*.test.ts',
            'apps/web/src/lib/ai/crisis/**/*.test.ts',
            'apps/web/src/lib/redis.test.ts',
            'apps/web/src/lib/services/notification/__tests__/NotificationService.test.ts',
            'apps/web/src/lib/__tests__/security-implementation.test.ts',
            'tests/integration/complete-system.integration.test.ts',
            'apps/web/src/tests/simple-browser-compatibility.test.ts',
            'apps/web/src/tests/browser-compatibility.test.ts',
            'apps/web/src/tests/mobile-compatibility.test.ts',
            'apps/web/src/tests/cross-browser-compatibility.test.ts',
            'apps/web/src/e2e/breach-notification.spec.ts',
            'apps/web/src/tests/performance.test.ts',
            'apps/web/src/tests/responsive-navigation.test.js',
            'tests/e2e/**/*',
            'tests/browser/**/*',
            'tests/accessibility/**/*',
            'tests/performance/**/*',
            'tests/security/**/*',
            'apps/web/src/api/routes/__tests__/**/*.test.ts',
            'apps/web/src/api/middleware/__tests__/**/*.test.ts',
            'apps/web/src/lib/services/redis/__tests__/*.integration.test.ts',
            'apps/web/src/tests/integration/dream-consolidation.integration.test.ts',
            'backups/**',
            'backups/**/*',
            'worktrees/**',
            'ai/.venv/**',
          ],
        },
      },
      {
        plugins: [tsconfigPaths()],
        resolve: {
          alias: [
            memorySchemaAlias,
            {
              find: '@/',
              replacement: `${path.resolve(process.cwd(), 'apps/web/src')}/`,
            },
          ],
        },
        test: {
          globals: true,
          setupFiles: ['./apps/web/src/test/setup-node.ts'],
          name: 'node',
          include:
            targetedTestGlobs.length > 0
              ? targetedNodeTestGlobs
              : [
                  ...nodeTestGlobs,
                  'apps/web/src/lib/security/__tests__/**/*.test.ts',
                  'apps/web/src/lib/ai/bias-detection/__tests__/**/*.test.ts',
                  'apps/web/src/lib/security/threat-detection/**/*.test.ts',
                  'apps/web/src/lib/ai/crisis/**/*.test.ts',
                  'apps/web/src/tests/auth.test.ts',
                  'apps/web/src/tests/integration/dream-consolidation.integration.test.ts',
                ],
          exclude: [
            '**/node_modules/**',
            '**/dist/**',
            '.idea/**',
            '.git/**',
            '.cache/**',
            'backups/**',
            'worktrees/**',
            'ai/.venv/**',
            ...cpuBoundNodeTestExcludes,
          ],
          environment: 'node',
          isolate: true,
        },
      },
    ],
    testTimeout: process.env['CI'] ? 15_000 : 30_000,
    hookTimeout: process.env['CI'] ? 10_000 : 30_000,
    environmentOptions: {
      jsdom: {
        resources: 'usable' as const,
        pretendToBeVisual: false,
        runScripts: 'dangerously',
      },
    },
    coverage: {
      provider: 'v8',
      enabled: coverageEnabled,
      reporter: ['text', 'json', 'html', 'cobertura', 'lcov'],
      reportsDirectory: './coverage',
      thresholds: {
        // PIX-223: thresholds lifted toward the security-baseline.json 70% target
        // as coverage improves. Measured full-run coverage (green): lines 60.7%,
        // statements 61.1%, functions 61.6%, branches 51.4%. Kept ~6pts
        // below actual so the gate stays green while enforcing real progress.
        lines: 55,
        functions: 55,
        branches: 45,
        statements: 55,
      },
      exclude: [
        'node_modules/**',
        'dist/**',
        '.next/**',
        'coverage/**',
        '**/*.d.ts',
        'test/**',
        'tests/**',
        'vitest.config.ts',
        'backups/**',
        'backups/**/*',
        'worktrees/**',
      ],
    },
    // PIX-223: Timeout guard — force-kill hanging tests after 2× timeout
    teardownTimeout: 60_000,
    fileParallelism: true,
    maxConcurrency: process.env['CI'] ? 1 : 8,
    isolate: true,
    ...(process.env['CI'] ? { watch: false } : {}),
    ...(process.env['CI'] ? { bail: 10 } : {}),
  },
  build: {
    sourcemap: true,
    cssCodeSplit: true,
  },
  css: {
    devSourcemap: true,
  },
})
