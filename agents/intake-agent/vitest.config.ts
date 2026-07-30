import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["agent/tools/**/*.ts"],
      exclude: ["node_modules/**", "**/*.test.ts"],
    },
  },
});
