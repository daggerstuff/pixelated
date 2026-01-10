/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
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
    alias: {
      '@': path.resolve(__dirname, '../src'),
      'react-dom/test-utils': path.resolve(
        __dirname,
        '../__mocks__/react-dom/test-utils.js',
      ),
      'react/jsx-dev-runtime': path.resolve(
        __dirname,
        '../node_modules/react/jsx-dev-runtime.js',
      ),
      'react/jsx-runtime': path.resolve(
        __dirname,
        '../node_modules/react/jsx-runtime.js',
      ),
      'react': path.resolve(__dirname, '../node_modules/react/index.js'),
      'react-dom': path.resolve(__dirname, '../node_modules/react-dom/index.js'),
    },
    conditions: ['node', 'import', 'module', 'default'],
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts', './config/vitest.setup.ts'],
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
    ...(process.env['CI']
      ? {
        poolOptions: {
          threads: {
            minThreads: 1,
            maxThreads: 2,
          },
        },
      }
      : {}),
    environmentOptions: {
      jsdom: {
        resources: 'usable',
        pretendToBeVisual: false,
        runScripts: 'dangerously',
      },
    },
    reporters: ['default', 'junit'],
    outputFile: {
      junit: './coverage/junit.xml',
    },
    coverage: {
      provider: 'v8',
      enabled:
        !process.env['CI'] || process.env['VITEST_COVERAGE_ENABLED'] === 'true',
      reporter: ['text', 'json', 'html', 'cobertura', 'lcov'],
      reportsDirectory: './coverage',
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
