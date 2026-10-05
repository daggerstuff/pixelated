import { defineConfig } from 'vitest/config'

// Standalone package config: the root vitest.config.ts routes its `projects`
// by path globs that do not include packages/autoreview, so this package owns
// its own node-environment test run (mirrors how packages/memory-schema tests
// run via `vitest run` rather than the root config).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
