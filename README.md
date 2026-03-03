# Arcana

Agent skills that work across AI coding tools. Drop them into your tools directory and they just work. No configuration. No dependencies. Plain markdown and Python scripts.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Skills](https://img.shields.io/badge/Skills-13-blue.svg)](#skills)
[![Platforms](https://img.shields.io/badge/Platforms-5+-green.svg)](#compatibility)

## What Is This

A collection of agent skills that follow the open [Agent Skills standard](https://docs.anthropic.com/en/docs/agents/skills). They are not tied to one tool. Install them on Claude Code, Codex CLI, Cursor, Gemini CLI, or any compatible agent. Each skill teaches your AI assistant how to handle a specific task or workflow.

## Skills

| Skill | Category | What It Does |
|-------|----------|--------------|
| [codebase-dissection](skills/codebase-dissection/) | Code Quality | Analyze any codebase: architecture, data flow, dead code, concurrency |
| [code-reviewer](skills/code-reviewer/) | Code Quality | Review local changes or remote PRs for correctness and security |
| [frontend-code-review](skills/frontend-code-review/) | Code Quality | Review frontend files with quality, performance, and logic checklists |
| [frontend-design](skills/frontend-design/) | Design | Create distinctive frontend interfaces, no generic AI aesthetics |
| [golang-pro](skills/golang-pro/) | Languages | Modern Go 1.21+ patterns, concurrency, performance, microservices |
| [typescript](skills/typescript/) | Languages | TypeScript strict style, type safety, code structure |
| [docx](skills/docx/) | Documents | Create, read, edit Word documents with formatting and tables |
| [xlsx](skills/xlsx/) | Documents | Create, read, edit spreadsheets (xlsx, csv, tsv) with formulas |
| [remotion-best-practices](skills/remotion-best-practices/) | Video | Remotion video creation: animations, audio, 3D, rendering |
| [skill-creator](skills/skill-creator/) | Meta | Create and update agent skills with proper structure |
| [skill-creation-guide](skills/skill-creation-guide/) | Meta | How to build effective skills from scratch |
| [find-skills](skills/find-skills/) | Meta | Discover and install skills from the ecosystem |
| [project-migration](skills/project-migration/) | Migration | Move project folders without losing session data |

## Quick Start

**Option 1: Install via Claude Code**
```bash
/install mahdy-gribkov/arcana
```

**Option 2: Install via npx**
```bash
npx @mahdy-gribkov/arcana install --all
```

**Option 3: Manual**
```bash
git clone https://github.com/mahdy-gribkov/arcana.git
cp -r arcana/skills/* ~/.agents/skills/
```

## Compatibility

These skills follow the open Agent Skills standard (December 2025).

| Platform | Status |
|----------|--------|
| Claude Code (Anthropic) | Fully supported |
| Codex CLI (OpenAI) | Compatible |
| Cursor AI | Compatible |
| Gemini CLI (Google) | Compatible |
| Antigravity (Google) | Compatible |

## Support This Project

I build and maintain these skills in my free time. If they save you time or teach you something useful, consider supporting the project.

- [GitHub Sponsors](https://github.com/sponsors/mahdy-gribkov)
- [Buy Me a Coffee](https://buymeacoffee.com/mahdygribkov)
- [Ko-fi](https://ko-fi.com/mahdygribkov)

Starring the repo also helps. It costs nothing and makes the project more visible.

## Contributing

Want to add a skill or improve an existing one? Check [CONTRIBUTING.md](CONTRIBUTING.md) for the process and quality checklist.

## Security

Found a vulnerability? See [SECURITY.md](SECURITY.md) for how to report it.

## Credits

Created by [Mahdy Gribkov](https://mahdygribkov.vercel.app). Software engineer building tools for developers.

- [Portfolio](https://mahdygribkov.vercel.app)
- [GitHub](https://github.com/mahdy-gribkov)
- [LinkedIn](https://linkedin.com/in/mahdy-gribkov)

## License

[MIT](LICENSE)
