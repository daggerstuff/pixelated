import path from 'node:path'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react(), tsconfigPaths({ root: path.resolve(__dirname, '.') })],
  resolve: {
    alias: [
      { find: '@', replacement: path.resolve(__dirname, 'src') },
    ],
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/lib/ai/mental-llama/adapter/MentalLLaMAAdapter.test.ts'],
    setupFiles: [],
    coverage: {
      enabled: false,
    },
  },
})
