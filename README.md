<p align="center">
  <img src="assets/banner.svg" alt="arcana" width="600"/>
</p>

<p align="center">
  <strong>The AI development toolkit.</strong><br/>
  73 production-ready skills for every coding agent.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@sporesec/arcana"><img src="https://img.shields.io/npm/v/@sporesec/arcana?style=for-the-badge&color=d4943a" alt="npm"/></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-d4943a?style=for-the-badge" alt="MIT"/></a>
  <a href="#skills"><img src="https://img.shields.io/badge/Skills-73-d4943a?style=for-the-badge" alt="Skills"/></a>
  <a href="#compatibility"><img src="https://img.shields.io/badge/Platforms-7-d4943a?style=for-the-badge" alt="Platforms"/></a>
</p>

---

## Demo

<p align="center">
  <img src="assets/arcana-promo.gif" alt="Arcana CLI demo" width="720"/>
</p>

<sub>Built with arcana's own <code>remotion-best-practices</code> skill.</sub>

## Why Arcana

Every skill includes code examples, BAD/GOOD pairs, and step-by-step workflows. No capability lists. No vague instructions. Patterns you can copy directly.

Validation scripts run as zero-cost automation. Security review checks auth code. Database design lints migrations. TypeScript scans for `any` usage. Executed at build time, never loaded as context.

`doctor` diagnoses issues. `clean` removes stale data. `stats` shows session analytics. `init` scaffolds config for 7 platforms. `validate` catches broken skills before they waste tokens.

Skills are markdown files. Any LLM can read them. Claude Code loads them natively. Other platforms get config scaffolding via `arcana init`.

## Quick Start

```bash
npm i -g @sporesec/arcana
arcana install --all
```

Or install specific skills:

```bash
arcana install golang-pro security-review typescript-advanced
```

Without global install:

```bash
npx @sporesec/arcana install --all
```

Skills install to `~/.agents/skills/`.

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
| `arcana init` | Scaffold config for Claude Code, Cursor, Codex, Gemini, Windsurf, Antigravity, Aider |
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
| Claude Code | `CLAUDE.md` | Native skill loading |
| Codex CLI | `AGENTS.md` | Config scaffold via `arcana init` |
| Cursor AI | `.cursor/rules/` | Config scaffold via `arcana init` |
| Gemini CLI | `GEMINI.md` | Config scaffold via `arcana init` |
| Windsurf | `.windsurfrules` | Config scaffold via `arcana init` |
| Antigravity | `AGENT.md` | Config scaffold via `arcana init` |
| Aider | `.aider.conf.yml` | Config scaffold via `arcana init` |

## Support

If these skills save you time, consider supporting the project.

- [GitHub Sponsors](https://github.com/sponsors/medy-gribkov)
- [Buy Me a Coffee](https://buymeacoffee.com/mahdygribkov)
- [Ko-fi](https://ko-fi.com/mahdygribkov)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Security

Report vulnerabilities via [SECURITY.md](SECURITY.md).

## Contact

Mahdy Gribkov - [medygribkov@gmail.com](mailto:medygribkov@gmail.com) - [mahdygribkov.vercel.app](https://mahdygribkov.vercel.app)

## License

[MIT](LICENSE)
