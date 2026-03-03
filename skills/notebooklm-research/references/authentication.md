# NotebookLM Authentication Guide

## How It Works

NotebookLM requires Google account login. Since there is no public API, we automate the browser UI via Playwright connecting to a real Chrome instance over the Chrome DevTools Protocol (CDP). Chrome keeps the Google session in a persistent profile directory, so you only log in once.

## First-Time Setup

### 1. Install dependencies

```bash
pip install playwright
playwright install chromium
```

### 2. Launch Chrome with remote debugging

```bash
python scripts/setup_chrome.py
```

This runs Chrome with:
- `--remote-debugging-port=9222` (Playwright connects here)
- `--user-data-dir=~/.notebooklm-chrome` (session persists across restarts)
- `--disable-blink-features=AutomationControlled` (anti-detection)

### 3. Log in to Google

Chrome opens to `notebooklm.google.com`. Sign in with your Google account. Complete 2FA if prompted. Once you see the NotebookLM home page, you are ready.

### 4. Verify connection

```bash
python scripts/notebooklm_client.py status
```

Expected output:
```json
{"status": "success", "connected": true, "authenticated": true, "message": "Ready"}
```

## Chrome Paths by OS

| OS | Default Chrome Path |
|----|-------------------|
| Windows | `C:\Program Files\Google\Chrome\Application\chrome.exe` |
| macOS | `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` |
| Linux | `google-chrome` or `google-chrome-stable` (from PATH) |

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `NOTEBOOKLM_CHROME_PORT` | `9222` | CDP debugging port |
| `NOTEBOOKLM_PROFILE_DIR` | `~/.notebooklm-chrome` | Chrome profile directory |
| `NOTEBOOKLM_OUTPUT_DIR` | `./notebooklm-output` | Generated artifact output |

## Session Lifecycle

1. **Fresh start**: Run `setup_chrome.py`, log in manually. Session saved to profile dir.
2. **Subsequent runs**: Chrome remembers session. Just run `setup_chrome.py` (detects if already running).
3. **Session expired**: Google sessions last weeks. If expired, Chrome shows login page. Log in again.
4. **Verification**: `notebooklm_client.py status` checks if authenticated.

## Troubleshooting

### "Cannot connect to Chrome on port 9222"
Chrome is not running with debugging. Run `python scripts/setup_chrome.py`.

### "No browser contexts found"
Chrome is running but no tabs are open. Open a new tab to `notebooklm.google.com`.

### "accounts.google.com in URL"
Session expired. Log in to Google manually in the Chrome window, then retry.

### Port already in use
Another process uses port 9222. Kill it or set `NOTEBOOKLM_CHROME_PORT=9223`.

### 2FA every time
This happens when Chrome profile is not persisted. Ensure `--user-data-dir` points to a stable directory (not `/tmp`).

### Playwright bug #36139 (cookie auth)
Some Playwright versions fail to send session cookies for Google domains. Workaround: use `channel="chrome"` (real Chrome) instead of Chromium, and connect via CDP rather than launching directly.

## Security Notes

- The Chrome profile stores your Google session tokens. Treat `~/.notebooklm-chrome` like a credential directory.
- Never share or commit the profile directory.
- The client script only automates browser actions visible in the UI. It does not access hidden APIs or extract tokens.
