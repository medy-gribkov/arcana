/** Category keywords mapped to context types for category matching */
const TYPE_CATEGORY_MAP = {
    "Next.js": ["web", "react", "typescript", "node"],
    React: ["web", "react", "typescript"],
    "Node.js": ["node", "typescript", "web"],
    Go: ["go", "golang"],
    Rust: ["rust"],
    Python: ["python"],
};
export function scoreSkill(skill, context, installedSkills, allSkills) {
    const reasons = [];
    let score = 0;
    // Already installed -> skip
    if (installedSkills.includes(skill.name)) {
        return { skill: skill.name, verdict: "skip", score: 0, reasons: ["Already installed"] };
    }
    // Explicit conflict with installed skill
    if (skill.conflicts && skill.conflicts.length > 0) {
        const conflicting = skill.conflicts.filter((c) => installedSkills.includes(c));
        if (conflicting.length > 0) {
            return {
                skill: skill.name,
                verdict: "conflict",
                score: -100,
                reasons: [`Conflicts with installed: ${conflicting.join(", ")}`],
            };
        }
    }
    // Tag match (+20 per tag, max +60)
    if (skill.tags && skill.tags.length > 0) {
        const matchingTags = skill.tags.filter((t) => context.tags.includes(t));
        if (matchingTags.length > 0) {
            const tagScore = Math.min(matchingTags.length * 20, 60);
            score += tagScore;
            reasons.push(`Tags: ${matchingTags.join(", ")}`);
        }
    }
    // Category match based on project type (+10)
    const typeKeywords = TYPE_CATEGORY_MAP[context.type];
    if (typeKeywords && skill.tags) {
        const categoryMatch = skill.tags.some((t) => typeKeywords.includes(t));
        if (categoryMatch && !reasons.some((r) => r.startsWith("Tags:"))) {
            score += 10;
            reasons.push("Category match");
        }
    }
    // Companion boost (+15): if an installed skill lists this as companion
    const companionOf = allSkills.filter((s) => installedSkills.includes(s.name) && s.companions?.includes(skill.name));
    if (companionOf.length > 0) {
        score += 15;
        reasons.push(`Companion of: ${companionOf.map((s) => s.name).join(", ")}`);
    }
    // Rule overlap penalty (-30)
    const ruleBasenames = context.ruleFiles.map((f) => f.replace(/\.md$/, "").toLowerCase());
    if (ruleBasenames.includes(skill.name.toLowerCase())) {
        score -= 30;
        reasons.push(`Rule overlap: ${skill.name}.md exists in .claude/rules/`);
    }
    // Preference alignment (+10): check if skill description keywords match preferences
    if (context.preferences.length > 0 && skill.description) {
        const descLower = skill.description.toLowerCase();
        const prefMatch = context.preferences.some((pref) => {
            const words = pref.toLowerCase().split(/\s+/);
            return words.some((w) => w.length > 4 && descLower.includes(w));
        });
        if (prefMatch) {
            score += 10;
            reasons.push("Matches project preferences");
        }
    }
    // Determine verdict
    let verdict;
    if (score >= 40)
        verdict = "recommended";
    else if (score >= 15)
        verdict = "optional";
    else
        verdict = "skip";
    return { skill: skill.name, verdict, score, reasons };
}
export function rankSkills(skills, context) {
    const verdicts = skills.map((s) => scoreSkill(s, context, context.installedSkills, skills));
    return verdicts.sort((a, b) => b.score - a.score);
}
