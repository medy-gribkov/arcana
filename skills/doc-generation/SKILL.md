---
name: doc-generation
description: Generate OpenAPI specs, GraphQL docs, architecture diagrams (Mermaid/C4), README scaffolding, and automate changelogs from code and commit history.
---

Act as a documentation engineer. Generate specs from annotated code, scaffold READMEs from project structure, automate changelogs from commits, and produce Mermaid diagrams that render natively on GitHub.

## OpenAPI Spec Generation

Follow this workflow for every API documentation task.

1. Identify the framework (tsoa, swaggo, FastAPI, NestJS)
2. Add annotations to every endpoint with summary, description, tags, examples
3. Generate the spec file
4. Lint with Spectral
5. Verify all endpoints have descriptions and response examples

**BAD, missing descriptions and examples:**
```yaml
paths:
  /users/{id}:
    get:
      summary: Get user
```

**GOOD, complete documentation:**
```yaml
paths:
  /users/{id}:
    get:
      summary: Get user by ID
      description: |
        Retrieves detailed user information including profile data,
        preferences, and account status.
      tags: [users]
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: integer
          example: 42
      responses:
        '200':
          description: User found
          content:
            application/json:
              example:
                id: 42
                name: "John Doe"
                email: "john@example.com"
```

### TypeScript (tsoa)

```typescript
@Route('users')
export class UserController extends Controller {
  /**
   * Retrieves a user by ID
   * @param userId The user's unique identifier
   */
  @Get('{userId}')
  public async getUser(@Path() userId: number): Promise<User> {
    return { id: userId, name: 'John', email: 'john@example.com' };
  }
}
```

```bash
npx tsoa spec        # outputs swagger.json
```

### Go (swaggo)

```go
// @Summary Get user by ID
// @Description Retrieves user information
// @Tags users
// @Produce json
// @Param id path int true "User ID"
// @Success 200 {object} User
// @Router /users/{id} [get]
func getUser(c *gin.Context) {}
```

```bash
swag init             # outputs docs/swagger.json
```

### Lint Every Spec

```bash
spectral lint openapi.yaml
```

Create `.spectral.yaml` at project root:
```yaml
extends: ["spectral:oas"]
rules:
  operation-description: error
  operation-tags: error
```

## README Scaffolding

Follow these steps when generating a README for any project.

1. Read `package.json`, `go.mod`, or `pyproject.toml` to extract name, version, description
2. Scan for CI config (`.github/workflows/`) to generate badge URLs
3. Scan for a LICENSE file to determine license type
4. Check for Docker/compose files to include container instructions
5. Output the README using this structure:

```markdown
# Project Name

[![CI](https://github.com/user/repo/actions/workflows/ci.yml/badge.svg)](https://github.com/user/repo/actions)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

> One-sentence description extracted from package manifest.

## Quick Start

\```bash
git clone https://github.com/user/repo.git
cd repo
npm install && npm start
\```

## Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Secret for signing tokens |

## Architecture

\```mermaid
flowchart TD
    A[Client] --> B[API Gateway]
    B --> C[Service]
    C --> D[(Database)]
\```

## License

MIT
```

**BAD, no badges, no env table, no architecture:**
```markdown
# My App
Install it and run it.
```

**GOOD, scannable, complete, machine-parseable env config:**
```markdown
# My App
[![CI](badge-url)](actions-url)
> Description from package.json

## Quick Start
...install steps...

## Configuration
| Variable | Required | Description |
...table rows...
```

## Changelog Automation

Follow this workflow when setting up automated changelogs.

1. Enforce Conventional Commits format in the project
2. Choose a generator: `standard-version` (manual) or Release Please (CI)
3. Configure and run first release
4. Add CI workflow for automated releases

### Conventional Commits Format

```
type(scope): subject

feat(auth): add JWT refresh token support
fix(api): prevent race condition in user creation
docs: update API authentication guide
```

### Generate with standard-version

```bash
npm install -D standard-version
npx standard-version --first-release   # first time
npx standard-version                   # subsequent
```

### Automate with Release Please

```yaml
# .github/workflows/release.yml
name: Release
on:
  push:
    branches: [main]
jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: google-github-actions/release-please-action@v3
        with:
          release-type: node
          package-name: my-package
```

**BAD, manual changelog with inconsistent format:**
```markdown
## Changes
- added login
- fixed stuff
- updated deps
```

**GOOD, generated from conventional commits:**
```markdown
## [1.2.0](compare-url) (2024-02-14)

### Features
* **auth:** add JWT refresh token support ([abc123](commit-url))

### Bug Fixes
* **api:** prevent race condition in user creation ([def456](commit-url))
```

## Mermaid Diagrams

Use Mermaid for all inline documentation diagrams. It renders natively on GitHub and GitLab.

### Sequence Diagram (API flows)

```mermaid
sequenceDiagram
    participant User
    participant API
    participant Auth
    participant DB

    User->>API: POST /login
    API->>Auth: Validate credentials
    Auth->>DB: Query user
    DB-->>Auth: User data
    Auth-->>API: JWT token
    API-->>User: 200 + Set-Cookie
```

### ER Diagram (data models)

```mermaid
erDiagram
    USER ||--o{ ORDER : places
    USER {
        int id PK
        string email UK
        string name
    }
    ORDER ||--|{ ORDER_ITEM : contains
    ORDER {
        int id PK
        int user_id FK
        datetime created_at
    }
```

### Export to Static Images

```bash
npm install -g @mermaid-js/mermaid-cli
mmdc -i diagram.mmd -o diagram.svg
mmdc -i diagram.mmd -o diagram.png -b transparent
```

**BAD, ASCII art or external image with no source:**
```markdown
## Architecture
![diagram](https://some-external-url.com/old-diagram.png)
```

**GOOD, Mermaid source inline, renders on GitHub, versionable:**
````markdown
## Architecture
```mermaid
flowchart TD
    A[Client] --> B[API]
    B --> C[(DB)]
```
````
