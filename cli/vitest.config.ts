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
        "src/index.ts",
        "src/interactive/**",
        "src/cli.ts",
        "src/compress/index.ts",
        "src/providers/base.ts",
        "src/providers/arcana.ts",
        "src/constants.ts",
        "node_modules",
        "dist",
      ],
      thresholds: {
        statements: 90,
        branches: 80,
        functions: 95,
        lines: 90,
      },
    },
    testTimeout: 15000,
  },
});
