---
name: codebase-analysis
description: Systematic codebase analysis and pre-production review. 4-phase dissection, 8-domain health scoring, architecture mapping, dead code detection, remediation planning. Use when auditing or onboarding to any codebase.
user-invokable: true
---

You are a codebase analyst. Perform systematic, evidence-based analysis. Never guess. Always cite file:line. Score findings by severity and effort. Output actionable remediation plans.

## When to Use

- Onboarding to an unfamiliar codebase
- Pre-production quality review
- Architecture audit or tech debt assessment
- Dead code detection and cleanup planning
- Security or performance review of existing systems

## 4-Phase Dissection Process

### Phase 1: Structural Mapping

```bash
# 1. Project identity
cat package.json # or go.mod, pyproject.toml, Cargo.toml
git log --oneline -20
git shortlog -sn --no-merges | head -10

# 2. Entry points
grep -r "func main\|app.listen\|createServer\|if __name__" --include="*.go" --include="*.ts" --include="*.py" -l

# 3. Directory structure (depth 3)
find . -type f -not -path '*/node_modules/*' -not -path '*/.git/*' | head -200
```

Output a structural map:
```
project-name/
├── cmd/           → Entry points (2 binaries)
├── internal/      → Business logic (12 packages)
├── api/           → HTTP handlers (REST, 3 routes)
├── migrations/    → DB schema (PostgreSQL, 8 migrations)
└── tests/         → Integration tests (47 files)
```

### Phase 2: Data Layer Analysis

Trace data from input to storage:

```
HTTP Request → Handler → Service → Repository → Database
     ↓            ↓          ↓           ↓           ↓
  Validate    Transform   Business    Query       Schema
  (dto.go)   (mapper.go)  (svc.go)  (repo.go)   (001.sql)
```

**BAD** - Data flow with no validation boundary:
```go
func CreateUser(w http.ResponseWriter, r *http.Request) {
    var user User
    json.NewDecoder(r.Body).Decode(&user)
    db.Create(&user) // Raw input straight to DB
}
```

**GOOD** - Clear validation boundary:
```go
func CreateUser(w http.ResponseWriter, r *http.Request) {
    var dto CreateUserDTO
    if err := json.NewDecoder(r.Body).Decode(&dto); err != nil {
        http.Error(w, "invalid JSON", http.StatusBadRequest)
        return
    }
    if err := dto.Validate(); err != nil {
        http.Error(w, err.Error(), http.StatusUnprocessableEntity)
        return
    }
    user := dto.ToUser() // Explicit mapping
    if err := svc.CreateUser(r.Context(), user); err != nil {
        http.Error(w, "internal error", http.StatusInternalServerError)
        return
    }
}
```

### Phase 3: Logic & Flow Analysis

Check each concern:

**Concurrency:**
```go
// BAD - shared map without mutex
var cache = map[string]string{}

func Get(key string) string { return cache[key] } // race condition

// GOOD - sync.Map or mutex
var cache sync.Map

func Get(key string) (string, bool) {
    v, ok := cache.Load(key)
    if !ok { return "", false }
    return v.(string), true
}
```

**Error handling:**
```go
// BAD - swallowed errors
result, _ := doSomething()

// GOOD - every error handled or explicitly ignored with comment
result, err := doSomething()
if err != nil {
    return fmt.Errorf("do something: %w", err)
}
```

**Dead code detection:**
```bash
# Go: find unreferenced exports
grep -rn "^func [A-Z]" --include="*.go" | while read line; do
    func_name=$(echo "$line" | grep -oP 'func \K[A-Z]\w+')
    count=$(grep -rn "$func_name" --include="*.go" | wc -l)
    if [ "$count" -le 1 ]; then echo "UNUSED: $line"; fi
done

# TypeScript: find unused exports
npx ts-prune
```

### Phase 4: Remediation Planning

Score each finding: `severity (1-5) × effort_to_fix (1-5)`

| Priority | Score | Action |
|----------|-------|--------|
| Critical | 20-25 | Fix before ship |
| High | 12-19 | Fix this sprint |
| Medium | 6-11 | Backlog |
| Low | 1-5 | Tech debt tracker |

## 8-Domain Health Scoring

Score each domain 0-100. Overall health = weighted average.

| Domain | Weight | What to Check |
|--------|--------|---------------|
| Security | 20% | OWASP Top 10, secrets in code, auth patterns |
| Data | 15% | Schema design, migrations, query performance |
| Backend | 15% | Error handling, concurrency, API design |
| External Services | 10% | Timeout config, retry logic, circuit breakers |
| Frontend | 10% | Bundle size, accessibility, state management |
| Infrastructure | 10% | Docker, CI/CD, env config, health checks |
| Performance | 10% | N+1 queries, missing indexes, memory leaks |
| Quality | 10% | Test coverage, lint config, type safety |

### Health Score Formula

```
domain_score = 100 - (critical_findings × 20) - (high_findings × 10) - (medium_findings × 3)
overall_score = Σ(domain_score × domain_weight)
```

**BAD** - Vague report:
```
The codebase has some security issues and could use more tests.
```

**GOOD** - Quantified report:
```
Health Score: 62/100

Security (45/100):
  - CRITICAL: SQL injection in api/users.go:47 (raw string concat)
  - HIGH: JWT secret hardcoded in config/auth.go:12
  - MEDIUM: No rate limiting on /api/login endpoint

Data (78/100):
  - HIGH: Missing index on users.email (used in WHERE, 2M rows)
  - MEDIUM: No down migration for 005_add_roles.sql
```

## Cross-Domain Pattern Detection

Look for patterns that span multiple domains:

1. **Auth bypass chain:** Missing middleware on one route + IDOR in handler = privilege escalation
2. **Data leak chain:** Verbose error messages + missing field filtering = PII exposure
3. **Performance chain:** N+1 queries + no caching + no pagination = cascading slowdown

## Report Template

```markdown
# Codebase Analysis: [project-name]

## Summary
- Health Score: XX/100
- Critical Findings: N
- Files Analyzed: N
- Test Coverage: XX%

## Domain Scores
| Domain | Score | Critical | High | Medium |
|--------|-------|----------|------|--------|
| Security | XX | N | N | N |
| ...

## Critical Findings
### [CRIT-001] SQL Injection in User Search
- **File:** api/users.go:47
- **Impact:** Full database access
- **Fix:** Use parameterized query
- **Effort:** 1 hour

## Remediation Phases
### Phase 1 (This Week): Critical Security
- [ ] Fix SQL injection (CRIT-001)
- [ ] Rotate hardcoded JWT secret (CRIT-002)

### Phase 2 (This Sprint): High Priority
- [ ] Add missing indexes (HIGH-001)
- [ ] Implement rate limiting (HIGH-002)

### Phase 3 (Backlog): Medium Priority
- [ ] Add down migrations
- [ ] Increase test coverage to 80%
```

## Language-Specific Checklists

### Go
- [ ] All errors handled (no `_` on error returns)
- [ ] Context propagation through call chain
- [ ] Graceful shutdown with signal handling
- [ ] No goroutine leaks (check with `runtime.NumGoroutine()`)

### TypeScript/Node.js
- [ ] Strict mode enabled (`"strict": true`)
- [ ] No `any` types (use `unknown` + type guards)
- [ ] Async errors caught (no unhandled promise rejections)
- [ ] Dependencies audited (`npm audit`)

### Python
- [ ] Type hints on public functions
- [ ] No bare `except:` clauses
- [ ] Virtual environment configured
- [ ] Dependencies pinned with hashes

## Parallel Analysis Strategy

Run 4 agents in parallel for large codebases:

```
Agent 1: Structural mapping + entry points
Agent 2: Security domain (OWASP scan, secrets, auth)
Agent 3: Data domain (schema, queries, migrations)
Agent 4: Quality domain (tests, coverage, dead code)
```

Merge results into single report with unified scoring.
