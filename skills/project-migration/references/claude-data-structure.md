# Claude Code Data Structure

## Session Data Location

All Claude Code session data lives under `~/.claude/`:

```
~/.claude/
├── projects/                    # Per-project session data
│   ├── c--Users-User-Desktop-foo/
│   │   ├── <session-id>.jsonl   # Conversation transcripts
│   │   ├── memory/
│   │   │   └── MEMORY.md        # Project-specific memory
│   │   └── session-memory/
│   │       └── summary.md       # Session summaries
│   └── c--Users-User/           # Home directory sessions
├── history.jsonl                # Recent session history
├── settings.json                # Global settings
├── settings.local.json          # Machine-specific settings
├── commands/                    # Slash commands
├── skills/                      # Skill symlinks
├── plans/                       # Plan files
└── rules/                       # Path-scoped rules
```

## Path Encoding Algorithm

Claude encodes the absolute project path into a directory name:

### Rules
1. Drive letter is **lowercased**: `C:` → `c`
2. Colon (`:`) → dash (`-`)
3. Backslash (`\`) → dash (`-`)
4. Forward slash (`/`) → dash (`-`)
5. Space (` `) → dash (`-`)
6. Underscore (`_`) → dash (`-`)
7. Trailing slashes stripped

### Examples

| Original Path | Encoded Key |
|--------------|-------------|
| `C:\Users\User` | `c--Users-User` |
| `C:\Users\User\Desktop\ai-model` | `c--Users-User-Desktop-ai-model` |
| `C:\Users\User\Desktop\microGPT Brain` | `c--Users-User-Desktop-microGPT-Brain` |
| `C:\Users\User\Coding\Personal\Gaming_test` | `c--Users-User-Coding-Personal-Gaming-test` |

### Encoding is Lossy

The encoding is **not reversible** — multiple different paths can produce the same encoded key. A hyphen in the original name becomes indistinguishable from a path separator:

- `Desktop\ai-model` and `Desktop\ai\model` both encode to `Desktop-ai-model`

This means `decode_claude_path()` is a best-effort approximation, not an exact inverse. For migration, we always **encode** the source and destination paths, never rely on decoding.

## history.jsonl Format

Each line is a JSON object with session metadata:

```json
{
  "sessionId": "abc-123",
  "path": "C:\\Users\\User\\Desktop\\my-project",
  "timestamp": 1707400000000,
  "model": "claude-sonnet-4-5-20250929"
}
```

Note: Paths use `\\` escaped backslashes in the JSON. During migration, we find-and-replace the old path with the new path in this file.

## Migration Steps

1. Compute `old_key = encode_claude_path(source_path)`
2. Compute `new_key = encode_claude_path(dest_path)`
3. Find `~/.claude/projects/<old_key>/` (case-insensitive on Windows)
4. Rename directory to `<new_key>`
5. Move the actual project directory
6. Update `history.jsonl` — replace old path with new path
