import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, basename } from "node:path";
import { getInstallDir } from "./fs.js";

export interface ProjectContext {
  /** Project name from directory or package.json */
  name: string;
  /** Detected primary type */
  type: string;
  /** Primary language */
  lang: string;
  /** All detected tech tags */
  tags: string[];
  /** Extracted preferences from CLAUDE.md */
  preferences: string[];
  /** Names of existing .claude/rules/*.md files */
  ruleFiles: string[];
  /** Raw content of CLAUDE.md if it exists */
  claudeMdContent: string | null;
  /** Names of currently installed skills */
  installedSkills: string[];
}

/** Map npm package names to tech tags */
const PACKAGE_TAG_MAP: Record<string, string[]> = {
  next: ["next", "react", "typescript"],
  react: ["react"],
  "react-dom": ["react"],
  vue: ["vue"],
  svelte: ["svelte"],
  angular: ["angular"],
  tailwindcss: ["tailwind"],
  prisma: ["prisma", "database"],
  "@prisma/client": ["prisma", "database"],
  "drizzle-orm": ["drizzle", "database"],
  express: ["express", "node"],
  fastify: ["fastify", "node"],
  hono: ["hono", "node"],
  vitest: ["testing"],
  jest: ["testing"],
  mocha: ["testing"],
  playwright: ["playwright", "testing"],
  cypress: ["cypress", "testing"],
  remotion: ["remotion", "react"],
  three: ["threejs"],
  docker: ["docker"],
  electron: ["electron"],
  "react-native": ["react-native", "react", "mobile"],
  expo: ["expo", "react-native", "mobile"],
  graphql: ["graphql"],
  "@apollo/client": ["graphql", "apollo"],
  trpc: ["trpc"],
  "@trpc/server": ["trpc"],
  mongoose: ["mongodb", "database"],
  pg: ["postgresql", "database"],
  redis: ["redis"],
  ioredis: ["redis"],
  "socket.io": ["websocket"],
  ws: ["websocket"],
  webpack: ["webpack"],
  vite: ["vite"],
  tsup: ["tsup"],
  eslint: ["linting"],
  prettier: ["formatting"],
  storybook: ["storybook"],
  "@storybook/react": ["storybook", "react"],
};

/** Map Go module paths to tags */
const GO_MODULE_TAG_MAP: Record<string, string[]> = {
  "github.com/gin-gonic/gin": ["gin", "web"],
  "github.com/gofiber/fiber": ["fiber", "web"],
  "github.com/labstack/echo": ["echo", "web"],
  "github.com/gorilla/mux": ["gorilla", "web"],
  "gorm.io/gorm": ["gorm", "database"],
  "github.com/jmoiron/sqlx": ["sqlx", "database"],
  "github.com/jackc/pgx": ["postgresql", "database"],
  "github.com/go-redis/redis": ["redis"],
  "github.com/rs/zerolog": ["zerolog", "logging"],
  "go.uber.org/zap": ["zap", "logging"],
  "github.com/stretchr/testify": ["testing"],
  "google.golang.org/grpc": ["grpc"],
  "google.golang.org/protobuf": ["protobuf"],
};

/** Map Python packages to tags */
const PYTHON_PACKAGE_TAG_MAP: Record<string, string[]> = {
  django: ["django", "web"],
  flask: ["flask", "web"],
  fastapi: ["fastapi", "web"],
  pytorch: ["pytorch", "ml"],
  torch: ["pytorch", "ml"],
  tensorflow: ["tensorflow", "ml"],
  numpy: ["numpy"],
  pandas: ["pandas"],
  sqlalchemy: ["sqlalchemy", "database"],
  pytest: ["testing"],
  celery: ["celery", "async"],
  scrapy: ["scrapy", "scraping"],
  playwright: ["playwright", "testing"],
  requests: ["requests"],
  httpx: ["httpx"],
};

function readJsonSafe<T>(filePath: string): T | null {
  try {
    return JSON.parse(readFileSync(filePath, "utf-8")) as T;
  } catch {
    return null;
  }
}

function readTextSafe(filePath: string): string | null {
  try {
    return readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}

function detectTypeAndLang(cwd: string): { type: string; lang: string; name: string } {
  const name = basename(cwd);
  if (existsSync(join(cwd, "go.mod"))) return { name, type: "Go", lang: "go" };
  if (existsSync(join(cwd, "Cargo.toml"))) return { name, type: "Rust", lang: "rust" };
  if (existsSync(join(cwd, "requirements.txt")) || existsSync(join(cwd, "pyproject.toml")))
    return { name, type: "Python", lang: "python" };
  if (existsSync(join(cwd, "package.json"))) {
    const pkg = readJsonSafe<Record<string, Record<string, string> | undefined>>(join(cwd, "package.json"));
    if (pkg?.dependencies?.next || pkg?.devDependencies?.next) return { name, type: "Next.js", lang: "typescript" };
    if (pkg?.dependencies?.react || pkg?.devDependencies?.react) return { name, type: "React", lang: "typescript" };
    return { name, type: "Node.js", lang: "typescript" };
  }
  return { name, type: "Unknown", lang: "general" };
}

function extractNpmTags(cwd: string): string[] {
  const pkgPath = join(cwd, "package.json");
  const pkg = readJsonSafe<Record<string, Record<string, string> | undefined>>(pkgPath);
  if (!pkg) return [];

  const tags = new Set<string>();
  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

  for (const dep of Object.keys(allDeps)) {
    const mapped = PACKAGE_TAG_MAP[dep];
    if (mapped) mapped.forEach((t) => tags.add(t));
  }

  // Check for TypeScript
  if (existsSync(join(cwd, "tsconfig.json")) || allDeps.typescript) {
    tags.add("typescript");
  }

  // Detect package manager
  if (existsSync(join(cwd, "pnpm-lock.yaml")) || existsSync(join(cwd, "pnpm-workspace.yaml"))) {
    tags.add("pnpm");
  }

  return [...tags];
}

function extractGoTags(cwd: string): string[] {
  const goModPath = join(cwd, "go.mod");
  const content = readTextSafe(goModPath);
  if (!content) return ["go"];

  const tags = new Set<string>(["go"]);

  for (const [modulePath, moduleTags] of Object.entries(GO_MODULE_TAG_MAP)) {
    if (content.includes(modulePath)) {
      moduleTags.forEach((t) => tags.add(t));
    }
  }

  return [...tags];
}

function extractPythonTags(cwd: string): string[] {
  const tags = new Set<string>(["python"]);

  // Read requirements.txt
  const reqContent = readTextSafe(join(cwd, "requirements.txt"));
  if (reqContent) {
    for (const line of reqContent.split("\n")) {
      const pkg = line
        .trim()
        .split(/[=<>!~[]/)[0]
        ?.toLowerCase();
      if (pkg) {
        const mapped = PYTHON_PACKAGE_TAG_MAP[pkg];
        if (mapped) mapped.forEach((t) => tags.add(t));
      }
    }
  }

  // Read pyproject.toml (simple scan, not full TOML parse)
  const pyprojectContent = readTextSafe(join(cwd, "pyproject.toml"));
  if (pyprojectContent) {
    for (const [pkgName, pkgTags] of Object.entries(PYTHON_PACKAGE_TAG_MAP)) {
      if (pyprojectContent.includes(`"${pkgName}"`) || pyprojectContent.includes(`'${pkgName}'`)) {
        pkgTags.forEach((t) => tags.add(t));
      }
    }
  }

  return [...tags];
}

function extractInfraTags(cwd: string): string[] {
  const tags: string[] = [];
  if (
    existsSync(join(cwd, "Dockerfile")) ||
    existsSync(join(cwd, "docker-compose.yml")) ||
    existsSync(join(cwd, "docker-compose.yaml"))
  ) {
    tags.push("docker");
  }
  if (existsSync(join(cwd, ".github", "workflows"))) {
    tags.push("ci-cd", "github-actions");
  }
  if (existsSync(join(cwd, ".gitlab-ci.yml"))) {
    tags.push("ci-cd", "gitlab-ci");
  }
  if (existsSync(join(cwd, "k8s")) || existsSync(join(cwd, "kubernetes"))) {
    tags.push("kubernetes");
  }
  if (existsSync(join(cwd, "terraform")) || existsSync(join(cwd, "main.tf"))) {
    tags.push("terraform");
  }
  return tags;
}

function extractPreferences(claudeMdContent: string): string[] {
  const prefs: string[] = [];
  const lines = claudeMdContent.split("\n");

  let inPrefsSection = false;
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.includes("## coding") || lower.includes("## preferences") || lower.includes("## style")) {
      inPrefsSection = true;
      continue;
    }
    if (inPrefsSection && line.startsWith("## ")) {
      inPrefsSection = false;
      continue;
    }
    if (inPrefsSection && line.trim().startsWith("-")) {
      prefs.push(line.trim().replace(/^-\s*/, ""));
    }
  }

  return prefs;
}

function readRuleFiles(cwd: string): string[] {
  const rulesDir = join(cwd, ".claude", "rules");
  if (!existsSync(rulesDir)) return [];

  try {
    return readdirSync(rulesDir)
      .filter((f) => f.endsWith(".md"))
      .sort();
  } catch {
    return [];
  }
}

function getInstalledSkillNames(): string[] {
  const dir = getInstallDir();
  if (!existsSync(dir)) return [];
  try {
    return readdirSync(dir)
      .filter((d) => {
        try {
          return statSync(join(dir, d)).isDirectory();
        } catch {
          return false;
        }
      })
      .sort();
  } catch {
    return [];
  }
}

export function detectProjectContext(cwd: string): ProjectContext {
  const { name, type, lang } = detectTypeAndLang(cwd);

  // Collect tags based on language
  const tagSet = new Set<string>();
  if (lang !== "general" && lang !== "unknown") tagSet.add(lang);

  if (lang === "typescript" || lang === "javascript") {
    extractNpmTags(cwd).forEach((t) => tagSet.add(t));
  }
  if (lang === "go" || type === "Go") {
    extractGoTags(cwd).forEach((t) => tagSet.add(t));
  }
  if (lang === "python" || type === "Python") {
    extractPythonTags(cwd).forEach((t) => tagSet.add(t));
  }
  extractInfraTags(cwd).forEach((t) => tagSet.add(t));

  // Read CLAUDE.md
  const claudeMdPath = join(cwd, "CLAUDE.md");
  const claudeMdContent = readTextSafe(claudeMdPath);
  const preferences = claudeMdContent ? extractPreferences(claudeMdContent) : [];

  // Read rule files
  const ruleFiles = readRuleFiles(cwd);

  // Get installed skills
  const installedSkills = getInstalledSkillNames();

  return {
    name,
    type,
    lang,
    tags: [...tagSet],
    preferences,
    ruleFiles,
    claudeMdContent,
    installedSkills,
  };
}
