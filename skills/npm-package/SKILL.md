---
name: npm-package
description: npm and pnpm package authoring expertise. Covers tsup and unbuild bundling, dual ESM/CJS exports, package.json fields (main, module, exports, types, bin, files), semver discipline, changesets for versioning, monorepo setup with pnpm workspaces and turborepo, npm publish workflow, scoped packages, peer dependencies, tree-shaking optimization, package provenance, and .npmrc configuration. Use when creating npm packages, configuring exports, setting up monorepos, or publishing to npm.
---

You are a senior JavaScript package author who ships library code that works everywhere with zero configuration headaches for consumers.

## Use this skill when

- Creating a new npm package from scratch
- Configuring package.json exports for dual ESM/CJS
- Setting up tsup or unbuild for library bundling
- Managing a monorepo with pnpm workspaces
- Publishing packages to npm (public or private)
- Debugging "Cannot find module" or "ERR_REQUIRE_ESM" in consumers
- Setting up changesets for automated versioning

## Package.json: The Complete Field Reference

```jsonc
{
  "name": "@scope/my-lib",
  "version": "1.0.0",
  "description": "One line, searchable on npm",
  "license": "MIT",
  "author": "Name <email>",
  "repository": { "type": "git", "url": "https://github.com/user/repo" },
  "type": "module",                    // ESM by default. Omit for CJS-first.
  "main": "./dist/index.cjs",         // CJS entry (Node <12, bundlers fallback)
  "module": "./dist/index.js",        // ESM entry (bundlers: webpack, rollup)
  "types": "./dist/index.d.ts",       // TypeScript declarations
  "exports": {                         // Modern entry point resolution (Node 12+)
    ".": {
      "import": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
      "require": { "types": "./dist/index.d.cts", "default": "./dist/index.cjs" }
    },
    "./utils": {
      "import": { "types": "./dist/utils.d.ts", "default": "./dist/utils.js" },
      "require": { "types": "./dist/utils.d.cts", "default": "./dist/utils.cjs" }
    }
  },
  "files": ["dist", "README.md"],     // Whitelist what gets published. Nothing else ships.
  "bin": { "my-cli": "./dist/cli.js" },
  "sideEffects": false,               // Enables tree-shaking in bundlers
  "engines": { "node": ">=18" },
  "keywords": ["relevant", "search", "terms"],
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "prepublishOnly": "pnpm build",
    "release": "changeset publish"
  }
}
```

Critical ordering in `exports`: `types` MUST come first in each condition block. Node resolves top-down and TypeScript needs to find declarations before the runtime file.

## Bundling with tsup

tsup is the gold standard for library bundling. Zero-config, built on esbuild.

```typescript
// tsup.config.ts
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/utils.ts"],
  format: ["esm", "cjs"],
  dts: true,               // Generate .d.ts files
  splitting: true,          // Code-split shared chunks (ESM only)
  clean: true,              // rm dist/ before build
  treeshake: true,          // Dead code elimination
  sourcemap: true,
  minify: false,            // Don't minify libraries. Let consumers decide.
  target: "node18",
  outDir: "dist",
  external: ["react", "react-dom"],  // Never bundle peer deps
});
```

### unbuild Alternative
Use unbuild when you want passive (stub) builds during development:

```typescript
// build.config.ts
import { defineBuildConfig } from "unbuild";

export default defineBuildConfig({
  entries: ["src/index"],
  declaration: true,
  clean: true,
  rollup: {
    emitCJS: true,
    inlineDependencies: false,
  },
});
```

Run `unbuild --stub` for development -- it creates a proxy that imports directly from source. No rebuild loop needed.

## Dual ESM/CJS: Getting It Right

The most common source of package bugs. Follow these rules exactly:

1. Set `"type": "module"` in package.json. Your source is ESM.
2. tsup outputs `.js` (ESM) and `.cjs` (CJS) when format is `["esm", "cjs"]`.
3. Map exports explicitly. Never rely on auto-resolution.
4. Test both paths:

```bash
# Test ESM
node --input-type=module -e "import { foo } from './dist/index.js'; console.log(foo)"
# Test CJS
node -e "const { foo } = require('./dist/index.cjs'); console.log(foo)"
```

### Common Pitfalls
- **Missing `.cjs` extension**: If `type: "module"`, CJS files MUST use `.cjs`. Node will try to parse `.js` as ESM.
- **Default export interop**: CJS `module.exports = x` becomes `import x from "pkg"` in ESM, but `import { default as x }` in some bundlers. Prefer named exports for libraries.
- **Conditional exports mismatch**: If `exports` field exists, `main` and `module` are IGNORED by Node. They only serve as fallbacks for old bundlers.

## Semver Discipline

- **MAJOR** (1.0.0 -> 2.0.0): Any breaking change. Removed exports, changed function signatures, dropped Node version support.
- **MINOR** (1.0.0 -> 1.1.0): New features, new exports. Everything existing still works.
- **PATCH** (1.0.0 -> 1.0.1): Bug fixes only. No new API surface.

Pre-1.0 (`0.x.y`): minor = breaking, patch = features. Get to 1.0 as fast as possible.

What counts as breaking:
- Removing or renaming an exported function/type
- Changing parameter order or types
- Narrowing accepted input or widening output types
- Dropping a Node.js version from `engines`
- Changing default behavior

## Changesets for Versioning

```bash
pnpm add -D @changesets/cli
pnpm changeset init
```

Workflow:
1. Developer runs `pnpm changeset` and selects packages + bump type + writes summary.
2. This creates `.changeset/<random>.md` -- committed with the PR.
3. On merge to main, CI runs `changeset version` (consumes changesets, bumps versions, updates CHANGELOG).
4. Then `changeset publish` pushes to npm.

```yaml
# .github/workflows/release.yml
- uses: changesets/action@v1
  with:
    publish: pnpm changeset publish
    version: pnpm changeset version
    commit: "chore: release"
    title: "chore: release"
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

## Monorepo with pnpm Workspaces

```yaml
# pnpm-workspace.yaml
packages:
  - "packages/*"
  - "apps/*"
```

```jsonc
// packages/core/package.json
{
  "name": "@scope/core",
  "version": "1.0.0",
  "dependencies": {}
}

// packages/utils/package.json
{
  "name": "@scope/utils",
  "version": "1.0.0",
  "dependencies": {
    "@scope/core": "workspace:*"    // Resolved to local package
  }
}
```

`workspace:*` becomes the actual version on publish. pnpm handles the rewriting.

### Turborepo for Task Orchestration
```jsonc
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],       // Build deps first
      "outputs": ["dist/**"]
    },
    "test": {
      "dependsOn": ["build"],
      "cache": false                  // Don't cache test results
    },
    "lint": {}                        // No deps, runs in parallel
  }
}
```

Run `turbo build` -- it builds in dependency order, caches outputs, skips unchanged packages.

## Peer Dependencies

Use peer deps when your package wraps or extends another library:

```jsonc
{
  "peerDependencies": {
    "react": "^18.0.0 || ^19.0.0"
  },
  "peerDependenciesMeta": {
    "react": { "optional": false }
  },
  "devDependencies": {
    "react": "^19.0.0"              // Install for development/testing
  }
}
```

Rules:
- NEVER bundle peer deps. Add them to `external` in your bundler config.
- Keep peer dep ranges as wide as possible. `^18.0.0 || ^19.0.0` not `^19.1.3`.
- Always install peers as devDependencies for your own tests.

## Tree-Shaking Optimization

For consumers to tree-shake your library:
1. Ship ESM (`import`/`export`, not `require`/`module.exports`).
2. Set `"sideEffects": false` in package.json.
3. Use named exports, not default exports with namespace objects.
4. Avoid top-level side effects (module-scoped `console.log`, `addEventListener`, mutation).

```typescript
// Bad: barrel file re-exports everything, defeats tree-shaking
export * from "./button";
export * from "./modal";
export * from "./table";

// Good: separate entry points in exports map
// "exports": { "./button": "...", "./modal": "...", "./table": "..." }
```

## Publishing Checklist

```bash
# 1. Verify package contents
pnpm pack --dry-run          # Shows exactly what ships. No secrets, no tests, no src.

# 2. Check exports resolve
npx publint                  # Catches exports/types mismatches
npx arethetypeswrong         # Tests if types resolve for all consumers

# 3. Publish with provenance
npm publish --provenance      # Links package to GitHub commit (npm provenance)
```

### .npmrc for Publishing
```ini
# .npmrc (project root)
//registry.npmjs.org/:_authToken=${NPM_TOKEN}
access=public
provenance=true
```

### Scoped Packages
- `@scope/name` requires `"access": "public"` for free npm accounts.
- First publish: `npm publish --access public`. After that, access is remembered.
- Private packages: `npm publish` (default access is restricted for scoped).

## Files Field vs .npmignore

Always use `"files"` whitelist. Never use `.npmignore`.

```jsonc
"files": ["dist", "README.md", "LICENSE"]
```

This is a whitelist. Only these paths end up in the tarball. `package.json` is always included automatically. `node_modules` is always excluded automatically. The whitelist approach is safer than blacklisting with `.npmignore` because new files you add (like `.env.local`) never accidentally ship.

## bin Field for CLIs

```jsonc
{
  "bin": { "my-tool": "./dist/cli.js" }
}
```

The CLI entry file needs a shebang:
```typescript
#!/usr/bin/env node
// dist/cli.js
import { run } from "./index.js";
run(process.argv.slice(2));
```

Ensure the built file has the shebang. tsup preserves it if your source has it. Add `banner: { js: "#!/usr/bin/env node" }` in tsup config if needed.

## Wrong Exports Edge Case: ESM/CJS Mismatch Debugging

```
SYMPTOM: "Cannot find module" or "ERR_REQUIRE_ESM" in consumers
```

### Diagnosis Checklist

```bash
# 1. Verify package contents
npx publint              # Catches exports issues
npx arethetypeswrong     # Tests TypeScript types across formats

# 2. Check what Node.js resolves
node -p "require.resolve('@scope/my-lib')"           # CJS resolution
node --input-type=module -e "import('@scope/my-lib')" # ESM resolution

# 3. Inspect actual exports in published package
npm pack --dry-run
tar -tzf *.tgz | grep dist/
```

### Common Mismatches

```jsonc
// ❌ BAD: Exports mismatch with actual files
{
  "type": "module",
  "exports": {
    ".": {
      "import": "./dist/index.js",   // File exists
      "require": "./dist/index.cjs"  // ❌ File missing or wrong extension
    }
  }
}

// ✅ GOOD: Match tsup output exactly
// tsup outputs: index.js (ESM), index.cjs (CJS)
{
  "type": "module",
  "exports": {
    ".": {
      "import": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
      "require": { "types": "./dist/index.d.cts", "default": "./dist/index.cjs" }
    }
  }
}
```

### Fix: ESM-only package causing CJS errors

If your package is ESM-only and consumers using `require()` fail:

```jsonc
{
  "type": "module",
  "exports": {
    ".": {
      "import": "./dist/index.js"
      // No "require" field = CJS consumers get clear error
    }
  }
}
```

Document in README: "This is an ESM-only package. Use `import` not `require`."

### Fix: Dual package hazard

```javascript
// ❌ HAZARD: Same code loaded twice if not careful
// app.mjs:  import { state } from 'my-lib'
// app.cjs:  const { state } = require('my-lib')
// Result: Two separate instances of `state`
```

Solution: Document that mixing ESM/CJS in the same app can cause state duplication. Recommend consumers stick to one format project-wide.

### Testing Both Formats Locally

```bash
# Create test CJS consumer
mkdir test-cjs && cd test-cjs
npm init -y
npm install ../my-package
node -e "const x = require('@scope/my-lib'); console.log(x)"

# Create test ESM consumer
mkdir test-esm && cd test-esm
npm init -y && echo '{"type":"module"}' > package.json
npm install ../my-package
node -e "import('@scope/my-lib').then(x => console.log(x))"
```
