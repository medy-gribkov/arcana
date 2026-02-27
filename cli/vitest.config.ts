import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "lcov"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        "src/types.ts",
        "src/interactive.ts",
        "src/index.ts",
        "src/commands/update.ts",
        "src/commands/create.ts",
        "node_modules",
        "dist",
      ],
      thresholds: {
        statements: 50,
        branches: 40,
        functions: 45,
        lines: 50,
      },
    },
    testTimeout: 15000,
  },
});
