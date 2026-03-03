# Windows Path Gotchas

Lessons learned from cross-platform project migration on Windows.

## Three Path Formats

Windows environments produce three different path formats:

| Context | Format | Example |
|---------|--------|---------|
| Windows native | Backslash | `C:\Users\User\Desktop` |
| Git Bash | Unix-style | `/c/Users/User/Desktop` |
| Forward slash | Mixed | `C:/Users/User/Desktop` |

All three must be handled. The `normalize_path()` function in `migrate.py` converts any format to the OS-native form.

## Git Bash Path Conversion

Git Bash uses `/c/` instead of `C:\`. To normalize:
1. Match pattern `/c/...` (single lowercase letter after first slash)
2. Convert to `C:\...` (uppercase drive letter + colon + backslash)
3. Replace remaining forward slashes with `os.sep`

```python
if path.startswith('/') and len(path) > 2 and path[2] == '/':
    drive = path[1].upper()
    path = f"{drive}:{os.sep}{path[3:]}"
```

## Symlinks

Symlinks created in Git Bash use the `/c/Users/...` format. When reading symlink targets on Windows, normalize before comparing paths.

## shutil.move vs Path.rename

- `Path.rename()` only works on the **same filesystem/drive**
- `shutil.move()` works across drives but is slower (copies then deletes)
- Strategy: try `Path.rename()` first, fall back to `shutil.move()`

## UTF-8 Console Encoding

Windows cmd/PowerShell default to `cp1252`, which cannot encode Unicode characters (emojis, arrows). Python scripts that print Unicode will crash with `UnicodeEncodeError`.

Fix: call `configure_utf8_console()` at script startup:
```python
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
sys.stderr.reconfigure(encoding='utf-8', errors='replace')
```

## Case Sensitivity

Windows NTFS is case-**insensitive** but case-**preserving**. When looking up Claude data directories:
- `c--Users-User-Desktop-test` and `C--Users-User-Desktop-test` match the same directory
- Always compare with `.lower()` or use `Path.exists()` which handles case-insensitivity

## JSON Path Escaping

In `history.jsonl`, Windows paths are stored with escaped backslashes: `C:\\Users\\User\\Desktop`. When doing find-and-replace:
- Escape both old and new paths for JSON: `path.replace("\\", "\\\\")`
- Or use `json.dumps()` which handles escaping automatically

## Trailing Slashes

Always strip trailing slashes/backslashes before encoding. A path with and without trailing slash should produce the same encoded key.
