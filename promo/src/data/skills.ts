export interface SkillData {
  name: string;
  category: string;
}

export const SKILLS: SkillData[] = [
  { name: "golang-pro", category: "Languages" },
  { name: "typescript", category: "Languages" },
  { name: "rust-best-practices", category: "Languages" },
  { name: "python-best-practices", category: "Languages" },
  { name: "security-review", category: "Security" },
  { name: "local-security", category: "Security" },
  { name: "database-design", category: "Database" },
  { name: "docker-kubernetes", category: "DevOps" },
  { name: "ci-cd-pipelines", category: "DevOps" },
  { name: "monitoring-observability", category: "Monitoring" },
  { name: "code-reviewer", category: "Code Quality" },
  { name: "codebase-dissection", category: "Code Quality" },
  { name: "testing-strategy", category: "Testing" },
  { name: "frontend-design", category: "Design" },
  { name: "api-design", category: "API" },
  { name: "performance-optimization", category: "Performance" },
];

export const CATEGORY_COLORS: Record<string, string> = {
  Languages: "#d4943a",
  Security: "#ef4444",
  Database: "#4a7c9b",
  DevOps: "#4ade80",
  Monitoring: "#eab308",
  "Code Quality": "#a78bfa",
  Testing: "#f472b6",
  Design: "#fb923c",
  API: "#38bdf8",
  Performance: "#34d399",
};

export const PLATFORMS = [
  "Claude Code",
  "Cursor AI",
  "Codex CLI",
  "Gemini CLI",
  "Windsurf",
  "Antigravity",
  "Aider",
];
