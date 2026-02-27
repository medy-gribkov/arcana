import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "lcov"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "node_modules", "dist"],
      thresholds: {
        statements: 55,
        branches: 40,
        functions: 50,
        lines: 55,
      },
    },
    testTimeout: 15000,
  },
});
