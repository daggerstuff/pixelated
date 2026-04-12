import path from 'node:path'

import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'

const baseNodeTestGlobs = [
  'src/tests/health-monitor.test.ts',
  'src/lib/logging/__tests__/audit-logger.test.ts',
  'src/pages/api/**/*.test.ts',
  'src/pages/api/**/*.spec.ts',
  'src/pages/api/**/__tests__/**/*.test.ts',
  'src/lib/auth/**/*.test.ts',
  'tests/unit/auth0/**/*.test.ts',
  'tests/integration/auth0/**/*.test.ts',
  'src/lib/redis.test.ts',
] as const

const ciNodeTestGlobs = process.env['CI']
  ? [
      'tests/integration/auth0/**/*.test.ts',
      'src/lib/ai/bias-detection/__tests__/BiasDetectionEngine.load.test.ts',
      'tests/integration/patient-psi-crisis.test.ts',
      'src/lib/ai/services/PatientResponseService.test.ts',
      'src/lib/services/redis/__tests__/RedisService.integration.test.ts',
      'src/lib/services/redis/__tests__/Analytics.integration.test.ts',
      'src/lib/services/redis/__tests__/CacheInvalidation.integration.test.ts',
      'tests/integration/bias-detection-api.integration.test.ts',
    ]
  : []

const nodeTestGlobs = [...baseNodeTestGlobs, ...ciNodeTestGlobs]

export default defineConfig({
  plugins: [react(), tsconfigPaths({ root: path.resolve(__dirname, '..') })],
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
      { find: '@', replacement: path.resolve(__dirname, '../src') },
      {
        find: 'react-dom/test-utils',
        replacement: path.resolve(
          __dirname,
          '../__mocks__/react-dom/test-utils.js',
        ),
      },
      {
        find: /@testing-library\/react\/dist\/act-compat\.js$/,
        replacement: path.resolve(
          __dirname,
          '../src/test/testing-library-act-compat.ts',
        ),
      },
      {
        find: /react-dom\/cjs\/react-dom-test-utils\.production\.js$/,
        replacement: path.resolve(
          __dirname,
          '../src/test/testing-library-act-compat.ts',
        ),
      },
      {
        find: 'react/jsx-dev-runtime',
        replacement: path.resolve(
          __dirname,
          '../node_modules/react/jsx-dev-runtime.js',
        ),
      },
      {
        find: 'react/jsx-runtime',
        replacement: path.resolve(
          __dirname,
          '../node_modules/react/jsx-runtime.js',
        ),
      },
      {
        find: 'react',
        replacement: path.resolve(__dirname, '../src/test/react-compat.ts'),
      },
      {
        find: 'react-dom',
        replacement: path.resolve(
          __dirname,
          '../node_modules/react-dom/index.js',
        ),
      },
    ],
    conditions: ['node', 'import', 'module', 'default'],
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: [
      './src/test/setup.ts',
      './src/test/setup-react19.ts',
      './vitest.setup.ts',
    ],
    css: {
      modules: {
        classNameStrategy: 'non-scoped',
      },
    },
    include: [
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
        test: {
          include: nodeTestGlobs,
          environment: 'node',
        },
      },
    ],
    testTimeout: process.env['CI'] ? 15_000 : 30_000,
    hookTimeout: process.env['CI'] ? 10_000 : 30_000,
    ...(process.env['CI'] ? { maxWorkers: 2 } : {}),
    environmentOptions: {
      jsdom: {
        resources: 'usable',
        pretendToBeVisual: false,
        runScripts: 'dangerously',
      },
    },
    coverage: {
      provider: 'v8',
      enabled:
        !process.env['CI'] || process.env['VITEST_COVERAGE_ENABLED'] === 'true',
      reporter: ['text', 'json', 'html', 'cobertura'],
      reportsDirectory: './coverage',
      thresholds: {
        // PIX-79: Baseline thresholds matching current coverage (Jan 2026)
        // Target: Increase gradually as coverage improves
        lines: 20,
        functions: 15,
        branches: 25,
        statements: 20,
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
