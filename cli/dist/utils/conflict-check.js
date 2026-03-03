/** Known opposing preference pairs. If a skill promotes one, and CLAUDE.md has the other, warn. */
const OPPOSING_PAIRS = [
    ["callbacks", "async/await"],
    ["any", "strict typing"],
    ["abbreviations", "meaningful names"],
    ["classes", "functional"],
    ["oop", "functional programming"],
    ["semicolons", "no semicolons"],
    ["tabs", "spaces"],
];
export function checkConflicts(skillName, skillInfo, skillContent, context) {
    const warnings = [];
    // 1. Explicit skill-level conflicts from marketplace metadata
    if (skillInfo?.conflicts && skillInfo.conflicts.length > 0) {
        const installed = context.installedSkills;
        const conflicting = skillInfo.conflicts.filter((c) => installed.includes(c));
        for (const c of conflicting) {
            warnings.push({
                type: "skill-conflict",
                message: `"${skillName}" conflicts with installed skill "${c}".`,
                severity: "block",
            });
        }
    }
    // 2. Rule overlap: skill name matches existing .claude/rules/*.md filename
    const ruleBasenames = context.ruleFiles.map((f) => f.replace(/\.md$/, "").toLowerCase());
    if (ruleBasenames.includes(skillName.toLowerCase())) {
        warnings.push({
            type: "rule-overlap",
            message: `A rule file "${skillName}.md" already exists in .claude/rules/. This skill may duplicate existing instructions.`,
            severity: "warn",
        });
    }
    // Also check if skill tags overlap heavily with rule file names
    if (skillInfo?.tags) {
        for (const tag of skillInfo.tags) {
            if (ruleBasenames.includes(tag.toLowerCase()) && tag.toLowerCase() !== skillName.toLowerCase()) {
                warnings.push({
                    type: "rule-overlap",
                    message: `Skill tag "${tag}" matches existing rule "${tag}.md". May overlap.`,
                    severity: "warn",
                });
                break; // one warning is enough
            }
        }
    }
    // 3. Preference clash: check skill content against CLAUDE.md preferences
    if (skillContent && context.preferences.length > 0) {
        const contentLower = skillContent.toLowerCase();
        for (const [a, b] of OPPOSING_PAIRS) {
            const skillHasA = contentLower.includes(a);
            const skillHasB = contentLower.includes(b);
            const prefsHaveA = context.preferences.some((p) => p.toLowerCase().includes(a));
            const prefsHaveB = context.preferences.some((p) => p.toLowerCase().includes(b));
            if (skillHasA && prefsHaveB) {
                warnings.push({
                    type: "preference-clash",
                    message: `Skill mentions "${a}" but your project prefers "${b}".`,
                    severity: "warn",
                });
            }
            else if (skillHasB && prefsHaveA) {
                warnings.push({
                    type: "preference-clash",
                    message: `Skill mentions "${b}" but your project prefers "${a}".`,
                    severity: "warn",
                });
            }
        }
    }
    return warnings;
}
