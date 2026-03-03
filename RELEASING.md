# Release Protocol

## Before Bumping a Version

1. All tests pass: `cd cli && npm test`
2. Lint clean: `npm run lint && npm run format:check`
3. Type check: `npx tsc --noEmit`
4. Skills validated: `npx arcana validate --all`
5. Security scan: `bash scripts/security-scan.sh`
6. CHANGELOG.md updated with new version entry
7. `assets/banner.svg` skill count matches actual count
8. README.md skill count and badges match actual count
9. marketplace.json plugin count matches skill directories
10. CITATION.cff version updated

## Version Types

- **patch** (3.0.x): Bug fixes, skill content updates, typo fixes
- **minor** (3.x.0): New skills, new commands, new features, license changes
- **major** (x.0.0): Breaking changes (renamed skills, removed commands, API changes)

## Release Steps

1. Update version: `cd cli && npm version <patch|minor|major> --no-git-tag-version`
2. Update `CHANGELOG.md` with new version entry
3. Update `CITATION.cff` version field
4. Update `package-lock.json`: `npm install --package-lock-only`
5. Commit: `git commit -am "chore: release vX.Y.Z"`
6. Push: `git push origin master`
7. Wait for CI to pass (all 4 jobs green)
8. Create GitHub release: tag `vX.Y.Z`, title `vX.Y.Z`, auto-generate notes
9. The `npm-publish.yml` workflow handles: lint, test, build, publish with provenance

## NEVER Publish Locally

All npm publishes go through GitHub Actions for SLSA provenance attestation.
Local `npm publish` skips provenance, skips CI gates, and produces unverified packages.

## After Release

1. Verify npm: `npm view @sporesec/arcana version`
2. Verify provenance badge on npmjs.com
3. Post announcement to: Reddit (r/node, r/javascript), Dev.to, X/Twitter
4. Update GitHub Discussions with release notes (if Discussions enabled)
