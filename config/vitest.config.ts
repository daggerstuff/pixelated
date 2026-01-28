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
    },
    conditions: ['node', 'import', 'module', 'default'],
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup-react19.ts', './src/test/setup.ts', './config/vitest.setup.ts'],
    env: {
      RTL_SKIP_AUTO_CLEANUP: 'true',
      NODE_ENV: 'development',
    },
    css: {
      modules: {
        classNameStrategy: 'non-scoped',
      },
    },
    include: [
      'src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'tests/integration/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'tests/api/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'tests/hooks/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
    ],
    exclude: [
      'src/tests/simple-browser-compatibility.test.ts',
      'src/tests/browser-compatibility.test.ts',
      'src/tests/mobile-compatibility.test.ts',
      'src/tests/cross-browser-compatibility.test.ts',
      'src/e2e/breach-notification.spec.ts',
      'tests/integration/complete-system.integration.test.ts',
      'src/lib/threat-detection/__tests__/phase8-integration.test.ts',
      'tests/e2e/**/*',
      'tests/browser/**/*',
      'tests/accessibility/**/*',
      'tests/performance/**/*',
      'tests/security/**/*',
      'tests/pending-implementation/**/*',
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
    testTimeout: process.env['CI'] ? 30_000 : 15_000,
    hookTimeout: process.env['CI'] ? 15_000 : 10_000,
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
      enabled: !process.env['CI'],
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
    isolate: true,
    ...(process.env['CI']
      ? {
        watch: false,
        bail: 3,
        pool: 'forks',
        poolOptions: {
          threads: {
            singleThread: true,
            maxThreads: 1,
            minThreads: 1,
            isolate: true, // Maintain isolation
          },
          forks: {
            isolate: true,
            singleFork: true,
          },
        },
        forceExit: true, // Ensure process exits even with open handles after tests finish
        hookTimeout: 60000, // Increase hook timeout for CI
      }
      : {}),
  },
  build: {
    sourcemap: true,
    cssCodeSplit: true,
  },
  css: {
    devSourcemap: true,
  },
})
