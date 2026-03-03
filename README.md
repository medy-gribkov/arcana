<p align="center">
  <img src="assets/banner.svg" alt="arcana" width="600"/>
</p>

<p align="center">
  <strong>The AI development toolkit.</strong><br/>
  Skills, scripts, diagnostics, and security scanning for every coding agent.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@sporesec/arcana"><img src="https://img.shields.io/npm/v/@sporesec/arcana?style=for-the-badge&color=d4943a" alt="npm"/></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-d4943a?style=for-the-badge" alt="MIT"/></a>
  <a href="#skills"><img src="https://img.shields.io/badge/Skills-60-d4943a?style=for-the-badge" alt="Skills"/></a>
  <a href="#compatibility"><img src="https://img.shields.io/badge/Platforms-7-d4943a?style=for-the-badge" alt="Platforms"/></a>
</p>

---

## What Makes Arcana Different

**60 battle-tested skills** with code examples, BAD/GOOD pairs, and procedural workflows in every section. Not capability lists. Not vague instructions. Real patterns you can copy.

**Validation scripts** that run as zero-cost automation. Security review checks generated auth code. Database design lints migration files. TypeScript scans for `any` usage. All executed, never loaded as context.

**Environment management.** `doctor` diagnoses issues. `clean` removes stale data. `stats` shows session analytics. `init` scaffolds config for 7 platforms. `validate` catches broken skills before they waste tokens.

**Format-portable.** Skills are markdown. Any LLM can read them. Claude Code loads them natively. Other platforms get config scaffolding via `arcana init`.

## Quick Start

```bash
# Install globally
npm i -g @sporesec/arcana

# Install all 60 skills
arcana install --all

# Or install specific skills
arcana install golang-pro security-review typescript-advanced
```

Or without installing:
```bash
npx @sporesec/arcana install --all
```

Skills are installed to `~/.agents/skills/`, the standard location for all compatible tools.

## CLI Commands

### Skills

| Command | Description |
|---------|-------------|
| `arcana install <skill>` | Install a skill |
| `arcana install --all` | Install all skills |
| `arcana uninstall <skill>` | Remove a skill |
| `arcana update --all` | Update all installed skills |
| `arcana list` | List available skills |
| `arcana search <query>` | Search across providers |
| `arcana info <skill>` | Show skill details |
| `arcana create <name>` | Create a new skill |
| `arcana validate --all --fix` | Validate and fix all skills |

### Environment

| Command | Description |
|---------|-------------|
| `arcana init` | Scaffold AI tool config (CLAUDE.md, .cursor/rules/, etc.) |
| `arcana doctor` | Diagnose environment issues |
| `arcana clean --dry-run` | Preview cleanup of stale data |
| `arcana stats` | Session analytics and token usage |
| `arcana config list` | View configuration |

### Providers

```bash
arcana providers --add someone/their-skills
arcana list --provider someone/their-skills
```

All commands support `--json` for machine-readable output and respect `NO_COLOR`.

## Skills

| Skill | Category | Description |
|-------|----------|-------------|
| api-design | API | REST and GraphQL design. Resource naming, status codes, pagination, versioning, DataLoader |
| api-testing | API | Contract testing (Pact), API mocking (MSW), load testing (k6), BAD/GOOD patterns |
| code-reviewer | Code Quality | Code review with concrete examples. Severity definitions, inline comments, review output |
| codebase-dissection | Code Quality | 4-phase systematic analysis. Architecture mapping, data flow, dead code, anti-patterns |
| frontend-code-review | Code Quality | Frontend review checklist. cn() usage, memoization, accessibility, inline rules |
| refactoring-patterns | Code Quality | Before/after diffs for extract method, replace conditional, dead code, DI patterns |
| database-design | Database | Schema design, normalization, indexing, EXPLAIN ANALYZE, GORM for Go, migrations |
| frontend-design | Design | Production interfaces. CSS custom properties, accessibility, DON'T/DO guidelines |
| container-security | DevOps | Dockerfile BAD/GOOD, rootless containers, image scanning, runtime security config |
| cost-optimization | DevOps | HPA config, spot instances, right-sizing, CDN caching, cost calculation examples |
| ci-cd-automation | DevOps | Multi-language CI. Go, Node, Python pipelines, Docker build caching, artifacts |
| ci-cd-pipelines | DevOps | GitHub Actions and GitLab CI. Matrix strategy, caching gotchas, deployment patterns |
| docker-kubernetes | DevOps | Multi-stage builds (Go, Node, Python), K8s manifests, health checks, security context |
| dependency-audit | DevOps | npm audit, go mod tidy, pip-audit, license compliance, CI automation |
| doc-generation | Docs | OpenAPI, JSDoc, godoc, Mermaid diagrams, procedural walkthrough |
| env-config | DevOps | .env management, Zod validation, dotenv-vault, AWS SSM, 12-factor patterns |
| git-workflow | DevOps | Merge vs rebase decision tree, worktrees, SSH signing, sparse checkout |
| update-docs | Docs | MDX workflow for Next.js docs, screenshot patterns, PR-based updates |
| docx | Documents | Word document creation/editing. XML reference, tracked changes, page setup |
| xlsx | Documents | Spreadsheet operations. Pivot tables, chart formulas, financial models |
| fullstack-developer | Full-Stack | React, Node.js, databases, auth flow (JWT), API error handling patterns |
| asset-optimization | Game Dev | Compression workflows, WebP/AVIF conversion, before/after optimization |
| audio-systems | Game Dev | FMOD, Wwise, spatial audio, dynamic mixing, Unity/Godot integration code |
| daw-music | Game Dev | MIDI processing, audio synthesis, interactive music, game audio code |
| game-design-theory | Game Dev | MDA framework, balance formulas, XP curves, player psychology |
| game-engines | Game Dev | Unity, Unreal, Godot 4.x. Architecture patterns, GDScript 2.0, C# code |
| game-servers | Game Dev | Server architecture, matchmaking, WebSocket reconnection, cost analysis |
| game-tools-workflows | Game Dev | Git LFS, build automation, asset pipelines, bandwidth gotchas |
| gameplay-mechanics | Game Dev | Input buffering, feedback loops, balance spreadsheets, production code |
| graphics-rendering | Game Dev | PBR shaders, WebGPU, VFX recipes, optimization matrix |
| level-design | Game Dev | Whitebox workflow, pacing graphs, procedural generation seeds |
| memory-management | Game Dev | Object pooling, GC optimization, Rust ownership comparison, budgets |
| monetization-systems | Game Dev | IAP manager, battle pass design, A/B test revenue formulas, KPIs |
| networking-servers | Game Dev | Lag compensation, netcode, synchronization, anti-cheat patterns |
| optimization-performance | Game Dev | Profiling, multi-platform, frame rate optimization, LCP srcset |
| particle-systems | Game Dev | VFX, physics simulation, LOD strategy, post-processing |
| programming-architecture | Game Dev | ECS, data-oriented design, clean architecture, concrete implementations |
| publishing-platforms | Game Dev | Steam, Epic, console submission. Revenue splits, certification checklists |
| shader-techniques | Game Dev | HLSL/GLSL, mobile GPU gotchas, custom materials, optimization |
| synchronization-algorithms | Game Dev | Rollback netcode, client prediction, server reconciliation code |
| game-programming-languages | Languages | C# 12, C++ 23, GDScript 2.0. Syntax, patterns, engine idioms |
| golang-pro | Languages | Go 1.23+. Error handling, HTTP routing, concurrency, testing, profiling |
| python-best-practices | Languages | Python 3.12+. Type hints, ruff, uv, async, dataclasses, pyright config |
| rust-best-practices | Languages | Ownership, lifetimes, error handling, async Tokio, lifetime diagrams |
| typescript | Languages | Strict types, generics constraints, utility types, discriminated unions |
| typescript-advanced | Languages | Branded types, conditional types, satisfies operator, type-level programming |
| go-linter-configuration | Linting | golangci-lint setup, .golangci.yml, import resolution, troubleshooting |
| find-skills | Meta | Skill discovery. Searches installed and available skills by keyword |
| skill-creation-guide | Meta | How to create effective skills. Validation, edge cases, progressive disclosure |
| skill-creator | Meta | Create or update skills. References layout, frontmatter rules |
| incident-response | Ops | Severity levels, runbooks, PagerDuty/OpsGenie webhooks, blameless postmortems |
| local-security | Security | SSH, GPG, credential managers, Windows OpenSSH agent, file permissions |
| security-review | Security | OWASP Top 10, injection prevention, secrets rotation, csrf-csrf patterns |
| monitoring-observability | Monitoring | JSON logging, Prometheus, OpenTelemetry, Grafana dashboard JSON, SLO alerts |
| project-migration | Migration | Project folder migration preserving Claude Code session data and paths |
| npm-package | Packages | tsup bundling, ESM/CJS exports, wrong-exports debugging, monorepo setup |
| performance-optimization | Performance | Core Web Vitals, bundle analysis, caching, memory leak detection |
| pre-production-review | Review | 8-domain codebase analysis with health scoring and phased remediation |
| testing-strategy | Testing | Test pyramid, pytest/Vitest/Jest/Go, flakiness detection, TDD workflow |
| remotion-best-practices | Video | React video creation. Composition, spring(), interpolate, Sequence, Audio |

## How It Compares

| Feature | Arcana | Skills.sh | Manual |
|---------|--------|-----------|--------|
| Skill install | Yes | Yes | Copy files |
| Validation scripts | Yes (zero token cost) | No | No |
| Environment doctor | Yes | No | No |
| Multi-platform init | 7 platforms | 17+ agents | Manual |
| Skill validation | `validate --all --fix` | No | No |
| Security scanning | Built-in | No | No |
| Skill count | 60 curated | Community | DIY |

## Compatibility

Skills are plain markdown with YAML frontmatter. Claude Code loads them natively from `~/.agents/skills/`. Other platforms read them as project context after running `arcana init`.

| Platform | Config File | Integration |
|----------|------------|-------------|
| Claude Code | `CLAUDE.md` | Native skill loading |
| Codex CLI | `AGENTS.md` | Config scaffold via `arcana init` |
| Cursor AI | `.cursor/rules/` | Config scaffold via `arcana init` |
| Gemini CLI | `GEMINI.md` | Config scaffold via `arcana init` |
| Windsurf | `.windsurfrules` | Config scaffold via `arcana init` |
| Antigravity | `AGENT.md` | Config scaffold via `arcana init` |
| Aider | `.aider.conf.yml` | Config scaffold via `arcana init` |

## Support This Project

I build and maintain these skills in my free time. If they save you time, consider supporting the project.

- [GitHub Sponsors](https://github.com/sponsors/medy-gribkov)
- [Buy Me a Coffee](https://buymeacoffee.com/mahdygribkov)
- [Ko-fi](https://ko-fi.com/mahdygribkov)

Starring the repo also helps.

## Contributing

Want to add a skill or improve an existing one? Check [CONTRIBUTING.md](CONTRIBUTING.md).

## Security

Found a vulnerability? See [SECURITY.md](SECURITY.md).

## Credits

Created by [Mahdy Gribkov](https://mahdygribkov.vercel.app).

## License

[MIT](LICENSE)
