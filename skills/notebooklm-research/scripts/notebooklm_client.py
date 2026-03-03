"""
NotebookLM Playwright Client
Automates Google NotebookLM via Chrome DevTools Protocol (CDP).
Requires Chrome running with --remote-debugging-port (see setup_chrome.py).

Usage:
    python notebooklm_client.py status
    python notebooklm_client.py list
    python notebooklm_client.py create "My Research"
    python notebooklm_client.py add-source --notebook "My Research" --url "https://example.com"
    python notebooklm_client.py add-source --notebook "My Research" --text "Raw text content"
    python notebooklm_client.py add-source --notebook "My Research" --file "/path/to/doc.pdf"
    python notebooklm_client.py add-source --notebook "My Research" --youtube "https://youtube.com/watch?v=..."
    python notebooklm_client.py query --notebook "My Research" --question "Summarize key findings"
    python notebooklm_client.py generate --notebook "My Research" --type slides
    python notebooklm_client.py generate --notebook "My Research" --type infographic --instructions "Focus on statistics"
"""

import argparse
import asyncio
import json
import os
import random
import sys
import time
from pathlib import Path

try:
    from playwright.async_api import async_playwright, Page, BrowserContext
except ImportError:
    print(json.dumps({
        "status": "error",
        "error": "playwright not installed",
        "suggestion": "Run: pip install playwright && playwright install chromium",
    }))
    sys.exit(1)


CHROME_PORT = int(os.environ.get("NOTEBOOKLM_CHROME_PORT", "9222"))
OUTPUT_DIR = os.environ.get("NOTEBOOKLM_OUTPUT_DIR", "./notebooklm-output")
BASE_URL = "https://notebooklm.google.com"

ARTIFACT_TYPES = [
    "video", "slides", "infographic", "quiz",
    "flashcards", "report", "table", "mindmap",
]

# Selectors (NotebookLM web UI, subject to change)
SEL = {
    "new_notebook": 'button:has-text("New notebook"), [aria-label="Create new notebook"]',
    "notebook_name_input": 'input[aria-label="Notebook name"], input[placeholder*="Untitled"]',
    "notebook_list": '[class*="notebook-card"], [data-notebook-id]',
    "notebook_title": '[class*="notebook-title"], [class*="card-title"]',
    "source_add_btn": 'button:has-text("Add source"), [aria-label="Add source"]',
    "source_url_option": 'text="Website", text="URL", [data-source-type="url"]',
    "source_text_option": 'text="Copied text", text="Text", [data-source-type="text"]',
    "source_file_option": 'text="Upload", text="PDF", text="File", [data-source-type="file"]',
    "source_youtube_option": 'text="YouTube", [data-source-type="youtube"]',
    "source_url_input": 'input[placeholder*="URL"], input[placeholder*="url"], input[type="url"]',
    "source_text_input": 'textarea[placeholder*="Paste"], textarea[aria-label*="text"]',
    "source_youtube_input": 'input[placeholder*="YouTube"], input[placeholder*="youtube"]',
    "source_submit": 'button:has-text("Insert"), button:has-text("Add"), button:has-text("Submit")',
    "source_processing": '[class*="processing"], [class*="loading"], [aria-busy="true"]',
    "chat_input": 'textarea[placeholder*="Ask"], input[placeholder*="Ask"], [contenteditable="true"]',
    "chat_submit": 'button[aria-label="Send"], button:has-text("Send")',
    "chat_response": '[class*="response"], [class*="answer"], [class*="message-content"]',
    "chat_citations": '[class*="citation"], [class*="source-ref"]',
    "studio_panel": 'button:has-text("Studio"), [aria-label="Studio"]',
    "generate_btn": 'button:has-text("Generate")',
}


# --- Anti-detection helpers ---

async def human_type(page: Page, selector: str, text: str):
    """Type with human-like random delays per character."""
    element = page.locator(selector).first
    await element.click()
    await asyncio.sleep(random.uniform(0.1, 0.3))
    for char in text:
        await element.type(char, delay=random.uniform(25, 75))
    await asyncio.sleep(random.uniform(0.2, 0.5))


async def human_click(page: Page, selector: str):
    """Click with a small random pre-delay."""
    await asyncio.sleep(random.uniform(0.1, 0.3))
    await page.locator(selector).first.click()
    await asyncio.sleep(random.uniform(0.3, 0.8))


async def idle_wait(min_s: float = 0.5, max_s: float = 2.0):
    """Random idle pause to appear human."""
    await asyncio.sleep(random.uniform(min_s, max_s))


# --- Connection ---

async def connect_browser() -> tuple[BrowserContext, Page]:
    """Connect to Chrome via CDP and navigate to NotebookLM."""
    pw = await async_playwright().start()
    try:
        browser = await pw.chromium.connect_over_cdp(f"http://localhost:{CHROME_PORT}")
    except Exception as exc:
        raise ConnectionError(
            f"Cannot connect to Chrome on port {CHROME_PORT}. "
            f"Run: python setup_chrome.py\nDetail: {exc}"
        ) from exc

    contexts = browser.contexts
    if not contexts:
        raise ConnectionError("No browser contexts found. Open Chrome and navigate to notebooklm.google.com.")

    context = contexts[0]
    pages = context.pages
    nlm_page = None

    for p in pages:
        if "notebooklm" in p.url.lower():
            nlm_page = p
            break

    if not nlm_page:
        nlm_page = pages[0] if pages else await context.new_page()
        await nlm_page.goto(BASE_URL, wait_until="domcontentloaded", timeout=30000)
        await nlm_page.wait_for_load_state("networkidle", timeout=15000)

    return context, nlm_page


# --- Status ---

async def cmd_status() -> dict:
    """Check Chrome connection and NotebookLM authentication status."""
    try:
        _, page = await connect_browser()
        url = page.url
        is_nlm = "notebooklm" in url.lower()
        is_auth = "accounts.google" not in url.lower()
        return {
            "status": "success",
            "connected": True,
            "url": url,
            "notebooklm_loaded": is_nlm,
            "authenticated": is_nlm and is_auth,
            "message": "Ready" if (is_nlm and is_auth) else "Navigate to notebooklm.google.com and log in.",
        }
    except ConnectionError as exc:
        return {"status": "error", "error": str(exc), "suggestion": "Run: python setup_chrome.py"}


# --- List notebooks ---

async def cmd_list() -> dict:
    """List all notebooks on the home page."""
    try:
        _, page = await connect_browser()

        # Ensure we're on the home page
        if "/notebook/" in page.url:
            await page.goto(BASE_URL, wait_until="domcontentloaded", timeout=15000)
            await page.wait_for_load_state("networkidle", timeout=10000)

        await idle_wait(1.0, 2.0)

        # Try multiple selector strategies
        notebooks = []
        cards = page.locator('[class*="notebook"], [data-notebook-id]')
        count = await cards.count()

        for i in range(count):
            card = cards.nth(i)
            title_el = card.locator('[class*="title"], h2, h3').first
            title = await title_el.text_content() if await title_el.count() > 0 else f"Notebook {i + 1}"
            notebooks.append({"index": i, "title": (title or "").strip()})

        return {"status": "success", "count": len(notebooks), "notebooks": notebooks}
    except ConnectionError as exc:
        return {"status": "error", "error": str(exc)}
    except Exception as exc:
        return {"status": "error", "error": f"Failed to list notebooks: {exc}"}


# --- Create notebook ---

async def cmd_create(name: str) -> dict:
    """Create a new notebook with the given name."""
    try:
        _, page = await connect_browser()

        # Go to home
        if "/notebook/" in page.url:
            await page.goto(BASE_URL, wait_until="domcontentloaded", timeout=15000)
            await page.wait_for_load_state("networkidle", timeout=10000)

        await idle_wait(1.0, 2.0)
        await human_click(page, SEL["new_notebook"])
        await idle_wait(1.5, 3.0)

        # Wait for the new notebook to open
        await page.wait_for_url("**/notebook/**", timeout=15000)
        await idle_wait(1.0, 2.0)

        # Try to rename the notebook
        title_input = page.locator(SEL["notebook_name_input"]).first
        if await title_input.count() > 0:
            await title_input.click()
            await title_input.fill("")
            await human_type(page, SEL["notebook_name_input"], name)
            await page.keyboard.press("Enter")
            await idle_wait(0.5, 1.0)

        return {
            "status": "success",
            "notebook": name,
            "url": page.url,
            "message": f"Notebook '{name}' created. Add sources next.",
        }
    except ConnectionError as exc:
        return {"status": "error", "error": str(exc)}
    except Exception as exc:
        return {"status": "error", "error": f"Failed to create notebook: {exc}"}


# --- Add source ---

async def cmd_add_source(notebook: str, url: str = None, text: str = None,
                         file_path: str = None, youtube: str = None) -> dict:
    """Add a source to the specified notebook."""
    try:
        _, page = await connect_browser()
        await _navigate_to_notebook(page, notebook)
        await idle_wait(1.0, 2.0)

        await human_click(page, SEL["source_add_btn"])
        await idle_wait(0.5, 1.5)

        if url:
            return await _add_url_source(page, url)
        elif text:
            return await _add_text_source(page, text)
        elif file_path:
            return await _add_file_source(page, file_path)
        elif youtube:
            return await _add_youtube_source(page, youtube)
        else:
            return {"status": "error", "error": "Provide --url, --text, --file, or --youtube"}

    except ConnectionError as exc:
        return {"status": "error", "error": str(exc)}
    except Exception as exc:
        return {"status": "error", "error": f"Failed to add source: {exc}"}


async def _add_url_source(page: Page, url: str) -> dict:
    await human_click(page, SEL["source_url_option"])
    await idle_wait(0.5, 1.0)
    await human_type(page, SEL["source_url_input"], url)
    await idle_wait(0.3, 0.8)
    await human_click(page, SEL["source_submit"])
    await _wait_for_processing(page)
    return {"status": "success", "source_type": "url", "source": url}


async def _add_text_source(page: Page, text: str) -> dict:
    await human_click(page, SEL["source_text_option"])
    await idle_wait(0.5, 1.0)
    textarea = page.locator(SEL["source_text_input"]).first
    await textarea.click()
    await textarea.fill(text)
    await idle_wait(0.3, 0.8)
    await human_click(page, SEL["source_submit"])
    await _wait_for_processing(page)
    return {"status": "success", "source_type": "text", "length": len(text)}


async def _add_file_source(page: Page, file_path: str) -> dict:
    if not os.path.isfile(file_path):
        return {"status": "error", "error": f"File not found: {file_path}"}

    await human_click(page, SEL["source_file_option"])
    await idle_wait(0.5, 1.0)

    # Handle file upload dialog
    file_input = page.locator('input[type="file"]').first
    await file_input.set_input_files(file_path)
    await idle_wait(0.5, 1.0)
    await _wait_for_processing(page)
    return {"status": "success", "source_type": "file", "file": file_path}


async def _add_youtube_source(page: Page, url: str) -> dict:
    await human_click(page, SEL["source_youtube_option"])
    await idle_wait(0.5, 1.0)
    await human_type(page, SEL["source_youtube_input"], url)
    await idle_wait(0.3, 0.8)
    await human_click(page, SEL["source_submit"])
    await _wait_for_processing(page)
    return {"status": "success", "source_type": "youtube", "source": url}


async def _wait_for_processing(page: Page, timeout: int = 120):
    """Wait for source processing to complete."""
    start = time.time()
    while time.time() - start < timeout:
        processing = page.locator(SEL["source_processing"])
        if await processing.count() == 0:
            return
        await asyncio.sleep(2)
    # Timeout is acceptable, source might still be processing in background


async def _navigate_to_notebook(page: Page, name: str):
    """Navigate to a specific notebook by name."""
    # If already on that notebook, stay
    title = await page.title()
    if name.lower() in title.lower():
        return

    # Go home first
    if "/notebook/" in page.url:
        await page.goto(BASE_URL, wait_until="domcontentloaded", timeout=15000)
        await page.wait_for_load_state("networkidle", timeout=10000)
        await idle_wait(1.0, 2.0)

    # Find and click the notebook card
    cards = page.locator('[class*="notebook"], [data-notebook-id]')
    count = await cards.count()
    for i in range(count):
        card = cards.nth(i)
        card_text = await card.text_content() or ""
        if name.lower() in card_text.lower():
            await card.click()
            await page.wait_for_url("**/notebook/**", timeout=15000)
            await page.wait_for_load_state("networkidle", timeout=10000)
            return

    raise ValueError(f"Notebook '{name}' not found. Use 'list' to see available notebooks.")


# --- Query ---

async def cmd_query(notebook: str, question: str) -> dict:
    """Query notebook sources and return answer with citations."""
    try:
        _, page = await connect_browser()
        await _navigate_to_notebook(page, notebook)
        await idle_wait(1.0, 2.0)

        # Type question in chat
        chat_input = page.locator(SEL["chat_input"]).first
        await chat_input.click()
        await asyncio.sleep(0.3)

        # Clear existing text
        await chat_input.fill("")
        for char in question:
            await chat_input.type(char, delay=random.uniform(25, 75))

        await idle_wait(0.3, 0.8)
        await human_click(page, SEL["chat_submit"])

        # Wait for response
        await _wait_for_response(page)

        # Extract response text
        responses = page.locator(SEL["chat_response"])
        response_count = await responses.count()
        answer = ""
        if response_count > 0:
            last_response = responses.nth(response_count - 1)
            answer = (await last_response.text_content() or "").strip()

        # Extract citations
        citations = []
        cite_elements = page.locator(SEL["chat_citations"])
        cite_count = await cite_elements.count()
        for i in range(cite_count):
            cite_text = await cite_elements.nth(i).text_content()
            if cite_text:
                citations.append(cite_text.strip())

        return {
            "status": "success",
            "question": question,
            "answer": answer,
            "citations": citations,
            "citation_count": len(citations),
        }
    except ConnectionError as exc:
        return {"status": "error", "error": str(exc)}
    except Exception as exc:
        return {"status": "error", "error": f"Query failed: {exc}"}


async def _wait_for_response(page: Page, timeout: int = 60):
    """Wait for the chat response to appear and finish streaming."""
    start = time.time()

    # Wait for at least one new response element
    while time.time() - start < timeout:
        responses = page.locator(SEL["chat_response"])
        if await responses.count() > 0:
            break
        await asyncio.sleep(1)

    # Wait for streaming to complete (check for loading indicators)
    await asyncio.sleep(2)
    for _ in range(30):
        loading = page.locator('[class*="loading"], [class*="streaming"], [class*="typing"]')
        if await loading.count() == 0:
            return
        await asyncio.sleep(1)


# --- Generate artifacts ---

async def cmd_generate(notebook: str, artifact_type: str, instructions: str = "") -> dict:
    """Generate an artifact from the notebook."""
    if artifact_type not in ARTIFACT_TYPES:
        return {
            "status": "error",
            "error": f"Unknown type '{artifact_type}'",
            "valid_types": ARTIFACT_TYPES,
        }

    try:
        _, page = await connect_browser()
        await _navigate_to_notebook(page, notebook)
        await idle_wait(1.0, 2.0)

        # Open Studio panel
        await human_click(page, SEL["studio_panel"])
        await idle_wait(1.0, 2.0)

        # Find the artifact type option
        type_labels = {
            "video": "Video Overview",
            "slides": "Slide Deck",
            "infographic": "Infographic",
            "quiz": "Quiz",
            "flashcards": "Flashcards",
            "report": "Briefing Doc",
            "table": "Data Table",
            "mindmap": "Mind Map",
        }

        label = type_labels.get(artifact_type, artifact_type)
        type_selector = f'text="{label}", [data-artifact-type="{artifact_type}"]'
        await human_click(page, type_selector)
        await idle_wait(0.5, 1.5)

        # Add custom instructions if provided
        if instructions:
            instructions_input = page.locator('textarea[placeholder*="instruction"], textarea[placeholder*="custom"]').first
            if await instructions_input.count() > 0:
                await instructions_input.click()
                await instructions_input.fill(instructions)
                await idle_wait(0.3, 0.8)

        # Click generate
        await human_click(page, SEL["generate_btn"])

        # Wait for generation (can take minutes)
        await _wait_for_generation(page, artifact_type)

        # Extract result
        result = await _extract_artifact(page, artifact_type)
        result["artifact_type"] = artifact_type
        result["notebook"] = notebook
        return result

    except ConnectionError as exc:
        return {"status": "error", "error": str(exc)}
    except Exception as exc:
        return {"status": "error", "error": f"Generation failed: {exc}"}


async def _wait_for_generation(page: Page, artifact_type: str, timeout: int = 300):
    """Wait for artifact generation to complete. Timeout varies by type."""
    timeouts = {
        "video": 300, "slides": 120, "infographic": 120,
        "quiz": 60, "flashcards": 60, "report": 120,
        "table": 60, "mindmap": 60,
    }
    max_wait = timeouts.get(artifact_type, timeout)
    start = time.time()

    while time.time() - start < max_wait:
        # Check for completion indicators
        done = page.locator('[class*="complete"], [class*="ready"], [class*="generated"]')
        if await done.count() > 0:
            return

        # Check for errors
        error = page.locator('[class*="error"], [class*="failed"]')
        if await error.count() > 0:
            error_text = await error.first.text_content()
            raise RuntimeError(f"Generation failed: {error_text}")

        await asyncio.sleep(3)


async def _extract_artifact(page: Page, artifact_type: str) -> dict:
    """Extract generated artifact content or download link."""
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # For text-based artifacts, extract content
    if artifact_type in ("quiz", "flashcards", "report", "table", "mindmap"):
        content_el = page.locator('[class*="artifact-content"], [class*="generated-content"]').first
        if await content_el.count() > 0:
            content = await content_el.text_content()
            filename = f"{artifact_type}_{int(time.time())}.txt"
            filepath = os.path.join(OUTPUT_DIR, filename)
            Path(filepath).write_text(content or "", encoding="utf-8")
            return {"status": "success", "content_preview": (content or "")[:500], "file": filepath}

    # For visual artifacts, look for download button
    download_btn = page.locator('button:has-text("Download"), [aria-label="Download"]').first
    if await download_btn.count() > 0:
        async with page.expect_download(timeout=30000) as download_info:
            await download_btn.click()
        download = await download_info.value
        filepath = os.path.join(OUTPUT_DIR, download.suggested_filename or f"{artifact_type}_{int(time.time())}")
        await download.save_as(filepath)
        return {"status": "success", "file": filepath}

    return {"status": "success", "message": "Artifact generated. Check NotebookLM UI for results."}


# --- CLI entry point ---

def main():
    parser = argparse.ArgumentParser(
        description="NotebookLM Playwright Client - automate NotebookLM via CDP",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    # status
    subparsers.add_parser("status", help="Check Chrome connection and auth")

    # list
    subparsers.add_parser("list", help="List all notebooks")

    # create
    create_p = subparsers.add_parser("create", help="Create a new notebook")
    create_p.add_argument("name", help="Notebook name")

    # add-source
    source_p = subparsers.add_parser("add-source", help="Add source to a notebook")
    source_p.add_argument("--notebook", required=True, help="Notebook name")
    source_grp = source_p.add_mutually_exclusive_group(required=True)
    source_grp.add_argument("--url", help="Web URL to add")
    source_grp.add_argument("--text", help="Raw text content")
    source_grp.add_argument("--file", dest="file_path", help="File path (PDF, DOCX, TXT)")
    source_grp.add_argument("--youtube", help="YouTube video URL")

    # query
    query_p = subparsers.add_parser("query", help="Query notebook sources")
    query_p.add_argument("--notebook", required=True, help="Notebook name")
    query_p.add_argument("--question", required=True, help="Question to ask")

    # generate
    gen_p = subparsers.add_parser("generate", help="Generate an artifact")
    gen_p.add_argument("--notebook", required=True, help="Notebook name")
    gen_p.add_argument("--type", required=True, choices=ARTIFACT_TYPES, help="Artifact type")
    gen_p.add_argument("--instructions", default="", help="Custom instructions for generation")

    args = parser.parse_args()

    try:
        if args.command == "status":
            result = asyncio.run(cmd_status())
        elif args.command == "list":
            result = asyncio.run(cmd_list())
        elif args.command == "create":
            result = asyncio.run(cmd_create(args.name))
        elif args.command == "add-source":
            result = asyncio.run(cmd_add_source(
                notebook=args.notebook,
                url=args.url if hasattr(args, "url") else None,
                text=args.text if hasattr(args, "text") else None,
                file_path=args.file_path if hasattr(args, "file_path") else None,
                youtube=args.youtube if hasattr(args, "youtube") else None,
            ))
        elif args.command == "query":
            result = asyncio.run(cmd_query(args.notebook, args.question))
        elif args.command == "generate":
            result = asyncio.run(cmd_generate(args.notebook, args.type, args.instructions))
        else:
            result = {"status": "error", "error": f"Unknown command: {args.command}"}

        print(json.dumps(result, indent=2, ensure_ascii=False))

    except KeyboardInterrupt:
        print(json.dumps({"status": "cancelled", "message": "Interrupted by user"}))
    except Exception as exc:
        print(json.dumps({"status": "error", "error": str(exc)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
