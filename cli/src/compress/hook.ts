import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { atomicWriteSync } from "../utils/atomic.js";

const HOOK_MARKER = "# arcana output compression hook";

function getShellRcPath(): string | null {
  const home = homedir();
  // Check for zsh first, then bash
  const zshrc = join(home, ".zshrc");
  if (existsSync(zshrc)) return zshrc;
  const bashrc = join(home, ".bashrc");
  if (existsSync(bashrc)) return bashrc;
  const profile = join(home, ".bash_profile");
  if (existsSync(profile)) return profile;
  return null;
}

function hookScript(): string {
  return `
${HOOK_MARKER}
if command -v arcana &>/dev/null; then
  _arcana_wrap() {
    local tool="$1"; shift
    command "$tool" "$@" 2>&1 | arcana compress --stdin --tool "$tool"
  }
  alias git='_arcana_wrap git'
  alias npm='_arcana_wrap npm'
  alias pnpm='_arcana_wrap pnpm'
  alias tsc='_arcana_wrap tsc'
fi
# end arcana hook`;
}

export function isHookInstalled(): boolean {
  const rcPath = getShellRcPath();
  if (!rcPath) return false;
  try {
    const content = readFileSync(rcPath, "utf-8");
    return content.includes(HOOK_MARKER);
  } catch {
    return false;
  }
}

export function installHook(): { installed: boolean; path: string | null; error?: string } {
  const rcPath = getShellRcPath();
  if (!rcPath) {
    return { installed: false, path: null, error: "No shell config found (~/.zshrc, ~/.bashrc, ~/.bash_profile)" };
  }

  if (isHookInstalled()) {
    return { installed: true, path: rcPath, error: "Hook already installed" };
  }

  try {
    const existing = readFileSync(rcPath, "utf-8");
    atomicWriteSync(rcPath, existing + "\n" + hookScript() + "\n");
    return { installed: true, path: rcPath };
  } catch (err) {
    return { installed: false, path: rcPath, error: err instanceof Error ? err.message : "Write failed" };
  }
}

export function removeHook(): { removed: boolean; path: string | null } {
  const rcPath = getShellRcPath();
  if (!rcPath) return { removed: false, path: null };

  try {
    const content = readFileSync(rcPath, "utf-8");
    if (!content.includes(HOOK_MARKER)) return { removed: false, path: rcPath };

    const cleaned = content.replace(new RegExp(`\\n?${HOOK_MARKER}[\\s\\S]*?# end arcana hook\\n?`), "\n");
    atomicWriteSync(rcPath, cleaned);
    return { removed: true, path: rcPath };
  } catch {
    return { removed: false, path: rcPath };
  }
}
