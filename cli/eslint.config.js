import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.ts"],
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "error",
      "no-console": "off",
      "eqeqeq": "error",
      "no-eval": "error",
      "no-implied-eval": "error",
    },
  },
  {
    ignores: ["dist/", "node_modules/", "**/*.test.ts"],
  },
);
