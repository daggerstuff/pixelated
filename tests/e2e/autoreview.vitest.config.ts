import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

// Standalone config so the AutoReview smoke test can be run explicitly without
// the root jsdom/projects config (which excludes tests/e2e/**).
//   pnpm exec vitest run --config tests/e2e/autoreview.vitest.config.ts
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  test: {
    environment: 'node',
    include: ['autoreview_smoke.test.ts'],
    testTimeout: 300_000,
  },
})
