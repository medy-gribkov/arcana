"""
NotebookLM Chrome Setup
Launches Chrome with remote debugging for Playwright CDP connection.
Run once, then log in to Google/NotebookLM manually.
"""

import json
import os
import platform
import subprocess
import sys
import time
from pathlib import Path
from urllib.request import urlopen
from urllib.error import URLError


DEFAULT_PORT = int(os.environ.get("NOTEBOOKLM_CHROME_PORT", "9222"))
DEFAULT_PROFILE = os.environ.get(
    "NOTEBOOKLM_PROFILE_DIR",
    os.path.join(Path.home(), ".notebooklm-chrome"),
)


def find_chrome() -> str | None:
    system = platform.system()
    candidates = []

    if system == "Windows":
        for base in [os.environ.get("PROGRAMFILES", ""), os.environ.get("PROGRAMFILES(X86)", "")]:
            if base:
                candidates.append(os.path.join(base, "Google", "Chrome", "Application", "chrome.exe"))
        localapp = os.environ.get("LOCALAPPDATA", "")
        if localapp:
            candidates.append(os.path.join(localapp, "Google", "Chrome", "Application", "chrome.exe"))
    elif system == "Darwin":
        candidates.append("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
    else:
        candidates.extend(["google-chrome", "google-chrome-stable", "chromium-browser", "chromium"])

    for path in candidates:
        if system == "Linux" or system == "Darwin":
            if os.path.isfile(path) or _which(path):
                return path
        else:
            if os.path.isfile(path):
                return path

    return None


def _which(name: str) -> str | None:
    try:
        result = subprocess.run(
            ["which", name], capture_output=True, text=True, timeout=5, check=False
        )
        return result.stdout.strip() if result.returncode == 0 else None
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return None


def check_connection(port: int) -> dict | None:
    try:
        resp = urlopen(f"http://localhost:{port}/json/version", timeout=3)
        return json.loads(resp.read().decode())
    except (URLError, OSError, json.JSONDecodeError):
        return None


def main():
    port = DEFAULT_PORT
    profile_dir = DEFAULT_PROFILE

    # Check if already running
    info = check_connection(port)
    if info:
        print(json.dumps({
            "status": "already_running",
            "browser": info.get("Browser", "unknown"),
            "port": port,
            "message": "Chrome is already running with remote debugging. Navigate to notebooklm.google.com and log in if needed.",
        }, indent=2))
        return

    chrome_path = find_chrome()
    if not chrome_path:
        print(json.dumps({
            "status": "error",
            "error": "Chrome not found",
            "suggestion": "Install Google Chrome or set NOTEBOOKLM_CHROME_PATH environment variable.",
        }, indent=2))
        sys.exit(1)

    os.makedirs(profile_dir, exist_ok=True)

    args = [
        chrome_path,
        f"--remote-debugging-port={port}",
        f"--user-data-dir={profile_dir}",
        "--disable-blink-features=AutomationControlled",
        "--no-first-run",
        "--no-default-browser-check",
        "https://notebooklm.google.com",
    ]

    print(f"Launching Chrome on port {port}...")
    print(f"Profile: {profile_dir}")
    print()

    subprocess.Popen(
        args,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    # Wait for Chrome to start
    for i in range(10):
        time.sleep(1)
        info = check_connection(port)
        if info:
            print(json.dumps({
                "status": "success",
                "browser": info.get("Browser", "unknown"),
                "port": port,
                "profile_dir": profile_dir,
                "message": "Chrome launched. Log in to your Google account at notebooklm.google.com, then use notebooklm_client.py.",
            }, indent=2))
            return

    print(json.dumps({
        "status": "error",
        "error": "Chrome started but CDP not reachable after 10s",
        "suggestion": f"Check if port {port} is already in use. Try: curl http://localhost:{port}/json/version",
    }, indent=2))
    sys.exit(1)


if __name__ == "__main__":
    main()
