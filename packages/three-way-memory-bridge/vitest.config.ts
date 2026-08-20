import { defineConfig } from 'vitest/config'

/**
 * Package-local vitest config for @pixelated/three-way-memory-bridge.
 *
 * Kept intentionally minimal — this package has no DOM, no React, no Astro,
 * so a bare `node` environment is sufficient. The root `config/vitest.config.ts`
 * is the source of truth for app-wide test runs; this config exists so the
 * package can be typechecked and tested in isolation (e.g. `pnpm test` from
 * inside `packages/three-way-memory-bridge`).
 */
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    pool: 'forks',
    isolate: true,
  },
})
