---
name: codebase-dissection
version: "1.0.0"
description: |
  Systematic methodology for analyzing, understanding, and diagnosing problems in any codebase.
  Covers architecture mapping, data flow analysis, dead code detection, concurrency auditing,
  and actionable remediation planning.
---

# Codebase Dissection Skill

## Purpose

A repeatable, systematic methodology for taking any codebase apart to understand what works, what's broken, what's dead, and what to fix first. Built from real-world experience dissecting production Go, Python, Node.js, and mixed-language projects.

## The 4-Phase Dissection Process

### Phase 1: Structural Mapping (Run First, Always)

**Goal**: Build a complete mental model of the project before reading any business logic.

**Steps**:
1. **Project identity**: Read `go.mod`/`package.json`/`requirements.txt` for language, version, dependencies
2. **Entry points**: Find all `main()` functions, CLI commands, HTTP servers, worker processes
3. **Directory tree**: Map the full structure (skip vendor/node_modules/.git/binaries)
4. **Build system**: Read Makefile, Dockerfile, docker-compose, CI configs
5. **Config files**: Find all `.env`, `.yaml`, `.json` config files and how they're loaded
6. **Generated code**: Identify what's auto-generated (sqlc, protobuf, templ, swagger) vs hand-written
7. **Legacy remnants**: Find files from previous language/framework (Python in a Go project, etc.)

**Output**: A component inventory with file counts, line counts, and purpose of each directory.

**Parallel queries to run**:
- `glob **/*.go` (or language equivalent) to count source files
- `grep -r "func main" --include="*.go"` to find entry points
- `glob **/Dockerfile` + `glob **/docker-compose*` + `glob **/.github/**` for infra
- `glob **/*.sql` for database schemas
- `glob **/*_test.*` for test files

### Phase 2: Data Layer Analysis (The Source of Truth Question)

**Goal**: Answer "Where does data live, and is there ONE authoritative representation?"

**Steps**:
1. **Find ALL model/entity definitions**: Search for struct/class/type definitions of the core domain object (e.g., "Lead", "User", "Order")
2. **Count representations**: How many different structs represent the same concept? Are they intentional (layer separation) or accidental (copy-paste drift)?
3. **Database schema**: Read all migrations in order. Identify the authoritative schema file. Check for conflicts between migrations.
4. **ORM/query layer**: How are queries written? Raw SQL? ORM? Code generation?
5. **Data flow map**: Trace how data enters the system (API, scraper, import) through transformation to storage
6. **Conversion functions**: Find explicit conversions between representations. Are they complete? Do they lose fields?

**Red flags**:
- Multiple "source of truth" databases (PostgreSQL AND Notion AND Redis all storing leads)
- Model definitions that drift from the database schema
- Missing fields in conversion functions
- No audit trail for data changes

**Output**: A data flow diagram showing: Source -> Representation A -> Storage -> Representation B -> External System

### Phase 3: Logic & Flow Analysis (Where Does It Break?)

**Goal**: Trace the actual execution path and find bugs, dead code, and over-complications.

**Steps**:

#### 3a. Service Architecture
1. Map all service interfaces and their implementations
2. Draw the dependency graph (who depends on whom)
3. Check for circular dependencies
4. Identify the "God service" - the one that knows about everything

#### 3b. Concurrency Audit (Critical for Go/Rust/Java)
1. Find ALL goroutine/thread spawns (`go func`, `new Thread`, `spawn`)
2. For each: What happens if it panics? Is there recovery?
3. Check semaphore/mutex patterns: Can they deadlock?
4. Check channel usage: Can they block forever?
5. Look for `time.Sleep()` used as synchronization (always a smell)

**Concurrency checklist**:
- [ ] Every goroutine has panic recovery (defer + recover)
- [ ] Every semaphore/mutex has deferred release
- [ ] Every channel has a timeout or context cancellation
- [ ] No goroutine can leak (blocked forever on a channel nobody writes to)
- [ ] Worker pools have clean shutdown (WaitGroup + stop channel)

#### 3c. Error Handling Audit
1. Search for swallowed errors: `_ = someFunc()`, empty catch blocks, `//nolint:errcheck`
2. Check if errors propagate to the caller or die silently
3. Look for "return nil" at the end of functions that should return errors
4. Find batch operations that silently skip failures

#### 3d. Dead Code Detection
1. Search for TODO/FIXME/HACK comments
2. Find stub implementations that return errors ("not implemented")
3. Look for registered-but-nonfunctional features (UI exists, backend doesn't)
4. Check for imports that are unused or functions defined but never called

**Output**: A severity-ranked list of issues with file:line references.

### Phase 4: Remediation Planning (What To Fix, In What Order)

**Goal**: Produce a prioritized fix list that maximizes impact per effort.

**Scoring system**:

| Priority | Criteria | Examples |
|----------|----------|---------|
| P0 (NOW) | System can crash/hang/lose data | Deadlocks, silent data loss, unrecoverable errors |
| P1 (THIS WEEK) | Security or compliance risk | Exposed credentials, missing auth, GDPR violations |
| P2 (THIS SPRINT) | Performance bottleneck or reliability issue | Single-threaded bottleneck, missing timeouts, no retries |
| P3 (NEXT SPRINT) | Code quality or maintainability | Dead code, missing tests, hardcoded values |
| P4 (BACKLOG) | Nice to have | Better logging, documentation, refactoring |

**For each issue, document**:
1. **What**: One-line description
2. **Where**: File path and line number
3. **Why it matters**: Impact if not fixed
4. **Fix**: Concrete code change (show before/after if possible)
5. **Effort**: Time estimate (5 min / 15 min / 1 hour / 1 day)
6. **Risk**: What could go wrong with the fix

**Output**: A table sorted by priority with all fields filled in.

---

## Common Patterns & Anti-Patterns

### Architecture Smells
- **Spaghetti services**: One service calls 10 others with no clear direction
- **Hidden state**: Global variables, singletons, package-level init()
- **Config explosion**: 50+ environment variables with no documentation
- **Layer violation**: HTTP handler directly queries database
- **Premature abstraction**: Interface with one implementation, factory for one type

### Data Layer Smells
- **Multiple sources of truth**: Same data in Postgres, Redis, AND a third-party API
- **Schema drift**: Code expects columns that don't exist in migrations
- **Missing indexes**: Queries on status/created_at without indexes
- **No soft deletes**: Accidental DELETE is permanent
- **Magic strings**: Status values as strings instead of enums

### Concurrency Smells
- **Sleep as synchronization**: `time.Sleep(100ms)` instead of proper waiting
- **Mutex in a loop**: Lock/unlock per iteration instead of batching
- **Unbounded goroutines**: No limit on concurrent operations
- **Fire and forget**: `go doThing()` with no error handling
- **Channel as mutex**: Using channels where a simple mutex would suffice

### Error Handling Smells
- **Swallowed errors**: `_ = riskyFunction()`
- **Log and continue**: Error logged but not returned to caller
- **Panic instead of error**: Using panic for business logic failures
- **Generic errors**: `return fmt.Errorf("failed")` with no context
- **Retry without backoff**: Hammering a failed service immediately

---

## Dissection Report Template

When presenting findings, use this structure:

```markdown
# [Project Name] - Codebase Dissection Report

## Executive Summary
- [2-3 sentences: what the project is, overall health, top concern]

## Architecture Score: X/10
- [Why this score, key strengths and weaknesses]

## The Good
- [What's working well, what shouldn't be changed]

## Critical Issues (P0-P1)
| # | Issue | Location | Impact | Fix | Effort |
|---|-------|----------|--------|-----|--------|

## Performance & Reliability (P2)
| # | Issue | Location | Impact | Fix | Effort |
|---|-------|----------|--------|-----|--------|

## Code Quality (P3-P4)
| # | Issue | Location | Impact | Fix | Effort |
|---|-------|----------|--------|-----|--------|

## Recommended Fix Order
1. [First thing to fix and why]
2. [Second thing]
...

## Architecture Diagram
[ASCII or Mermaid diagram of actual system]
```

---

## Language-Specific Checklists

### Go Projects
- [ ] `go vet ./...` passes
- [ ] No data races (`go test -race ./...`)
- [ ] All goroutines have deferred panic recovery
- [ ] Context propagation is consistent
- [ ] Errors are wrapped with `fmt.Errorf("context: %w", err)`
- [ ] No `interface{}` where a concrete type would work
- [ ] Generated code is clearly marked (sqlc, protobuf, etc.)
- [ ] `go.sum` is committed and up to date

### Node.js/TypeScript Projects
- [ ] No `any` types in TypeScript
- [ ] All promises have error handling (no unhandled rejections)
- [ ] Dependencies are pinned (lock file committed)
- [ ] No `eval()` or `Function()` constructor usage
- [ ] Environment variables validated at startup
- [ ] No synchronous file I/O in request handlers

### Python Projects
- [ ] Type hints on all public functions
- [ ] No bare `except:` clauses
- [ ] Virtual environment is documented
- [ ] No `import *` usage
- [ ] Database connections are pooled, not created per request
- [ ] No secrets in source code

---

## Automation: Parallel Analysis Agents

When dissecting a codebase, launch these 4 agents simultaneously:

**Agent 1: Structure & Dependencies**
- Full directory tree
- Dependency analysis (go.mod/package.json)
- Entry points and build system
- Config files and environment variables

**Agent 2: Data Layer**
- All model/entity definitions
- Database schemas and migrations
- Query patterns and ORM usage
- Data flow tracing

**Agent 3: Business Logic & Concurrency**
- Service architecture and dependency graph
- Goroutine/thread analysis
- Error handling audit
- Dead code and TODO detection

**Agent 4: Config, Testing & Deployment**
- Configuration loading and validation
- Test coverage and quality
- CI/CD pipeline analysis
- Deployment infrastructure

This parallelization reduces total analysis time from 20+ minutes to ~5 minutes.
