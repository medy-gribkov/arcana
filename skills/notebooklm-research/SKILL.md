---
name: notebooklm-research
description: "Automate Google NotebookLM via Playwright: create notebooks, add sources (URLs, PDFs, YouTube, text), query with citations, generate slides, infographics, quizzes, flashcards, reports, data tables, and mind maps"
user-invokable: true
argument-hint: "[command] [notebook] [--source url] [--query question]"
---

# NotebookLM Research Automation

Turn Claude Code into a research agent by automating Google NotebookLM. NotebookLM has no public API. This skill uses Playwright to control a real Chrome browser via CDP (Chrome DevTools Protocol). All commands output JSON to stdout.

## Prerequisites

One-time setup (2 minutes):

```bash
pip install playwright && playwright install chromium
python scripts/setup_chrome.py
# Log in to Google in the Chrome window that opens
python scripts/notebooklm_client.py status  # Verify: "authenticated": true
```

See `references/authentication.md` for detailed setup and troubleshooting.

## Session Management

**BAD:** Launching Chromium directly from Playwright. Gets detected as a bot, cannot authenticate with Google.

```python
browser = await playwright.chromium.launch()
page = await browser.new_page()
await page.goto("https://notebooklm.google.com")  # Blocked or login fails
```

**GOOD:** Connecting to a real Chrome instance via CDP with a persistent profile.

```python
browser = await playwright.chromium.connect_over_cdp("http://localhost:9222")
context = browser.contexts[0]  # Reuse authenticated session
page = context.pages[0]        # Already on NotebookLM
```

## Interaction Speed

**BAD:** Instant typing and clicks. Triggers anti-bot detection, actions may be ignored.

```python
await page.fill("textarea", "full text instantly")
await page.click("button")
```

**GOOD:** Human-like delays. Random 25-75ms per character, 100-300ms pre-click pause.

```python
for char in question:
    await element.type(char, delay=random.uniform(25, 75))
await asyncio.sleep(random.uniform(0.1, 0.3))
await page.click("button")
```

## Command Reference

Always verify connection first with `status`. All commands return JSON.

| Command | Example | Purpose |
|---------|---------|---------|
| `status` | `python scripts/notebooklm_client.py status` | Check Chrome + auth |
| `list` | `python scripts/notebooklm_client.py list` | List all notebooks |
| `create` | `python scripts/notebooklm_client.py create "Topic"` | Create notebook |
| `add-source` | `...add-source --notebook "Topic" --url "https://..."` | Add URL source |
| `add-source` | `...add-source --notebook "Topic" --file "/path/to.pdf"` | Add file source |
| `add-source` | `...add-source --notebook "Topic" --youtube "https://..."` | Add YouTube source |
| `add-source` | `...add-source --notebook "Topic" --text "raw content"` | Add text source |
| `query` | `...query --notebook "Topic" --question "Key findings?"` | Query with citations |
| `generate` | `...generate --notebook "Topic" --type slides` | Generate artifact |
| `generate` | `...generate --notebook "Topic" --type infographic --instructions "Focus on stats"` | Generate with instructions |

**Artifact types:** `slides`, `infographic`, `quiz`, `flashcards`, `report`, `table`, `mindmap`, `video`

## Research Workflow

Follow this sequence for reliable results:

1. **Check connection**: `status` command. If not connected, run `setup_chrome.py`.
2. **Create notebook**: `create "Research Topic Name"`
3. **Add sources**: Run `add-source` for each URL, file, YouTube link, or text block. Add 2-3+ sources for best results.
4. **Wait for processing**: Sources need 10-60 seconds to index. The script waits automatically, but for large PDFs allow extra time.
5. **Query sources**: `query --notebook "Topic" --question "Your question"`. Returns answer with citations.
6. **Generate deliverables**: `generate --notebook "Topic" --type slides`. Output saved to `./notebooklm-output/`.

## Output Format

Success:
```json
{"status": "success", "answer": "...", "citations": ["Source 1, p.3", "Source 2, sec.4"]}
```

Error:
```json
{"status": "error", "error": "Chrome not reachable", "suggestion": "Run: python setup_chrome.py"}
```

Generated files are saved to `./notebooklm-output/` (override with `NOTEBOOKLM_OUTPUT_DIR` env var).

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "Cannot connect to Chrome" | Run `python scripts/setup_chrome.py` |
| "Not authenticated" | Log in to Google in the Chrome window |
| Source upload hangs | Large file. Wait 2 minutes, then check NotebookLM UI |
| Generation fails | Retry once. If persistent, check NotebookLM UI for errors |
| Selectors not matching | NotebookLM UI may have changed. Update selectors in `notebooklm_client.py` |

See `references/deliverables.md` for artifact types, generation times, and examples.
See `references/authentication.md` for Chrome setup, session management, and security.
