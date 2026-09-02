import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '@/lib': path.resolve(__dirname, '../../apps/web/src/lib'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['agent/tools/**/*.ts', 'agent/hooks/**/*.ts'],
      exclude: ['node_modules/**', '**/*.test.ts'],
    },
  },
})
