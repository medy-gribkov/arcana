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
/**
 * Scan SKILL.md content for security threats.
 * Returns an array of issues sorted by severity (critical first).
 */
export declare function scanSkillContent(content: string): ScanIssue[];
/**
 * Quick check: does this content have any critical issues?
 */
export declare function hasCriticalIssues(content: string): boolean;
/**
 * Format scan results for display.
 */
export declare function formatScanResults(skillName: string, issues: ScanIssue[]): string;
