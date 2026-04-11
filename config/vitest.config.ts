import path from 'node:path'

import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'

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
        replacement: path.resolve(__dirname, '../node_modules/react/index.js'),
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
    environmentMatchGlobs: [
      // Tests that depend on Node.js built-in modules must run in node environment
      ['src/tests/health-monitor.test.ts', 'node'],
      ['src/lib/logging/__tests__/audit-logger.test.ts', 'node'],
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
      'src/tests/simple-browser-compatibility.test.ts',
      'src/tests/browser-compatibility.test.ts',
      'src/tests/mobile-compatibility.test.ts',
      'src/tests/cross-browser-compatibility.test.ts',
      'src/e2e/breach-notification.spec.ts',
      'tests/e2e/**/*',
      'tests/browser/**/*',
      'tests/accessibility/**/*',
      'tests/performance/**/*',
      'tests/security/**/*',
      'backups/**',
      'backups/**/*',
      'worktrees/**',
      ...(process.env['CI']
        ? [
            'src/lib/services/redis/__tests__/RedisService.integration.test.ts',
            'src/lib/services/redis/__tests__/Analytics.integration.test.ts',
            'src/lib/services/redis/__tests__/CacheInvalidation.integration.test.ts',
            'tests/integration/bias-detection-api.integration.test.ts',
          ]
        : []),
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
