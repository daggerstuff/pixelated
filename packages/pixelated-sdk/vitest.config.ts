import { defineConfig } from "vitest/config";

/**
 * Package-local vitest config for @pixelated-empathy/sdk.
 *
 * Minimal config for testing SDK operations — no DOM, no React, no Astro.
 * The root config/vitest.config.ts covers app-wide runs; this config exists
 * so the package can be tested in isolation (e.g. `pnpm test` from inside
 * `packages/pixelated-sdk`).
 */
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    pool: "forks",
    isolate: true,
  },
});
