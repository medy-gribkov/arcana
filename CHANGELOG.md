# Changelog

## 3.1.0 (2026-03-03)

Official package hardening: license, security, attribution, discoverability, and release infrastructure.

### License
- **Apache 2.0**: Switched from MIT for stronger attribution protection
- **NOTICE file**: Required by Apache 2.0, credits SporeSec and inspiration projects
- **Trademark clause**: Protects the "Arcana" name under Section 6

### Attribution
- **CITATION.cff**: "Cite this repository" link on GitHub sidebar
- **Acknowledgments**: Credits skills.sh, token-optimizer, notebooklm-skill, notebooklm-py
- **NOTICE file**: Lists all inspiration projects (redistributors must include)

### npm Package
- **Keywords**: Expanded from 10 to 23 (all platforms, languages, categories)
- **Funding field**: "Fund this package" appears on npmjs.com
- **Author object**: Includes SporeSec URL and email
- **Provenance**: All future publishes via GitHub Actions (SLSA attestation)

### GitHub Configuration
- **release.yml**: Auto-generated release notes with categorized changelog
- **labels.yml**: Standard labels (breaking-change, new-skill, feature, bug, security)
- **RELEASING.md**: Version bump protocol, pre-release checklist, post-release steps

### Security
- **SECURITY.md**: Added supported versions table, SporeSec contact, built-in security reference
- **.gitignore**: Added secrets patterns (*.pem, *.key, credentials.json), build artifacts

### Documentation
- **README.md**: Full rewrite with expanded CLI commands, acknowledgments, branding
- **banner.svg**: Updated skill count from 58 to 74
- **CHANGELOG.md**: Added missing entries for v3.0.0 through v3.0.3

---

## 3.0.3 (2026-03-03)

NotebookLM research skill, 74 total skills.

### New Skill
- **notebooklm-research**: Playwright automation client for Google NotebookLM via CDP
  - Bundled scripts: `notebooklm_client.py` (6 subcommands), `setup_chrome.py`
  - Commands: `status`, `list`, `create`, `add-source`, `query`, `generate`
  - Sources: URLs, PDFs, YouTube, raw text
  - Artifacts: slides, infographics, quizzes, flashcards, reports, data tables, mind maps, video
  - Anti-detection: human-like typing (25-75ms/char), real Chrome via CDP

---

## 3.0.2 (2026-03-02)

UX overhaul: backup safety, health loop, token budget, breadcrumbs.

### Safety
- **Backup before uninstall**: Skills backed up to `~/.arcana/backups/{name}_{timestamp}/`
- **Dry-run preview**: Shows directory path, file count, and size before uninstall confirm
- New utility: `backup.ts` with `backupSkill()` and `pruneOldBackups()`

### Interactive UX
- **Health check loop**: Stays on health screen after fixes, re-runs checks automatically
- **Token budget dashboard**: Visual progress bar showing context window usage
- **Breadcrumb navigation**: Browse > Category, Your skills > Category, Search > Results
- **Better menu labels**: "Your skills", "Browse marketplace", "Health check", "Token budget"
- **Skill detail**: Token estimate (~X.XK tokens), grouped sections with visual hierarchy

### Testing
- **524 tests** across 53 files (was 500)

---

## 3.0.1 (2026-03-01)

Validation overhaul, cross-validation, quality gate.

### Validation
- **Cross-validation** (`--cross`): Orphan detection, description drift, companion validation
- **Quality gate** (`--min-score N`): Blocks skills below audit threshold
- **CI integration**: `validate --all --cross --min-score 40` in ci.yml

### Bug Fixes
- Fixed ESLint `no-useless-assignment` in quality.ts
- Removed 3 `curl | sh` patterns in go-linter-configuration skill

---

## 3.0.0 (2026-03-01)

Breaking release: tech stack refresh, 73 skills, renamed nextjs skill.

### Breaking Changes
- **nextjs-15 renamed to nextjs-16**: Reflects Next.js 16 with Turbopack and Cache Components
- **Tech versions updated**: Node 24, Go 1.26, Python 3.14, TypeScript 6, React 19.2, Next.js 16

### Skills
- **73 verified skills** across web, backend, DevOps, security, testing, office, game dev
- All skills refreshed for March 2026 ecosystem versions
- **31 total commands**

---

## 2.5.0 (2026-02-28)

Context-aware intelligence: project detection, smart recommendations, conflict checking, trust signals.

### Context Engine (WS1)
- **`detectProjectContext()`**: Reads package.json, go.mod, requirements.txt, Dockerfile, CLAUDE.md, and .claude/rules/ to build a full project profile
- **Tech stack detection**: 35+ npm packages, 13 Go modules, 15 Python packages mapped to tags
- **Preference extraction**: Parses CLAUDE.md for coding preferences (TypeScript strict, async/await, etc.)
- **Rule awareness**: Reads .claude/rules/*.md filenames to detect overlap with skills
- **Refactored `arcana init`**: detectProject() now delegates to the context engine

### Marketplace Metadata (WS2)
- **Extended SkillInfo**: 5 new optional fields (tags, conflicts, companions, verified, author)
- **All 60 skills enriched**: Every skill in marketplace.json now has tags, verified status, author, and companion suggestions
- **Backward compatible**: All new fields optional, existing integrations unaffected

### Smart Recommendations (WS3)
- **`arcana recommend`**: Context-aware skill suggestions based on project analysis
- **Scoring algorithm**: Tag match (+20/tag, cap 60), category match (+10), companion boost (+15), preference alignment (+10), rule overlap penalty (-30), explicit conflict (-100)
- **Verdicts**: "recommended" (score >= 40), "optional" (>= 15), "skip" (< 15), "conflict" (blocks)
- **Options**: `--json`, `--limit <n>`, `--provider <name>`

### Conflict Detection (WS4)
- **Pre-install conflict check**: Runs after security scan, before file write
- **Three conflict types**: skill-conflict (block), rule-overlap (warn), preference-clash (warn)
- **Opposing preference pairs**: Detects contradictions (callbacks vs async/await, any vs strict typing)
- **`--no-check` flag**: Skip conflict detection on install

### Trust & Quality Signals (WS5)
- **`arcana info`**: Shows verified badge, author, tags, companions, conflicts
- **`arcana list`**: Verified [V] badge and tags in table output
- **Interactive mode**: Trust info (verified/community, author, tags) in skill detail view

### Enhanced Search (WS6)
- **`--tag <tag>`**: Filter search results by tech stack tag
- **`--smart`**: Context-aware ranking using project detection (boosts relevant results)
- **Search display**: Verified badge and tags shown in results

### Testing
- **458 tests** across 47 test files (was 427 across 43)
- **4 new test files**: project-context (10), scoring (9), conflict-check (8), recommend (4)

### Infrastructure
- **29 total commands** (was 28)
- **4 new source files**, 8 new files total (including tests)
- **ESM-only**, TypeScript strict, zero lint errors

---

## 2.4.2 (2026-02-27)

Deep security hardening, 10 new commands, integrity lockfile, and full modernization.

### Security (WS1)
- **Scanner expanded**: 20 patterns to 45+ covering Snyk ToxicSkills taxonomy
- **New CRITICAL patterns**: curl|source piping, nested base64, encrypted archives, GitHub release binaries, PowerShell encoded commands
- **New HIGH patterns**: API key printing, AWS access keys (AKIA), Anthropic/OpenAI keys, auth headers, memory poisoning (SOUL.md/MEMORY.md/.cursorrules), Unicode zero-width smuggling, behavior override, autonomy escalation, data exfiltration
- **New MEDIUM patterns**: global package installs, crypto APIs, rm -rf, sudo, system dir writes, docker privileged, third-party HTTP

### Integrity & Lockfile (WS2)
- **`arcana lock`**: Generate `~/.arcana/arcana-lock.json` with SHA-256 hashes of all installed skills
- **`arcana lock --ci`**: Validate lockfile matches installed state (deterministic CI mode)
- **`arcana verify [skill]`**: Check installed skill integrity against lockfile (ok/modified/missing)
- **Automatic lockfile updates**: `install` and `update` commands now write lockfile entries on success

### Performance (WS3)
- **Shell completions**: `arcana completions <bash|zsh|fish>` generates completion scripts
- **Slug length limit**: 128 character max on skill names to prevent path traversal via long names

### Token Optimization (WS4)
- **`arcana benchmark [skill]`**: Measure token cost per skill (file count, bytes, estimated tokens, context %)
- **`arcana benchmark --all`**: Sorted table of all skills by token cost
- **`arcana profile`**: Named skill profiles (create, delete, show, apply) for switching between skill sets

### Inspection (WS5)
- **`arcana diff <skill>`**: Show added/removed/modified files between installed and remote versions
- **`arcana outdated`**: List skills with newer versions available (semver comparison)

### Team & Workflow (WS6)
- **`arcana team init/sync/add/remove`**: Shared `.arcana/team.json` config (git-committable)
- **`arcana export`**: Export installed skills as JSON manifest or `--sbom` SPDX-lite format
- **`arcana import <file>`**: Import and install skills from a manifest file

### Testing (WS7)
- **427 tests** across 43 test files (was 355 across 35)
- **Coverage**: 59.5% stmts, 48.6% branches, 67% funcs, 60.3% lines (all above thresholds)
- **8 new test files** for all new commands

### Infrastructure
- **28 total commands** (was 18)
- **10 new source files**, ~1,800 lines of new code
- **ESM-only**, TypeScript strict, zero lint errors

---

## 2.4.1 (2026-02-27)

CI hardening, test coverage, linting, npm package optimization, session pruning.

### CI/CD
- **Node matrix**: CI now tests on Node 18, 20, and 22 (was 22 only)
- **ESLint + Prettier**: Lint and format checks enforced in CI
- **Coverage gate**: Vitest coverage with v8 provider, thresholds enforced (60% statements, 45% branches)
- **Publish hardening**: npm-publish.yml now runs lint, type check, and full test suite before publish
- **CHANGELOG validation**: Publish workflow rejects releases without a CHANGELOG entry
- **Post-publish verification**: Workflow verifies package is visible on npm after publish

### Testing
- **5 new test files**: compact, clean, optimize, init, scanner (70 new tests)
- **146 total tests** across 13 test suites (was 76 tests across 8 suites)
- **Coverage infrastructure**: `@vitest/coverage-v8` with text, json-summary, and lcov reporters

### Code Quality
- **ESLint flat config**: `typescript-eslint` with strict rules (no-explicit-any, eqeqeq, no-eval)
- **Prettier**: 120-char lines, trailing commas, double quotes, enforced across all source
- **TypeScript strict flags**: `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, `noFallthroughCasesInSwitch`
- **No source maps or declaration maps in dist** (saves ~215 KB in npm package)

### NPM Package
- **`files` whitelist**: Replaced `.npmignore` with `files` field (whitelist safer than blacklist)
- **79 files / 56 KB packed** (was 189 files / 108 KB). 48% size reduction.
- **`publishConfig`**: provenance and public access configured in package.json

### New Features
- **`arcana compact --prune`**: Deletes main sessions older than 14 days AND larger than 10 MB. Always keeps 3 newest per project. Supports `--prune-days <n>` override and `--dry-run`.
- **`arcana optimize` top skills report**: Shows top 5 largest skills by size with estimated token cost. Warns at >3 MB total.

---

## 2.4.0 (2026-02-26)

Session management, optimization diagnostics, and disk cleanup.

### New Commands
- **`arcana compact`**: Removes agent log files from `~/.claude/projects/`. Supports `--dry-run` and `--json`.
- **`arcana optimize`**: Claude Code optimization report. Checks autocompact threshold, effort level, non-essential calls, PreCompact hook, skill token budget, MEMORY.md sizes, agent log bloat, and disk health. Supports `--json`.

### Enhanced Commands
- **`arcana clean`**: Tiered retention (agent logs: 7 days, main sessions: 30 days). Aggressive mode with `--aggressive`. Custom retention with `--keep-days <n>`. Orphaned project detection and cleanup. Broken symlink removal. Auxiliary directory purge (todoStorage, statsStorage, cache).
- **`arcana stats`**: Expanded with per-project breakdown, orphaned project detection.

### CLI Improvements
- **PreCompact hook**: `arcana init --tool claude` now installs a PreCompact hook that preserves context before auto-compaction
- **Orphaned project detection**: `isOrphanedProject()` decodes Claude's path encoding and checks if source directories still exist on disk

---

## 2.3.0 (2026-03-01)

Bug fixes, honest compatibility claims, and namespace rename.

### Breaking
- **Package renamed** from `@mahdy-gribkov/arcana` to `@sporesec/arcana`. Old package deprecated with pointer.

### Bug Fixes
- **Provider repo reference**: ArcanaProvider and default config now point to `medy-gribkov/arcana` (was `mahdy-gribkov`)
- **Antigravity/Gemini collision**: `arcana init --tool all` no longer overwrites Gemini config with Antigravity. Antigravity now uses `AGENT.md`
- **Token estimate**: Fixed 3.75x inflation in `stats` and `install` size warnings (was ~15 chars/token, now ~4)
- **YAML multiline**: Frontmatter parser now handles `|-`, `|+`, `>-`, `>+` scalar indicators
- **Path traversal**: Reject UNC paths (`\\server\share`, `//server/share`) in skill file extraction
- **Security scanner**: Detect multi-line `curl | bash` patterns (lines joined by trailing `\`)
- **Health check**: execSync commands validated against allowlist before execution

### Documentation
- **README**: Honest compatibility table. Claude Code = native, others = config scaffold via `arcana init`
- **All references** updated from `mahdy-gribkov` to `medy-gribkov` / `@sporesec/arcana`
- **marketplace.json**: Fixed truncated code-reviewer description

---

## 2.2.0 (2026-02-22)

Final polish release. All 60 skills enriched, CLI memory-aware, session history added.

### CLI Improvements
- **Skill size awareness**: Install now reports file size and estimated token count. Warns at >50KB.
- **Doctor check for token budget**: New health check warns about large skills (>50KB) with top-3 offenders listed.
- **Session history**: Ring buffer of last 50 actions at `~/.arcana/history.json`. Visible in `arcana stats`.
- **Interactive exit cleanup**: Provider cache cleared on exit, `p.outro()` farewell message.
- **Manage installed**: Category-based navigation instead of flat 60-item list.
- **Bulk uninstall**: `maxItems: 15` for scroll pagination on long lists.

### Skills Completion
- **7 oversized skills split**: doc-generation, refactoring-patterns, typescript, container-security, cost-optimization, fullstack-developer, dependency-audit. All SKILL.md files now under 300 lines with content moved to `references/`.
- **25 bare skills enriched**: Every skill now has at least one `references/*.md` file with practical configs, checklists, or templates.
- **Audit results**: 54 PERFECT, 6 STRONG, 0 ADEQUATE, 0 WEAK (excluding test artifacts).

### Housekeeping
- `arcana clean` now clears action history
- `arcana stats` shows recent activity from session history
- `.gitignore` updated for research notes and promo artifacts

## 2.1.1 (2026-02-14)

UX overhaul, bug fixes, JSON mode hardening.

### UX Overhaul
- ASCII ARCANA banner with 6-step gray gradient (256-color ANSI)
- `@clack/prompts` railroad-track UI for interactive commands (create, install, uninstall, init)
- First-run welcome guide with clack-styled output
- Grouped command help (Skills, Environment, Providers, Global Options)
- Tagline: "Supercharge any AI coding agent."

### Security
- GITHUB_TOKEN now only sent to verified GitHub hostnames (was substring match, could leak to malicious providers)
- GitHubProvider branch parameter now validated via `validateSlug()` (was used raw in URLs)
- Marketplace plugin fields validated before use (missing name/description/version filtered out)

### Bug Fixes
- `info --json` no longer corrupts output with spinner frames
- `info --json` now outputs JSON error on "not found" and network failures (was plain text or empty)
- `list --json` and `search --json` now output JSON error on network failures (was plain text)
- `update --json` mock spinner objects now have consistent shape (prevents runtime crash)
- `install --all --json` now reports provider list errors in output (was silently swallowed)
- `install` guards against empty provider list (was undefined crash)
- `validate` error output respects `--json` flag
- `config set/get/reset` now respect `--json` flag
- Antigravity template no longer identical to Gemini template (mentions `.agent/` workspace)
- `stats` now streams .jsonl files in 64KB chunks (was loading entire file into memory)
- Unknown error objects in global handler now produce output (was silent exit)
- `info`, `list`, `search` no longer print double error messages on network failure
- Individual file fetch failures now include file path in error message
- Multiline YAML description parser no longer breaks on empty lines within `|` blocks
- `providers --add` noop spinner shape now matches all other commands (was missing stop/info/message)
- Fuzzy search no longer returns false positives for queries shorter than 3 characters
- `update --all` pre-fetches skill lists instead of N+1 `info()` calls per installed skill
- Ad-hoc providers (`--provider owner/repo`) now cached across calls
- `audit --json` without args now outputs JSON error (was plain text)
- `audit --json` with no skills installed now outputs `{ results: [] }` (was plain text)
- `audit` no longer crashes on unreadable SKILL.md (returns WEAK rating)
- `validate --json` with no skills installed now outputs JSON (was plain text)
- `validate --fix` now uses atomic writes (was raw writeFileSync, crash could corrupt SKILL.md)
- `validate --fix` now reports write failures instead of silent catch
- `config --json` with invalid key now outputs JSON error (was plain text)
- `config reset` rmSync now uses `{ force: true }` with try-catch (was race-prone and unhandled)
- `uninstall --json` now includes `error` field on "not installed" (was missing)
- `uninstall --json` rmSync now wrapped in try-catch (Windows file locks caused stack trace)
- `uninstall --json` now tracks and reports symlink removal errors (was silently swallowed)
- `create` file writes now wrapped in try-catch (disk full/permissions crashed after interactive prompts)
- `init` per-tool file writes now wrapped in try-catch with continue (one failure no longer kills all)
- `install --dry-run --json` now outputs `{ dryRun: true, wouldInstall, files }` (was empty arrays)
- `update --json` without args now outputs JSON error (was plain text)
- `update --json` with no skills installed now outputs JSON (was plain text)
- `update --json` error responses now include `error` field (was missing on 3 paths)
- `stats --json` with no sessions now outputs `{ totalSessions: 0 }` (was plain text)
- `stats` file descriptor leak fixed (readSync failure now always closes fd via try-finally)
- `install --json` single-skill catch now includes `error` field (was discarded)
- `install --all --json` per-skill failures now include error details in `failedErrors` (was lost)
- `clean` broken symlink removal now wrapped in try-catch (permission denied no longer crashes mid-cleanup)
- `clean --json` now reports `failedSymlinks` when removal fails
- `loadConfig()` now applies env overrides (ARCANA_INSTALL_DIR, ARCANA_DEFAULT_PROVIDER) when no config file exists (was silently ignored)
- `loadConfig()` no longer mutates shared DEFAULT_CONFIG (callers and env overrides could corrupt module-level constant)
- `loadConfig()` now returns defensive copies (prevents providers array mutation via addProvider/removeProvider)

### Bloat Removal
- Extracted `noopSpinner()` to ui.ts (was duplicated in info.ts, update.ts x2, providers.ts)
- Removed dead `vi.mock` from fs.test.ts (hoisted mock captured undefined variable, had no effect)
- Removed tautological `isFirstRun` test from help.test.ts (checked `typeof === "boolean"`, always true)

### New Features
- `providers --json` flag for machine-readable output
- `clean --json` flag for machine-readable output

### Cleanup
- Removed dead `ConfigError` export from errors.ts
- `install` JSON catch block now includes error details
- `search` description truncation now matches `list` (80 chars)
- CHANGELOG version format corrected to semver (was 2.1.0.0)
- npm package now includes LICENSE and README
- Welcome message no longer hardcodes skill count ("60+ skills" -> "available skills")
- Removed dead `vi.doMock` calls from fs.test.ts (mocks had no effect on statically imported functions)
- Removed dead `HttpError` import from providers.ts

---

## 2.1.0 (2026-02-14)

Pre-production review skill, CLI hardening, security audit, 60 skills at PERFECT quality.

### New Skill
- `pre-production-review`: 8-domain codebase analysis (security, data, backend, external, frontend, infra, performance, quality). Includes 5 analysis scripts and 3 reference docs. Inspired by [UCOF](https://github.com/nativardi/ucof) by @nativardi.

### CLI Improvements
- `--json` flag added to info, config, install, update, uninstall commands (was only on list, search, validate, doctor, stats, audit)
- `arcana create` now scaffolds scripts/ and references/ directories with .gitkeep
- `arcana init` now suggests relevant skills based on detected project type
- `arcana audit` command for automated skill quality scoring (8 checks, 100-point scale)
- Pre-commit hook: `scripts/hooks/pre-commit` runs security scan automatically

### Security Hardening
- Shell scripts: input validation rejects paths with shell metacharacters ($, `, ;, |, &)
- Shell scripts: symlink protection (! -type l) on all find commands
- Shell scripts: binary file protection (grep -I) on all scanning
- Shell scripts: improved JSON escaping, stdin size limits
- CLI: stronger path traversal protection (reject .., case-insensitive on Windows)
- CLI: SSRF protection with redirect hostname allowlist
- CLI: symlink-safe getDirSize (lstatSync instead of statSync)
- CLI: increased temp file entropy (16 bytes + PID)

### Quality
- All 60 skills rewritten to PERFECT quality (code in every section, BAD/GOOD pairs)
- 4 validation scripts added (security-review, database-design, typescript-advanced, golang-pro)
- Test count: 45 -> 66 (new: audit.test.ts, fs.test.ts)
- README rewritten with SVG branding, comparison table, full skill catalog
- Remotion promo video project (30s, 5 scenes, 1920x1080)

### Changed
- Total skills: 59 -> 60
- Total CLI tests: 45 -> 66
- security-scan.sh: added scan-secrets.sh to exclusion list

---

## 2.1.0-rc (2026-02-14)

Quality infrastructure, 10 new skills, JSON output, security automation.

### Testing
- Added vitest with 35 unit tests across 5 test suites (frontmatter, UI, HTTP, config, atomic writes)
- Tests run in CI pipeline (typecheck -> unit-tests -> smoke)

### CI/CD
- Unit test job added to test-cli.yml workflow
- Dependabot for npm and GitHub Actions dependencies (weekly)
- Security scanning workflow: npm audit + secret/path leak detection
- Feature request issue template

### New Features
- `--json` flag on list, search, validate, doctor commands
- `NO_COLOR` environment variable support (chalk.level = 0)
- Validation improvements: warn on quoted descriptions, info on missing ## headings

### New Skills (10)
- api-testing, container-security, cost-optimization, dependency-audit, doc-generation
- env-config, git-workflow, incident-response, local-security, refactoring-patterns

### Security
- `scripts/security-scan.sh`: scans for hardcoded paths, secrets, personal data, .env files
- CI workflow runs security scan on push and weekly

### Changed
- Total skills: 50 -> 60
- Total CLI tests: 0 -> 35

## 2.0.4 (2026-02-14)

Complete audit: 50+ fixes across CLI, repo, CI/CD, and documentation.

### Bug Fixes
- search.ts, info.ts: added try/catch for provider errors (was crashing on network failure)
- stats --json: banner no longer corrupts JSON output
- http.ts: redirect loop protection (max 5), 403 rate-limit detection fixed
- create.ts: validates description max length (1024 chars)
- init.ts: --tool validates against known tools, cursor path no longer has side effects
- install --all, update --all: one failure no longer kills entire batch
- config: validates installDir non-empty, defaultProvider must be a configured provider
- marketplace.json: fixed version numbers for 13 updated skills

### New Features
- `arcana list --installed`: show locally installed skills with metadata
- `arcana install --dry-run`: preview what would be installed
- `arcana uninstall --yes`: skip confirmation prompt
- `arcana list --no-cache` / `arcana search --no-cache`: bypass provider cache
- Environment variable overrides: ARCANA_INSTALL_DIR, ARCANA_DEFAULT_PROVIDER
- Fuzzy search: typos like "typscript" now find "typescript"
- Update command shows file count on success

### UX Improvements
- Batch install/update shows progress counter (5/49)
- List description truncation bumped to 80 chars
- Doctor shows disk usage threshold in warning
- Clean --dry-run shows what categories were checked
- Error messages suggest specific fixes (check internet, run doctor)
- Init templates are tool-specific (Cursor .mdc, Aider YAML, Codex sandbox)
- Validate: non-standard fields shown as info, not warnings
- Uninstall prompts for confirmation by default

### Code Quality
- tsconfig: noUncheckedIndexedAccess enabled
- registry.ts: deduplicated provider slug parsing (parseProviderSlug)
- frontmatter.ts: exported MIN/MAX_DESC_LENGTH constants
- types.ts: removed unused category field
- Atomic writes for create.ts

### Repo Infrastructure
- .gitignore: expanded from 6 to 30+ entries
- CI: validate-skills.yml fixed for master branch, Python-based description extraction
- CI: npm-publish.yml adds smoke test
- .github/CODEOWNERS: all files require @mahdy-gribkov review
- PR template: added testing, breaking changes, related issues sections
- SECURITY.md: added 90-day disclosure timeline
- CONTRIBUTING.md: added SKILL.md template example
- package.json: fixed homepage, added bugs URL, repository directory

## 2.0.3 (2026-02-13)

Full quality pass: 18 bug fixes, 3 new shared utilities, 3 new platform scaffolds. Security hardening based on patterns from Vercel CLI, gh CLI, and npm.

### Security
- github.ts: path traversal guard rejects `..` and absolute paths from marketplace tree API
- installSkill(): atomic install via temp `.installing` dir, crash recovery on restart
- writeSkillMeta(), saveConfig(): atomic writes via temp file + rename pattern
- config.ts: corrupted config.json now warns instead of silent fallback to defaults
- providers.ts: validates marketplace.json exists before adding a provider

### Fixed
- install.ts: writes `.arcana-meta.json` so `update` can track versions
- install.ts/update.ts: use config `defaultProvider` instead of hardcoded "arcana"
- install.ts: says "Reinstalling..." instead of "Updating..." when overwriting
- uninstall.ts: symlink matching uses `resolve()` + `sep`, no false partial matches
- uninstall.ts: logs warnings on symlink removal failures instead of silent catch
- frontmatter.ts: quoted values (`name: "foo"`) no longer include the quotes
- frontmatter.ts: handles YAML multiline descriptions (`|` and `>` markers)
- config.ts (utils): partial config no longer wipes providers array (shallow merge fix)
- config.ts (command): warns when setting installDir to a relative path
- config.ts (command): `arcana config reset` clears provider cache
- github.ts: VALID_SLUG regex requires alphanumeric start/end
- github.ts: default branch changed to "main" (arcana.ts passes "master" explicitly)
- stats.ts: JSONL line counting uses buffer scan, token count labeled as rough estimate
- doctor.ts: imports DoctorCheck from types.ts, proper git-not-installed error message
- errorAndExit(): default hint suggests `arcana doctor` when no specific hint given

### Added
- `utils/http.ts`: shared HTTP client with exponential backoff, jitter, retry on 429/5xx, rate limit detection, GITHUB_TOKEN support
- `utils/errors.ts`: structured CliError, HttpError, RateLimitError, ConfigError types
- `utils/atomic.ts`: atomicWriteSync (temp file + rename pattern from npm)
- `arcana init --tool windsurf` scaffolds `.windsurfrules`
- `arcana init --tool antigravity` scaffolds `GEMINI.md`
- `arcana init --tool aider` scaffolds `.aider.conf.yml`
- Platform count: 4 -> 7 (Claude, Cursor, Codex, Gemini, Antigravity, Windsurf, Aider)

### Changed
- github.ts: uses shared http.ts instead of local httpGet (retry, rate limits, auth)
- index.ts: centralized error handler for CliError/HttpError/RateLimitError
- getDirSize(): shared iterative implementation in utils/fs.ts, removed from doctor.ts and clean.ts
- getInstallDir(): reads from config instead of hardcoded path
- Codex scaffold: `codex.md` -> `AGENTS.md` (matches OpenAI's actual standard)
- README: compatibility table updated with all 7 platforms and their config files

## 2.0.2 (2026-02-13)

Expanded CLI from skill installer to AI development tool. 8 new commands for skill lifecycle, environment management, diagnostics, and analytics.

### Added - CLI Commands (8)
- `arcana create <name>` - Interactive skill scaffolding with frontmatter validation
- `arcana validate [skill] [--all] [--fix]` - Validate SKILL.md structure, auto-fix broken frontmatter
- `arcana update [skill] [--all]` - Update installed skills from provider
- `arcana uninstall <skill>` - Remove skill + associated symlinks
- `arcana init [--tool claude|cursor|codex|gemini|all]` - Scaffold AI tool config for current project
- `arcana doctor` - 7 diagnostic checks (Node version, skills, symlinks, git, config, disk, health)
- `arcana clean [--dry-run]` - Prune broken symlinks and stale project data
- `arcana stats [--json]` - Session analytics (session count, tokens, active projects)
- `arcana config [key] [value] | list | reset` - Get/set arcana configuration

### Added - Utilities
- `utils/frontmatter.ts` - SKILL.md parsing, validation, and auto-fixing
- `utils/fs.ts` - Skill metadata tracking (`.arcana-meta.json`)
- `types.ts` - SkillFrontmatter, ValidationResult, SkillMeta, DoctorCheck interfaces

### Changed
- CLI: 5 commands -> 14 commands (including help)
- Total code: ~800 lines -> ~2,000 lines
- Description: "Universal AI development CLI"

## 2.0.1 (2026-02-13)

Tripled skill count. Added 36 new skills across 15 categories, batch publishing pipeline, and automation tooling.

### Added - New Skills (36)
- **Languages**: rust-best-practices, python-best-practices, typescript-advanced, game-programming-languages
- **DevOps**: docker-kubernetes, ci-cd-pipelines, ci-cd-automation
- **Security**: security-review
- **Testing**: testing-strategy
- **API**: api-design
- **Database**: database-design
- **Packages**: npm-package
- **Monitoring**: monitoring-observability
- **Performance**: performance-optimization, optimization-performance
- **Full-Stack**: fullstack-developer
- **Documentation**: update-docs
- **Linting**: go-linter-configuration
- **Game Dev**: asset-optimization, audio-systems, daw-music, game-design-theory, game-engines, game-servers, game-tools-workflows, gameplay-mechanics, graphics-rendering, level-design, memory-management, monetization-systems, networking-servers, particle-systems, programming-architecture, publishing-platforms, shader-techniques, synchronization-algorithms

### Added - Tooling
- batch-publish.py (local tooling, not in repo): publish all skills in one command
- fix-sasmp.py (local tooling, not in repo): fix non-standard SASMP/OpenClaw frontmatter
- Extended CATEGORY_MAP for all 49 skills

### Changed
- Total skills: 13 -> 49
- Fixed frontmatter on 26 broken SKILL.md files
- Cleaned nested duplicate directories

## 2.0.0 (2026-02-13)

Initial public release. Renamed repo to Arcana, added npm CLI.

### Added
- 13 skills: codebase-dissection, code-reviewer, frontend-code-review, frontend-design, golang-pro, typescript, docx, xlsx, remotion-best-practices, skill-creator, skill-creation-guide, find-skills, project-migration
- CLI: `npx @mahdy-gribkov/arcana install <skill>`
- CONTRIBUTING.md, CODE_OF_CONDUCT.md, SECURITY.md
- GitHub issue/PR templates, FUNDING.yml
- CI validation (description quality checks)

## 1.0.0 (2026-02-13)

Initial release.

### Added
- project-migration: migrate project folders while preserving Claude Code session data
