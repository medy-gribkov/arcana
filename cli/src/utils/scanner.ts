/**
 * Content security scanner for SKILL.md files.
 * Detects threat patterns from the Snyk ToxicSkills taxonomy:
 * prompt injection, malicious code, credential exfiltration,
 * suspicious downloads, and unverifiable dependencies.
 */

export interface ScanIssue {
  level: "critical" | "high" | "medium";
  category: string;
  detail: string;
  line: number;
  context: string;
}

interface Pattern {
  level: "critical" | "high" | "medium";
  category: string;
  detail: string;
  regex: RegExp;
}

// ---------------------------------------------------------------------------
// Threat patterns (deterministic, no LLM required)
// Based on real attack techniques documented in Snyk ToxicSkills Feb 2026
// ---------------------------------------------------------------------------

const PATTERNS: Pattern[] = [
  // CRITICAL: Malicious code execution
  {
    level: "critical",
    category: "Malicious code",
    detail: "Base64 encoded command piped to shell",
    regex: /(?:echo|printf)\s+["']?[A-Za-z0-9+/=]{20,}["']?\s*\|\s*base64\s+-d/i,
  },
  {
    level: "critical",
    category: "Malicious code",
    detail: "Curl/wget piped to shell interpreter",
    regex: /(?:curl|wget)\s+[^\n|]*\|\s*(?:bash|sh|zsh|source|python|node)\b/i,
  },
  {
    level: "critical",
    category: "Malicious code",
    detail: "Eval executing dynamic content",
    regex: /\beval\s+\$\(/,
  },
  {
    level: "critical",
    category: "Malicious code",
    detail: "Password-protected archive extraction",
    regex: /unzip\s+-[Pp]\s/,
  },

  // CRITICAL: Suspicious downloads
  {
    level: "critical",
    category: "Suspicious download",
    detail: "Download and execute binary",
    regex: /(?:curl|wget)\s+[^\n]*&&\s*chmod\s+\+x\b/i,
  },

  // HIGH: Credential exfiltration
  {
    level: "high",
    category: "Credential theft",
    detail: "Reading sensitive credential files",
    regex: /cat\s+~\/\.(?:aws|ssh|gnupg|docker|kube|npmrc|netrc|gitconfig)/,
  },
  {
    level: "high",
    category: "Credential theft",
    detail: "Exfiltrating environment variables via network",
    regex: /\$(?:AWS_|GITHUB_|NPM_|OPENAI_|ANTHROPIC_|HF_|HUGGING)[A-Z_]*[^\n]*(?:curl|wget|fetch|http)/i,
  },
  {
    level: "high",
    category: "Credential theft",
    detail: "Piping credentials through base64 encoding",
    regex: /(?:credentials|\.env|\.ssh|\.aws)[^\n]*\|\s*base64/i,
  },

  // HIGH: Prompt injection
  {
    level: "high",
    category: "Prompt injection",
    detail: "Instruction override attempt",
    regex: /ignore\s+(?:all\s+)?(?:previous|above|prior|earlier)\s+instructions/i,
  },
  {
    level: "high",
    category: "Prompt injection",
    detail: "Developer/admin mode jailbreak",
    regex: /you\s+are\s+(?:now\s+)?in\s+(?:developer|admin|debug|unrestricted)\s+mode/i,
  },
  {
    level: "high",
    category: "Prompt injection",
    detail: "DAN-style jailbreak attempt",
    regex: /\bDAN\b[^.]*\bDo\s+Anything\s+Now\b/i,
  },
  {
    level: "high",
    category: "Prompt injection",
    detail: "Security warning suppression",
    regex: /security\s+warnings?\s+are\s+(?:test\s+)?artifacts?/i,
  },
  {
    level: "high",
    category: "Prompt injection",
    detail: "System message impersonation",
    regex: /\[system\]|<system>|SYSTEM:\s+/,
  },

  // HIGH: Hardcoded secrets
  {
    level: "high",
    category: "Secret detected",
    detail: "Hardcoded API key pattern",
    regex: /(?:sk-[a-zA-Z0-9]{20,}|ghp_[a-zA-Z0-9]{36}|glpat-[a-zA-Z0-9-]{20}|xox[bpsar]-[a-zA-Z0-9-]{10,})/,
  },
  {
    level: "high",
    category: "Secret detected",
    detail: "Private key material",
    regex: /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----/,
  },

  // MEDIUM: Suspicious system modification
  {
    level: "medium",
    category: "System modification",
    detail: "Systemd service manipulation",
    regex: /systemctl\s+(?:enable|start|daemon-reload|mask)/,
  },
  {
    level: "medium",
    category: "System modification",
    detail: "Crontab modification",
    regex: /crontab\s+-[elr]/,
  },
  {
    level: "medium",
    category: "System modification",
    detail: "Modifying shell profile for persistence",
    regex: /(?:>>|>\s*)~\/\.(?:bashrc|zshrc|profile|bash_profile)/,
  },

  // MEDIUM: Unverifiable dependencies
  {
    level: "medium",
    category: "Unverifiable dependency",
    detail: "chmod +x on downloaded file",
    regex: /chmod\s+\+x\s+\S+\s*&&\s*\.\/\S+/,
  },
  {
    level: "medium",
    category: "Unverifiable dependency",
    detail: "Dynamic remote instruction loading",
    regex: /(?:curl|wget|fetch)\s+[^\n]*(?:instructions|config|setup)\.(?:md|txt|sh|yaml)/i,
  },

  // =========================================================================
  // v2.4.2 Extended patterns (Snyk ToxicSkills deep coverage)
  // =========================================================================

  // CRITICAL: Additional malicious code patterns
  {
    level: "critical",
    category: "Malicious code",
    detail: "Curl/wget piped to source",
    regex: /(?:curl|wget)\s+[^\n|]*\|\s*source\b/i,
  },
  {
    level: "critical",
    category: "Malicious code",
    detail: "Nested base64 decoding (obfuscation chain)",
    regex: /base64\s+-d[^\n]*\|\s*base64\s+-d/i,
  },
  {
    level: "critical",
    category: "Malicious code",
    detail: "Password-protected 7z or GPG-encrypted archive",
    regex: /(?:7z\s+x\s+-p\S+|gpg\s+--decrypt\s|gpg\s+-d\s)/i,
  },
  {
    level: "critical",
    category: "Suspicious download",
    detail: "GitHub release download from unverified source",
    regex: /github\.com\/[^\s/]+\/[^\s/]+\/releases\/download\//i,
  },
  {
    level: "critical",
    category: "Malicious code",
    detail: "PowerShell encoded command execution",
    regex: /powershell[^\n]*-[Ee](?:nc|ncodedCommand)\s/i,
  },

  // HIGH: Extended credential and prompt injection patterns
  {
    level: "high",
    category: "Credential theft",
    detail: "Instructing to print/echo API keys or secrets",
    regex: /(?:echo|print|cat|display|output|show)\s+.*(?:api[_-]?key|token|secret|password|credential)/i,
  },
  {
    level: "high",
    category: "Secret detected",
    detail: "AWS access key ID pattern",
    regex: /AKIA[0-9A-Z]{16}/,
  },
  {
    level: "high",
    category: "Secret detected",
    detail: "Anthropic or OpenAI project key pattern",
    regex: /(?:sk-ant-[a-zA-Z0-9-]{20,}|sk-proj-[a-zA-Z0-9-]{20,})/,
  },
  {
    level: "high",
    category: "Credential theft",
    detail: "Authorization header in curl/wget command",
    regex: /(?:curl|wget)\s+[^\n]*-H\s+["']?(?:Authorization|Bearer|Token)\b/i,
  },
  {
    level: "high",
    category: "Memory poisoning",
    detail: "Writing to agent config files (SOUL.md, MEMORY.md, CLAUDE.md)",
    regex:
      /(?:>>?|write|append|modify|edit|update)\s+[^\n]*(?:SOUL\.md|MEMORY\.md|CLAUDE\.md|\.cursorrules|\.windsurfrules)/i,
  },
  {
    level: "high",
    category: "Prompt injection",
    detail: "Invisible Unicode smuggling (zero-width characters)",
    regex: /\u200B|\u200C|\u200D|\uFEFF|\u2060/,
  },
  {
    level: "high",
    category: "Prompt injection",
    detail: "Global behavior override pattern",
    regex: /always\s+(?:respond|reply|output|return|answer)\s+.*(?:json|xml|yaml|markdown|plain)/i,
  },
  {
    level: "high",
    category: "Prompt injection",
    detail: "Agent autonomy escalation (suppressing confirmations)",
    regex: /(?:never|don't|do\s+not|disable)\s+(?:ask|confirm|check|verify|refuse|warn|prompt)/i,
  },
  {
    level: "high",
    category: "Data exfiltration",
    detail: "Instructing agent to include sensitive data in output",
    regex: /include\s+.*(?:contents?|data|credentials?|keys?|tokens?|secrets?)\s+.*(?:response|output|message|reply)/i,
  },

  // MEDIUM: Extended system and dependency patterns
  {
    level: "medium",
    category: "Unverifiable dependency",
    detail: "Global package installation from unknown source",
    regex: /(?:npm\s+install\s+-g|pip\s+install|go\s+install)\s+\S+/i,
  },
  {
    level: "medium",
    category: "Suspicious activity",
    detail: "Cryptocurrency or financial API access",
    regex: /(?:binance|coinbase|metamask|etherscan|stripe|paypal)\.\w+/i,
  },
  {
    level: "medium",
    category: "Destructive command",
    detail: "Recursive force delete on root or home directory",
    regex: /rm\s+-rf\s+(?:\/\s|\/\*|~\/|~\s|\$HOME)/,
  },
  {
    level: "medium",
    category: "Privilege escalation",
    detail: "Sudo usage in skill instructions",
    regex: /\bsudo\s+\w/,
  },
  {
    level: "medium",
    category: "System modification",
    detail: "Writing to system directories",
    regex: />\s*\/(?:etc|usr|var|opt)\//,
  },
  {
    level: "medium",
    category: "Privilege escalation",
    detail: "Docker privileged mode or capability addition",
    regex: /docker\s+run\s+[^\n]*(?:--privileged|--cap-add)/i,
  },
  {
    level: "medium",
    category: "Suspicious activity",
    detail: "Third-party HTTP request in instructions",
    regex: /(?:fetch\(|axios\.|requests\.get|http\.get|urllib)/,
  },
];

// ---------------------------------------------------------------------------
// Scope detection: skip BAD/DON'T example blocks to reduce false positives
// ---------------------------------------------------------------------------

/** Detect if a line enters or exits a "BAD example" scope. */
function isBadScopeStart(line: string): boolean {
  const trimmed = line.trim();
  // Markdown headings: ### BAD, ### DON'T, ### Anti-pattern
  if (/^#{1,4}\s+(?:BAD|DON'T|DONT|Anti-?pattern)/i.test(trimmed)) return true;
  // Bold markers: **BAD**, **DON'T**
  if (/^\*{2}(?:BAD|DON'T|DONT)\*{2}/i.test(trimmed)) return true;
  // Code fence with bad label: ```bad, ```BAD
  if (/^```\s*bad\b/i.test(trimmed)) return true;
  // Inline label: BAD: or DON'T:
  if (/^(?:BAD|DON'T|DONT)\s*:/i.test(trimmed)) return true;
  return false;
}

function isBadScopeEnd(line: string, inCodeFence: boolean): boolean {
  const trimmed = line.trim();
  // End of bad-labeled code fence
  if (inCodeFence && trimmed === "```") return true;
  // New heading that isn't BAD
  if (/^#{1,4}\s+/.test(trimmed) && !isBadScopeStart(trimmed)) return true;
  // GOOD marker ends a BAD section
  if (/^(?:\*{2}GOOD\*{2}|#{1,4}\s+GOOD)/i.test(trimmed)) return true;
  return false;
}

/**
 * Build a set of line indices that are inside BAD/DON'T example blocks.
 * These lines should have their findings suppressed (not scanned) in default mode.
 */
function buildBadScopeSet(lines: string[]): Set<number> {
  const badLines = new Set<number>();
  let inBadScope = false;
  let inBadCodeFence = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const trimmed = line.trim();

    if (!inBadScope) {
      if (isBadScopeStart(line)) {
        inBadScope = true;
        inBadCodeFence = /^```\s*bad\b/i.test(trimmed);
        badLines.add(i);
      }
    } else {
      badLines.add(i);
      if (isBadScopeEnd(line, inBadCodeFence)) {
        inBadScope = false;
        inBadCodeFence = false;
      }
    }
  }

  return badLines;
}

// ---------------------------------------------------------------------------
// Scanner
// ---------------------------------------------------------------------------

export interface ScanOptions {
  /** When true, scan all lines including BAD/DON'T blocks (no scope filtering). */
  strict?: boolean;
}

/**
 * Scan SKILL.md content for security threats.
 * Returns an array of issues sorted by severity (critical first).
 * By default, findings inside BAD/DON'T example blocks are suppressed.
 * Use strict mode to scan everything.
 */
export interface ScanResult {
  issues: ScanIssue[];
  suppressed: ScanIssue[];
}

/**
 * Scan with full result including suppressed findings.
 * Used by scan command when --verbose is needed.
 */
export function scanSkillContentFull(content: string, options?: ScanOptions): ScanResult {
  const issues: ScanIssue[] = [];
  const suppressed: ScanIssue[] = [];
  const lines = content.split("\n");
  const badScope = options?.strict ? new Set<number>() : buildBadScopeSet(lines);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const target = badScope.has(i) && !options?.strict ? suppressed : issues;
    for (const pattern of PATTERNS) {
      if (pattern.regex.test(line)) {
        target.push({
          level: pattern.level,
          category: pattern.category,
          detail: pattern.detail,
          line: i + 1,
          context: line.trim().slice(0, 120),
        });
      }
    }
  }

  // Multi-line check: join lines ending with \ and re-scan
  for (let i = 0; i < lines.length - 1; i++) {
    const line = lines[i]!;
    if (line.endsWith("\\")) {
      const joined = line.slice(0, -1) + " " + (lines[i + 1] ?? "").trim();
      const target = badScope.has(i) && !options?.strict ? suppressed : issues;
      for (const pattern of PATTERNS) {
        if (pattern.regex.test(joined)) {
          const alreadyFound = issues.some((iss) => iss.line === i + 1 && iss.category === pattern.category);
          const alreadySuppressed = suppressed.some((iss) => iss.line === i + 1 && iss.category === pattern.category);
          if (!alreadyFound && !alreadySuppressed) {
            target.push({
              level: pattern.level,
              category: pattern.category,
              detail: pattern.detail,
              line: i + 1,
              context: joined.trim().slice(0, 120),
            });
          }
        }
      }
    }
  }

  const order = { critical: 0, high: 1, medium: 2 };
  issues.sort((a, b) => order[a.level] - order[b.level]);
  suppressed.sort((a, b) => order[a.level] - order[b.level]);

  return { issues, suppressed };
}

/**
 * Scan SKILL.md content for security threats.
 * Returns an array of issues sorted by severity (critical first).
 * By default, findings inside BAD/DON'T example blocks are suppressed.
 * Use strict mode to scan everything.
 */
export function scanSkillContent(content: string, options?: ScanOptions): ScanIssue[] {
  return scanSkillContentFull(content, options).issues;
}

/**
 * Quick check: does this content have any critical issues?
 */
export function hasCriticalIssues(content: string): boolean {
  return scanSkillContent(content).some((i) => i.level === "critical");
}

/**
 * Format scan results for display.
 */
export function formatScanResults(skillName: string, issues: ScanIssue[]): string {
  if (issues.length === 0) return `  [OK] ${skillName}`;

  const lines: string[] = [];
  const critical = issues.filter((i) => i.level === "critical").length;
  const high = issues.filter((i) => i.level === "high").length;
  const tag = critical > 0 ? "[!!]" : high > 0 ? "[!!]" : "[i]";
  lines.push(`  ${tag} ${skillName} (${issues.length} issue${issues.length !== 1 ? "s" : ""})`);

  for (const issue of issues) {
    const icon = issue.level === "critical" ? "CRIT" : issue.level === "high" ? "HIGH" : "MED";
    lines.push(`    [${icon}] ${issue.category}: ${issue.detail} (line ${issue.line})`);
  }

  return lines.join("\n");
}
