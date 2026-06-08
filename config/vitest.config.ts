import path from 'node:path'

import react from '@vitejs/plugin-react'
import { getViteConfig } from 'astro/config'
/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'

const projectRoot = process.cwd()
const baseNodeTestGlobs = [
  'src/tests/health-monitor.test.ts',
  'src/lib/logging/__tests__/audit-logger.test.ts',
  'src/pages/api/**/*.test.ts',
  'src/pages/api/**/*.spec.ts',
  'src/pages/api/**/__tests__/**/*.test.ts',
  'src/api/routes/__tests__/**/*.test.ts',
  'src/api/middleware/__tests__/**/*.test.ts',
  'src/lib/auth/**/*.test.ts',
  'src/lib/services/product-memory-gateway.test.ts',
  'src/lib/services/redis/__tests__/CacheInvalidation.integration.test.ts',
  'tests/unit/auth0/**/*.test.ts',
  'tests/integration/auth0/**/*.test.ts',
  'src/lib/redis.test.ts',
  'src/lib/services/notification/__tests__/NotificationService.test.ts',
  'src/lib/__tests__/security-implementation.test.ts',
] as const

const ciNodeTestGlobs = process.env['CI']
  ? [
      'tests/integration/auth0/**/*.test.ts',
      'tests/integration/patient-psi-crisis.test.ts',
      'src/lib/ai/services/PatientResponseService.test.ts',
      'src/lib/services/redis/__tests__/RedisService.integration.test.ts',
      'src/lib/services/redis/__tests__/Analytics.integration.test.ts',
      'src/lib/services/redis/__tests__/CacheInvalidation.integration.test.ts',
      'tests/integration/bias-detection-api.integration.test.ts',
    ]
  : []

// CPU-bound load/performance tests excluded from default runs
// Run them explicitly with: VITEST_TARGET_TESTS="<path>" pnpm vitest run -c config/vitest.config.ts
const cpuBoundNodeTestExcludes = [
  'src/lib/ai/bias-detection/__tests__/BiasDetectionEngine.load.test.ts',
  'src/lib/ai/bias-detection/__tests__/BiasDetectionEngine.performance.test.ts',
]

const nodeTestGlobs: string[] = [...baseNodeTestGlobs, ...ciNodeTestGlobs]
const coverageEnabled =
  process.env['VITEST_COVERAGE_ENABLED'] === 'true'
    ? true
    : process.env['VITEST_COVERAGE_ENABLED'] === 'false'
      ? false
      : !process.env['CI']

const targetedTestGlobs = process.env['VITEST_TARGET_TESTS']
  ? process.env['VITEST_TARGET_TESTS']
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
  : []
const targetedNodeTestGlobs = targetedTestGlobs.filter(
  (entry) =>
    (entry.includes('/api/') || entry.includes('/lib/')) &&
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
    include: ['msw/node'],
  },
  ssr: {
    noExternal: ['msw'],
  },
  resolve: {
    alias: [
      { find: '@/', replacement: `${path.resolve(process.cwd(), 'src')}/` },
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
          'src/test/testing-library-act-compat.ts',
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
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: {
      modules: {
        classNameStrategy: 'non-scoped',
      },
    },
    include:
      targetedTestGlobs.length > 0
        ? targetedTestGlobs
        : [
            'src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
            'tests/integration/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
          ],
    exclude: [
      '**/node_modules/**',
      'src/tests/simple-browser-compatibility.test.ts',
      'src/tests/browser-compatibility.test.ts',
      'src/tests/mobile-compatibility.test.ts',
      'src/tests/cross-browser-compatibility.test.ts',
      'src/e2e/breach-notification.spec.ts',
      'src/tests/performance.test.ts',
      'src/tests/responsive-navigation.test.js',
      'tests/integration/complete-system.integration.test.ts',
      'tests/e2e/**/*',
      'tests/browser/**/*',
      'tests/accessibility/**/*',
      'tests/performance/**/*',
      'tests/security/**/*',
      'backups/**',
      'backups/**/*',
      'worktrees/**',
      ...nodeTestGlobs,
    ],
    projects: [
      {
        plugins: [react(), ...astroPlugins],
        resolve: {
          alias: [
            {
              find: '@/',
              replacement: `${path.resolve(process.cwd(), 'src')}/`,
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
                'src/test/testing-library-act-compat.ts',
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
          setupFiles: ['./src/test/setup.ts'],
          name: 'jsdom',
          include:
            targetedTestGlobs.length > 0
              ? targetedJsdomTestGlobs
              : [
                  'src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
                  'tests/integration/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
                ],
          environment: 'jsdom',
          isolate: true,
          exclude: [
            '**/node_modules/**',
            'src/lib/security/__tests__/**/*.test.ts',
            'src/lib/ehr/__tests__/**/*.test.ts',
            'src/lib/ai/bias-detection/__tests__/**/*.test.ts',
            'src/lib/redis.test.ts',
            'src/lib/services/notification/__tests__/NotificationService.test.ts',
            'src/lib/__tests__/security-implementation.test.ts',
            'tests/integration/complete-system.integration.test.ts',
            'src/tests/simple-browser-compatibility.test.ts',
            'src/tests/browser-compatibility.test.ts',
            'src/tests/mobile-compatibility.test.ts',
            'src/tests/cross-browser-compatibility.test.ts',
            'src/e2e/breach-notification.spec.ts',
            'src/tests/performance.test.ts',
            'src/tests/responsive-navigation.test.js',
            'tests/e2e/**/*',
            'tests/browser/**/*',
            'tests/accessibility/**/*',
            'tests/performance/**/*',
            'tests/security/**/*',
            'src/api/routes/__tests__/**/*.test.ts',
            'src/api/middleware/__tests__/**/*.test.ts',
            'backups/**',
            'backups/**/*',
            'worktrees/**',
          ],
        },
      },
      {
        resolve: {
          alias: [
            {
              find: '@/',
              replacement: `${path.resolve(process.cwd(), 'src')}/`,
            },
          ],
        },
        test: {
          globals: true,
          setupFiles: ['./src/test/setup-node.ts'],
          name: 'node',
          include:
            targetedTestGlobs.length > 0
              ? targetedNodeTestGlobs
              : [
                  ...nodeTestGlobs,
                  'src/lib/security/__tests__/**/*.test.ts',
                  'src/lib/ehr/__tests__/allscripts.test.ts',
                  'src/lib/ai/bias-detection/__tests__/**/*.test.ts',
                  'src/tests/auth.test.ts',
                ],
          exclude: [...cpuBoundNodeTestExcludes],
          environment: 'node',
          isolate: true,
        },
      },
    ],
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: false,
        maxForks: process.env['CI'] ? 2 : 8,
        minForks: process.env['CI'] ? 1 : 2,
      },
    },
    testTimeout: process.env['CI'] ? 15_000 : 30_000,
    hookTimeout: process.env['CI'] ? 10_000 : 30_000,
    environmentOptions: {
      jsdom: {
        resources: 'usable',
        pretendToBeVisual: false,
        runScripts: 'dangerously',
      },
    },
    coverage: {
      provider: 'v8',
      enabled: coverageEnabled,
      reporter: ['text', 'json', 'html', 'cobertura'],
      reportsDirectory: './coverage',
      thresholds: {
        // PIX-223+: Thresholds raised after boosting BiasDetectionEngine (57%→88%),
        // performance-optimizer (81%→91%), connection-pool (27%→97%), python-bridge 85%,
        // alerts-system ~84%, metrics-collector ~80%. Overall project ~58% stmts.
        lines: 45,
        functions: 40,
        branches: 32,
        statements: 45,
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
    maxConcurrency: process.env['CI'] ? 2 : 8,
    isolate: !process.env['CI'],
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
