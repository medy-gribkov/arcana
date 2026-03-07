<p align="center">
  <img src="assets/banner.svg" alt="arcana" width="600"/>
</p>

<p align="center">
  <strong>Context intelligence for AI coding agents.</strong><br/>
  74 skills, 40 commands, 7 platforms. By <a href="https://sporesec.com">SporeSec</a>.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@sporesec/arcana"><img src="https://img.shields.io/npm/v/@sporesec/arcana?style=for-the-badge&color=d4943a" alt="npm"/></a>
  <a href="https://www.npmjs.com/package/@sporesec/arcana"><img src="https://img.shields.io/npm/dw/@sporesec/arcana?style=for-the-badge&color=d4943a" alt="downloads"/></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-Apache_2.0-d4943a?style=for-the-badge" alt="Apache 2.0"/></a>
  <a href="https://github.com/medy-gribkov/arcana/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/medy-gribkov/arcana/ci.yml?style=for-the-badge&color=d4943a" alt="CI"/></a>
  <a href="#skills"><img src="https://img.shields.io/badge/Skills-74-d4943a?style=for-the-badge" alt="Skills"/></a>
  <a href="#compatibility"><img src="https://img.shields.io/badge/Platforms-7-d4943a?style=for-the-badge" alt="Platforms"/></a>
</p>

---

## What It Does

Arcana manages the context your AI coding agent reads. It installs structured skill packages (production code, BAD/GOOD pairs, procedural workflows), then curates which skills load into context based on your project, your token budget, and your usage patterns.

Without arcana, you either load everything (context bloat) or nothing (agent doesn't know your stack). Arcana solves this with budget-aware curation, output compression, cross-session memory, and session management.

## Quick Start

```bash
# npm
npm i -g @sporesec/arcana

# pnpm
pnpm add -g @sporesec/arcana

# without global install
npx @sporesec/arcana install --all
```

Then in your project:

```bash
arcana init          # detect project, configure AI tools
arcana install --all # install all 74 skills
arcana curate        # auto-select skills within token budget
```

Skills install to `~/.agents/skills/`. Config scaffolds for Claude Code, Cursor, Codex, Gemini, Windsurf, Antigravity, and Aider.

## Demo

<p align="center">
  <img src="assets/arcana-promo.gif" alt="Arcana CLI demo" width="720"/>
</p>

<sub>Built with arcana's own <code>remotion-best-practices</code> skill.</sub>

## Core Features

### Context Curation

`arcana curate` auto-generates `_active.md` containing full content of project-relevant skills within your model's token budget. Skills are ranked by project detection (tags, dependencies, file patterns) and usage history, then greedily packed until the budget fills.

```bash
arcana curate                                    # default: 30% of 200K context
arcana curate --model gpt-5.4 --budget 40        # 40% of 1M context
arcana curate --include golang-pro typescript     # force-include specific skills
```

Supported models: Claude Opus 4.6, Sonnet 4.6, Haiku 4.5 (200K), GPT-5.4 (1M), Gemini 3.1 Pro/Flash/Thinking (1M).

### Output Compression

`arcana compress` runs commands through a 4-stage pipeline (filter, group, truncate, dedup) that reduces token waste from tool output. Shell hooks make it transparent.

```bash
arcana compress git status                # compressed git output
arcana compress npm test                  # keep failures + summary only
echo "..." | arcana compress --stdin --tool tsc
arcana hook install                       # transparent shell hooks
arcana hook status                        # show cumulative savings
```

Rules for: git, npm/pnpm, tsc, vitest, jest, pytest, go test.

### Cross-Session Memory

`arcana remember` persists facts and preferences across sessions. `arcana recall` searches them. Project-relevant memories inject into `_active.md` automatically.

```bash
arcana remember "always use pnpm for this project"
arcana remember "use vitest not jest" --tag testing
arcana recall "package manager"
arcana recall --all
arcana forget abc123
```

### Session Intelligence

`arcana snapshot` saves session state before compaction or context loss. `arcana trim` analyzes and reduces session bloat without touching the original session files.

```bash
arcana snapshot pre-refactor              # save current session
arcana snapshot --list                    # list all snapshots
arcana trim --dry-run                     # analyze trimmable content
arcana trim                              # create trimmed copy
```

### MCP Server Management

`arcana mcp` installs and manages MCP servers (like Context7 for live docs) in your AI tool's config.

```bash
arcana mcp list                           # available MCP servers
arcana mcp install context7               # install into Claude/Cursor config
arcana mcp status                         # show configured servers
```

### Progressive Disclosure

Three tiers of context loading:

| Tier | File | Tokens/Skill | Use Case |
|------|------|-------------|----------|
| Index | `_index.md` | ~50 | Discovery, agent reads at startup |
| Active | `_active.md` | Full (budgeted) | Auto-curated, project-relevant |
| On-demand | `arcana load` | Full | Manual, specific skill needed |

```bash
arcana index                              # generate lightweight index
arcana load golang-pro typescript         # load specific skills on demand
arcana benchmark --all --progressive      # compare index vs full token cost
```

## CLI Commands

### Getting Started

| Command | Description |
|---------|-------------|
| `arcana` | Interactive TUI menu |
| `arcana init` | Detect project, configure AI tools, install skills, set up MCP |
| `arcana doctor` | Diagnose environment issues |
| `arcana doctor --fix` | Auto-fix common issues |

### Skills

| Command | Description |
|---------|-------------|
| `arcana install <skill>` | Install one or more skills |
| `arcana install --all` | Install all 74 skills |
| `arcana uninstall <skill>` | Remove one or more skills |
| `arcana update --all` | Update all installed skills |
| `arcana list` | List available skills |
| `arcana search <query>` | Search across providers |
| `arcana info <skill>` | Show skill details and metadata |
| `arcana recommend` | Smart skill recommendations for current project |

### Context Intelligence

| Command | Description |
|---------|-------------|
| `arcana curate` | Auto-generate budget-aware `_active.md` |
| `arcana compress <cmd>` | Run command with output compression |
| `arcana hook install` | Install transparent shell compression hooks |
| `arcana remember "..."` | Save a cross-session memory |
| `arcana recall <query>` | Search saved memories |
| `arcana snapshot [name]` | Save session state snapshot |
| `arcana trim` | Analyze and trim session bloat |
| `arcana mcp install <name>` | Install an MCP server |

### Progressive Disclosure

| Command | Description |
|---------|-------------|
| `arcana index` | Generate skill metadata index (~50 tokens/skill) |
| `arcana load <skill>` | Load full skill content on demand |
| `arcana benchmark --progressive` | Show before/after token comparison |

### Security

| Command | Description |
|---------|-------------|
| `arcana scan --all` | Scan for prompt injection, malware, credential theft |
| `arcana verify --all` | Verify SHA-256 integrity against lockfile |
| `arcana lock --ci` | Generate or validate reproducible lockfile |

### Development

| Command | Description |
|---------|-------------|
| `arcana create <name>` | Create a new skill from template |
| `arcana validate --all --fix` | Validate and auto-fix all skills |
| `arcana audit` | Audit skill quality (code examples, BAD/GOOD pairs) |

### Inspection

| Command | Description |
|---------|-------------|
| `arcana benchmark` | Measure token cost of installed skills |
| `arcana diff <skill>` | Show installed vs remote changes |
| `arcana outdated` | List skills with newer versions available |
| `arcana stats` | Session analytics and token usage |
| `arcana optimize` | Suggest token/performance improvements |

### Configuration

| Command | Description |
|---------|-------------|
| `arcana config` | View or modify configuration |
| `arcana providers --add <repo>` | Manage skill providers |
| `arcana clean` | Remove orphaned data and temp files |
| `arcana compact` | Remove agent logs, preserve session history |

### Workflow

| Command | Description |
|---------|-------------|
| `arcana profile <name>` | Manage named skill sets |
| `arcana team` | Shared team skill configuration |
| `arcana export` / `arcana import` | Portable skill manifests |
| `arcana completions <shell>` | Shell completions (bash, zsh, fish) |

All commands support `--json` for machine-readable output and respect `NO_COLOR`.

## Skills

| Skill | Category | Description |
|-------|----------|-------------|
| accessibility-wcag | Design | WCAG 2.1 AA compliance, semantic HTML, ARIA patterns, keyboard navigation, color contrast |
| api-design | API | REST and GraphQL design. Resource naming, status codes, pagination, versioning |
| api-testing | API | Contract testing (Pact), API mocking (MSW), load testing (k6), BAD/GOOD patterns |
| asset-optimization | Game Dev | Compression workflows, WebP/AVIF conversion, streaming, batch processing |
| audio-systems | Game Dev | FMOD, Wwise, spatial audio, dynamic mixing, Unity/Godot integration code |
| aws-essentials | Cloud | Lambda, S3, RDS, CloudFront, IAM, SQS/SNS, DynamoDB, least-privilege policies |
| ci-cd-pipelines | DevOps | GitHub Actions and GitLab CI. Matrix strategy, caching, deployment patterns |
| code-reviewer | Code Quality | Code review with concrete examples. Severity definitions, inline comments |
| codebase-analysis | Code Quality | 4-phase dissection + 8-domain health scoring. Architecture mapping, dead code |
| container-security | DevOps | Dockerfile BAD/GOOD, rootless containers, image scanning, runtime security |
| cost-optimization | DevOps | HPA config, spot instances, right-sizing, CDN caching, cost calculations |
| data-visualization | Frontend | Recharts, Chart.js, D3.js. Chart selection, responsive layouts, dashboards |
| database-design | Database | Schema design, normalization, indexing, EXPLAIN ANALYZE, migrations |
| doc-generation | Docs | OpenAPI, JSDoc, godoc, Mermaid diagrams, procedural walkthrough |
| docker-kubernetes | DevOps | Multi-stage builds (Go, Node, Python), K8s manifests, health checks, Helm |
| docx | Documents | Word document creation/editing. XML reference, tracked changes, page setup |
| email-notifications | Integration | SendGrid, AWS SES, React Email templates, SPF/DKIM/DMARC, bounce handling |
| env-config | DevOps | .env management, Zod validation, secret management, 12-factor patterns |
| flutter-mobile | Mobile | Widget composition, Riverpod state, GoRouter, platform channels, performance |
| framer-motion | Design | Framer Motion animations. Variants, gestures, layout animations, spring physics |
| frontend-code-review | Code Quality | Frontend review checklist. cn() usage, memoization, accessibility, inline rules |
| frontend-design | Design | Production interfaces. CSS custom properties, accessibility, DON'T/DO guidelines |
| fullstack-developer | Full-Stack | React, Node.js, databases, auth flow (JWT), API error handling patterns |
| game-engines | Game Dev | Unity, Unreal, Godot 4.x. Architecture patterns, GDScript 2.0, C# code |
| game-programming-languages | Languages | C# 12, C++ 23, GDScript 2.0. Syntax, patterns, engine idioms |
| game-servers | Game Dev | Server architecture, matchmaking, WebSocket reconnection, cost analysis |
| gameplay-design | Game Dev | MDA framework, balance formulas, combat systems, progression curves |
| git-workflow | DevOps | Merge vs rebase decision tree, worktrees, SSH signing, sparse checkout |
| go-linter-configuration | Linting | golangci-lint setup, .golangci.yml, import resolution, troubleshooting |
| godot-4 | Game Dev | Godot 4 with GDScript 2.0. Typed syntax, physics, state machines, exports |
| golang-pro | Languages | Go 1.26+. Error handling, HTTP routing, concurrency, testing, profiling |
| graphics-rendering | Game Dev | PBR shaders, WebGPU, VFX recipes, optimization matrix |
| i18n-localization | Web | next-intl, react-intl, ICU message syntax, plurals, RTL, dynamic locales |
| incident-response | Ops | Severity levels, runbooks, PagerDuty/OpsGenie webhooks, blameless postmortems |
| level-design | Game Dev | Whitebox workflow, pacing graphs, procedural generation seeds |
| llm-integration | AI | OpenAI and Anthropic APIs. Structured output, tool calling, streaming, prompts |
| local-security | Security | SSH, GPG, credential managers, Windows OpenSSH agent, file permissions |
| memory-management | Game Dev | Object pooling, GC optimization, Rust ownership comparison, budgets |
| monetization-systems | Game Dev | IAP manager, battle pass design, A/B test revenue formulas, KPIs |
| monitoring-observability | Monitoring | JSON logging, Prometheus, OpenTelemetry, Grafana dashboard JSON, SLO alerts |
| multiplayer-netcode | Game Dev | Client prediction, server reconciliation, rollback netcode, lag compensation |
| nextjs-16 | Framework | Turbopack, Cache Components, proxy.ts, Server Actions, React 19.2, App Router |
| notebooklm-research | Research | Google NotebookLM automation via Playwright CDP. Sources, queries, artifacts |
| npm-package | Packages | tsup bundling, ESM/CJS exports, semver, changesets, monorepo setup |
| oauth-auth | Security | OAuth2 PKCE, OIDC, JWT validation, session management, refresh token rotation |
| particle-systems | Game Dev | VFX, physics simulation, LOD strategy, post-processing |
| performance-optimization | Performance | Core Web Vitals, bundle analysis, caching, memory leaks, game frame budgets |
| playwright-testing | Testing | E2E testing, page objects, role-based locators, visual regression, CI integration |
| postgres-advanced | Database | Window functions, CTEs, JSONB, full-text search, partitioning, PgBouncer |
| programming-architecture | Game Dev | ECS, data-oriented design, clean architecture, concrete implementations |
| project-migration | Migration | Project folder migration preserving Claude Code session data and paths |
| publishing-platforms | Game Dev | Steam, Epic, console submission. Revenue splits, certification checklists |
| python-best-practices | Languages | Python 3.14+. Type hints, ruff, uv, async, Pydantic v2, pyproject.toml |
| react-native | Mobile | Expo, React Navigation, Zustand, FlatList optimization, Reanimated |
| redis-patterns | Database | Caching, sessions, rate limiting, pub/sub, sorted sets, distributed locks |
| refactoring-patterns | Code Quality | Before/after diffs for extract method, replace conditional, dead code, DI |
| remotion-best-practices | Video | React video creation. Composition, spring(), interpolate, Sequence, Audio |
| rust-best-practices | Languages | Ownership, lifetimes, error handling, async Tokio, lifetime diagrams |
| scraping-automation | Tooling | Playwright, Puppeteer. Stealth mode, proxy rotation, structured extraction |
| security-review | Security | OWASP Top 10, injection prevention, secrets rotation, csrf-csrf patterns |
| seo-meta | Web | Next.js metadata API, Open Graph, JSON-LD structured data, sitemaps |
| shader-techniques | Game Dev | HLSL/GLSL, mobile GPU gotchas, custom materials, optimization |
| skill-creator | Meta | Create or update skills. References layout, frontmatter rules, validation |
| spec-driven-dev | Planning | Specification-first development. Requirements, task breakdown, quality gates |
| stripe-payments | Integration | Checkout Sessions, subscriptions, webhook verification, SCA/3D Secure |
| tailwind-css | Design | Config, plugins, cn() utility, responsive design, dark mode, theming |
| terraform-iac | DevOps | State management, modules, workspaces, lifecycle rules, CI/CD, AWS patterns |
| testing-strategy | Testing | Test pyramid, pytest/Vitest/Jest/Go, flakiness detection, TDD workflow |
| typescript | Languages | Strict types, generics constraints, utility types, discriminated unions |
| typescript-advanced | Languages | Branded types, conditional types, satisfies operator, type-level programming |
| update-docs | Docs | MDX workflow for Next.js docs, screenshot patterns, PR-based updates |
| vercel-deploy | DevOps | Edge Functions, middleware, preview deployments, caching, monorepo config |
| websocket-realtime | Networking | Reconnection, heartbeat, SSE, Socket.io rooms, Redis pub/sub scaling |
| xlsx | Documents | Spreadsheet operations. Pivot tables, chart formulas, financial models |

## Compatibility

Skills are plain markdown with YAML frontmatter. Claude Code loads them natively from `~/.agents/skills/`. Other platforms read them as project context after running `arcana init`.

| Platform | Config File | Integration |
|----------|------------|-------------|
| Claude Code | `CLAUDE.md` | Native skill loading + `_active.md` curation |
| Codex CLI | `AGENTS.md` | Config scaffold via `arcana init` |
| Cursor AI | `.cursor/rules/` | Config scaffold via `arcana init` |
| Gemini CLI | `GEMINI.md` | Config scaffold via `arcana init` |
| Windsurf | `.windsurfrules` | Config scaffold via `arcana init` |
| Antigravity | `AGENT.md` | Config scaffold via `arcana init` |
| Aider | `.aider.conf.yml` | Config scaffold via `arcana init` |

## Acknowledgments

Arcana was built on the shoulders of these projects:

| Project | Inspiration |
|---------|------------|
| [skills.sh](https://skills.sh) | Marketplace UX patterns and community-driven skill discovery |
| [token-optimizer](https://github.com/alexgreensh/token-optimizer) | Token budget estimation, progressive disclosure, backup-first safety |
| [RTK](https://github.com/rtk-ai/rtk) | Tool output compression pipeline, 60-90% token reduction patterns |
| [CMV](https://github.com/CosmoNaught/claude-code-cmv) | Session snapshot/restore, context bloat analysis, trim strategies |
| [mem0](https://github.com/mem0ai/mem0) | Cross-session memory persistence, project-scoped recall |
| [Context7](https://github.com/upstash/context7) | MCP server for live version-specific documentation |
| [best-practices](https://github.com/shanraisshan/claude-code-best-practice) | Unified setup flow, Command/Agent/Skill pattern, session hygiene |
| [notebooklm-skill](https://github.com/PleasePrompto/notebooklm-skill) | NotebookLM browser automation via CDP |
| [notebooklm-py](https://github.com/teng-lin/notebooklm-py) | NotebookLM Python SDK patterns |

## Support

If these skills save you time, consider supporting the project.

- [GitHub Sponsors](https://github.com/sponsors/medy-gribkov)
- [Buy Me a Coffee](https://buymeacoffee.com/medygribkov)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Security

Report vulnerabilities via [SECURITY.md](SECURITY.md).

## Contact

Medy Gribkov - [medy@sporesec.com](mailto:medy@sporesec.com) - [SporeSec](https://sporesec.com) - [GitHub](https://github.com/medy-gribkov)

## License

[Apache 2.0](LICENSE) - See [NOTICE](NOTICE) for attribution requirements.
