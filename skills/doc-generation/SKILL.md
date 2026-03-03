---
name: doc-generation
description: Generate OpenAPI specs, GraphQL docs, architecture diagrams (Mermaid/C4), README scaffolding, and automate changelogs from code and commit history.
---

# Documentation Generation

## OpenAPI Documentation

Generate API specs from annotated code, validate with Spectral, and render interactive docs. Supports TypeScript (tsoa), Go (swaggo), and Python (FastAPI).

See references/openapi-generation.md for full code examples, linting configs, and BAD/GOOD patterns.

## GraphQL Documentation

Extract schemas via introspection, generate TypeScript types with graphql-codegen, and build static docs with SpectaQL.

See references/graphql-docs.md for codegen configs, type generation examples, and SpectaQL setup.

## Mermaid Architecture Diagrams

Sequence diagrams, flowcharts, and ER diagrams in Markdown. Renders natively on GitHub/GitLab.

See references/mermaid-c4-diagrams.md for diagram templates, C4 model definitions, and Structurizr DSL examples.

## C4 Model Diagrams

Define system context and container views using Structurizr DSL. Export to PlantUML or render with Structurizr Lite.

See references/mermaid-c4-diagrams.md for the full workspace.dsl example and rendering commands.

## README Generation

### Scaffold with Template

```bash
npx readme-md-generator
```

**Manual template:**

```markdown
# Project Name

[![CI](https://github.com/user/repo/actions/workflows/ci.yml/badge.svg)](https://github.com/user/repo/actions)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

> One-sentence description of what this project does.

## Quick Start

\```bash
git clone https://github.com/user/repo.git
cd repo
npm install
npm start
\```

## Configuration

Required environment variables:
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secret for signing tokens

## Architecture

See [architecture diagram](docs/architecture.svg) for system overview.

## License

MIT - see [LICENSE](LICENSE)
```

### Auto-Generate Command Reference

```bash
mycli --help > docs/commands.md
```

## Changelog Automation

Automate changelogs using Conventional Commits, standard-version, and Release Please.

See references/changelog-automation.md for commit format, generation commands, and GitHub Actions workflow.

## Quick Reference

**OpenAPI Generation:**
```
TypeScript: tsoa, @nestjs/swagger
Go:         swaggo/swag
Python:     FastAPI (automatic)
```

**GraphQL Tools:**
```
Schema extraction: get-graphql-schema
Type generation:   @graphql-codegen/cli
Documentation:     SpectaQL, graphql-markdown
```

**Diagram Tools:**
```
Mermaid:  GitHub/GitLab native, mermaid-cli for export
C4:       Structurizr DSL + structurizr/cli
PlantUML: plantuml/plantuml Docker image
```

**Changelog Tools:**
```
standard-version:  Node-based, manual trigger
release-please:    GitHub Action, automated
conventional-changelog: Low-level library
```

---

**Use this skill**: When API docs drift from code, diagrams are out of date, or you need to automate release notes.
