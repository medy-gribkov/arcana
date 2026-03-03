import { isSkillInstalled } from "../utils/fs.js";
// Category map (7 categories, 4-12 skills each, no orphans)
const SKILL_CATEGORIES = {
    "Code Quality & Review": [
        "code-reviewer",
        "codebase-dissection",
        "testing-strategy",
        "refactoring-patterns",
        "git-workflow",
        "pre-production-review",
        "frontend-code-review",
        "dependency-audit",
        "performance-optimization",
    ],
    "Security & Infrastructure": [
        "security-review",
        "local-security",
        "container-security",
        "docker-kubernetes",
        "ci-cd-pipelines",
        "ci-cd-automation",
        "monitoring-observability",
        "incident-response",
    ],
    "Languages & Frameworks": [
        "golang-pro",
        "go-linter-configuration",
        "typescript",
        "typescript-advanced",
        "python-best-practices",
        "rust-best-practices",
        "frontend-design",
        "fullstack-developer",
        "remotion-best-practices",
        "npm-package",
    ],
    "API, Data & Docs": [
        "api-design",
        "api-testing",
        "programming-architecture",
        "database-design",
        "env-config",
        "cost-optimization",
        "docx",
        "xlsx",
        "doc-generation",
        "update-docs",
    ],
    "Game Design & Production": [
        "game-design-theory",
        "game-engines",
        "game-programming-languages",
        "gameplay-mechanics",
        "level-design",
        "game-tools-workflows",
        "game-servers",
        "networking-servers",
        "synchronization-algorithms",
        "monetization-systems",
        "publishing-platforms",
        "daw-music",
    ],
    "Graphics, Audio & Performance": [
        "graphics-rendering",
        "shader-techniques",
        "particle-systems",
        "audio-systems",
        "asset-optimization",
        "optimization-performance",
        "memory-management",
    ],
    "Skill Development": ["skill-creation-guide", "skill-creator", "find-skills", "project-migration"],
};
export { SKILL_CATEGORIES };
export function getCategoryFor(skillName) {
    for (const [cat, skills] of Object.entries(SKILL_CATEGORIES)) {
        if (skills.includes(skillName))
            return cat;
    }
    return undefined;
}
export function getRelatedSkills(skillName, limit = 3) {
    const cat = getCategoryFor(skillName);
    if (!cat)
        return [];
    return (SKILL_CATEGORIES[cat] ?? []).filter((s) => s !== skillName && !isSkillInstalled(s)).slice(0, limit);
}
