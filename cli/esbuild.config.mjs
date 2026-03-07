import { build } from "esbuild";

await build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  outfile: "dist/index.js",
  // Keep interactive/spinner libs external (complex runtime behaviors)
  // Node built-ins must stay external when bundling CJS deps (commander) into ESM
  external: ["@clack/prompts", "ora", "commander", "semver", "chalk"],
  // Inline pure JS deps: commander, chalk, semver
  minify: false,
  sourcemap: false,
});
