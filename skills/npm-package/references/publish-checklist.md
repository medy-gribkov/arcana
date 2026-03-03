# npm Publish Checklist

## Pre-Publish Checklist

- [ ] Version bumped according to semver (major/minor/patch)
- [ ] CHANGELOG updated with user-facing changes
- [ ] `pnpm pack --dry-run` shows only intended files (no src/, tests/, .env)
- [ ] `npx publint` passes (exports/types validated)
- [ ] `npx arethetypeswrong` passes (TypeScript resolution tested)
- [ ] Tests pass: `pnpm test`
- [ ] Build succeeds: `pnpm build`
- [ ] Both ESM and CJS tested locally
- [ ] README has accurate install and usage examples
- [ ] LICENSE file present
- [ ] No secrets in package contents

## tsup Config Examples

### Library (ESM + CJS, with types)

```typescript
// tsup.config.ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  treeshake: true,
  sourcemap: true,
  minify: false,
  target: 'node18',
  external: ['react', 'react-dom'],
  splitting: true,
});
```

### CLI Tool

```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/cli.ts', 'src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  target: 'node18',
  banner: { js: '#!/usr/bin/env node' },
  // Only apply banner to cli entry:
  esbuildOptions(options, context) {
    if (context.format === 'esm') {
      options.banner = { js: '' };
    }
  },
});
```

### Multiple Entry Points

```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    utils: 'src/utils.ts',
    react: 'src/react/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  external: ['react'],
});
```

## package.json Best Practices

```jsonc
{
  "name": "@scope/my-lib",
  "version": "1.0.0",
  "description": "Clear, searchable one-liner",
  "license": "MIT",
  "type": "module",
  "exports": {
    ".": {
      "import": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
      "require": { "types": "./dist/index.d.cts", "default": "./dist/index.cjs" }
    },
    "./utils": {
      "import": { "types": "./dist/utils.d.ts", "default": "./dist/utils.js" },
      "require": { "types": "./dist/utils.d.cts", "default": "./dist/utils.cjs" }
    }
  },
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": ["dist", "README.md", "LICENSE"],
  "sideEffects": false,
  "engines": { "node": ">=18" },
  "scripts": {
    "build": "tsup",
    "prepublishOnly": "pnpm build",
    "test": "vitest run",
    "lint": "eslint src/"
  },
  "peerDependencies": {
    "react": "^18.0.0 || ^19.0.0"
  },
  "peerDependenciesMeta": {
    "react": { "optional": true }
  },
  "devDependencies": {
    "react": "^19.0.0",
    "tsup": "^8.0.0",
    "typescript": "^5.7.0",
    "vitest": "^2.0.0"
  }
}
```

Key rules:
- `types` MUST come first in each exports condition block
- `files` whitelist is safer than `.npmignore` blacklist
- `sideEffects: false` enables tree-shaking
- `engines` documents minimum Node.js version
- `prepublishOnly` ensures build runs before publish

## Publish Commands

```bash
# First publish (scoped package)
npm publish --access public --provenance

# Subsequent publishes
npm publish --provenance

# Dry run to verify
npm publish --dry-run

# Publish with 2FA
npm publish --otp=123456

# Publish a beta/next tag
npm publish --tag next
```

## .npmrc Configuration

```ini
# Project .npmrc
//registry.npmjs.org/:_authToken=${NPM_TOKEN}
access=public
provenance=true
git-tag-version=false
```

## CI Publish Workflow

```yaml
# .github/workflows/publish.yml
name: Publish
on:
  push:
    tags: ['v*']
jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write    # Required for provenance
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          registry-url: https://registry.npmjs.org
      - run: pnpm install --frozen-lockfile
      - run: pnpm test
      - run: pnpm build
      - run: npx publint
      - run: npm publish --provenance --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

## Post-Publish Verification

```bash
# Check it published correctly
npm info @scope/my-lib

# Test install in clean environment
mkdir /tmp/test-pkg && cd /tmp/test-pkg
npm init -y
npm install @scope/my-lib

# Test CJS
node -e "const x = require('@scope/my-lib'); console.log(x)"

# Test ESM
echo '{"type":"module"}' > package.json
node -e "import('@scope/my-lib').then(x => console.log(x))"
```
