import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  readdirSync: vi.fn(),
  statSync: vi.fn(),
}));

vi.mock("./fs.js", () => ({
  getInstallDir: vi.fn(() => "/tmp/test-install"),
}));

describe("detectProjectContext", () => {
  let mockFs: typeof import("node:fs");
  let mockFsUtils: typeof import("./fs.js");

  beforeEach(async () => {
    vi.resetAllMocks();
    mockFs = await import("node:fs");
    mockFsUtils = await import("./fs.js");
    vi.mocked(mockFsUtils.getInstallDir).mockReturnValue("/tmp/test-install");
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("detects Go project from go.mod", async () => {
    vi.mocked(mockFs.existsSync).mockImplementation((p: any) => {
      const s = String(p);
      if (s.endsWith("go.mod")) return true;
      return false;
    });

    vi.mocked(mockFs.readFileSync).mockImplementation((p: any) => {
      const s = String(p);
      if (s.endsWith("go.mod")) {
        return [
          "module example.com/myapp",
          "",
          "go 1.23",
          "",
          "require (",
          "\tgithub.com/gin-gonic/gin v1.9.1",
          ")",
        ].join("\n");
      }
      throw new Error("ENOENT");
    });

    const { detectProjectContext } = await import("./project-context.js");
    const ctx = detectProjectContext("/projects/myapp");

    expect(ctx.type).toBe("Go");
    expect(ctx.lang).toBe("go");
    expect(ctx.name).toBe("myapp");
    expect(ctx.tags).toContain("go");
    expect(ctx.tags).toContain("gin");
    expect(ctx.tags).toContain("web");
  });

  it("detects Next.js project from package.json", async () => {
    vi.mocked(mockFs.existsSync).mockImplementation((p: any) => {
      const s = String(p);
      if (s.endsWith("package.json")) return true;
      return false;
    });

    vi.mocked(mockFs.readFileSync).mockImplementation((p: any) => {
      const s = String(p);
      if (s.endsWith("package.json")) {
        return JSON.stringify({
          name: "my-next-app",
          dependencies: { next: "15.0.0", react: "19.0.0" },
          devDependencies: {},
        });
      }
      throw new Error("ENOENT");
    });

    const { detectProjectContext } = await import("./project-context.js");
    const ctx = detectProjectContext("/projects/my-next-app");

    expect(ctx.type).toBe("Next.js");
    expect(ctx.lang).toBe("typescript");
    expect(ctx.tags).toContain("next");
    expect(ctx.tags).toContain("react");
  });

  it("detects Python project from requirements.txt", async () => {
    vi.mocked(mockFs.existsSync).mockImplementation((p: any) => {
      const s = String(p);
      if (s.endsWith("requirements.txt")) return true;
      return false;
    });

    vi.mocked(mockFs.readFileSync).mockImplementation((p: any) => {
      const s = String(p);
      if (s.endsWith("requirements.txt")) {
        return ["flask==3.0.0", "pytest>=7.0", "requests~=2.31"].join("\n");
      }
      throw new Error("ENOENT");
    });

    const { detectProjectContext } = await import("./project-context.js");
    const ctx = detectProjectContext("/projects/pyapp");

    expect(ctx.type).toBe("Python");
    expect(ctx.lang).toBe("python");
    expect(ctx.tags).toContain("python");
    expect(ctx.tags).toContain("flask");
    expect(ctx.tags).toContain("web");
    expect(ctx.tags).toContain("testing");
  });

  it("returns Unknown for empty directory", async () => {
    vi.mocked(mockFs.existsSync).mockReturnValue(false);
    vi.mocked(mockFs.readFileSync).mockImplementation(() => {
      throw new Error("ENOENT");
    });

    const { detectProjectContext } = await import("./project-context.js");
    const ctx = detectProjectContext("/projects/empty");

    expect(ctx.type).toBe("Unknown");
    expect(ctx.lang).toBe("general");
    expect(ctx.name).toBe("empty");
    expect(ctx.tags).toEqual([]);
    expect(ctx.preferences).toEqual([]);
    expect(ctx.claudeMdContent).toBeNull();
  });

  it("extracts tags from package.json dependencies", async () => {
    vi.mocked(mockFs.existsSync).mockImplementation((p: any) => {
      const s = String(p);
      if (s.endsWith("package.json")) return true;
      return false;
    });

    vi.mocked(mockFs.readFileSync).mockImplementation((p: any) => {
      const s = String(p);
      if (s.endsWith("package.json")) {
        return JSON.stringify({
          name: "frontend",
          dependencies: { react: "19.0.0", tailwindcss: "4.0.0" },
          devDependencies: { vitest: "2.0.0" },
        });
      }
      throw new Error("ENOENT");
    });

    const { detectProjectContext } = await import("./project-context.js");
    const ctx = detectProjectContext("/projects/frontend");

    expect(ctx.tags).toContain("react");
    expect(ctx.tags).toContain("tailwind");
    expect(ctx.tags).toContain("testing");
  });

  it("reads CLAUDE.md preferences", async () => {
    const claudeMd = [
      "# My Project",
      "",
      "## Coding Preferences",
      "- Use strict TypeScript",
      "- No any types allowed",
      "- Prefer async/await over callbacks",
      "",
      "## Other Section",
      "- Not a preference",
    ].join("\n");

    vi.mocked(mockFs.existsSync).mockImplementation((p: any) => {
      const s = String(p);
      if (s.endsWith("CLAUDE.md")) return true;
      return false;
    });

    vi.mocked(mockFs.readFileSync).mockImplementation((p: any) => {
      const s = String(p);
      if (s.endsWith("CLAUDE.md")) return claudeMd;
      throw new Error("ENOENT");
    });

    const { detectProjectContext } = await import("./project-context.js");
    const ctx = detectProjectContext("/projects/myproj");

    expect(ctx.preferences).toHaveLength(3);
    expect(ctx.preferences).toContain("Use strict TypeScript");
    expect(ctx.preferences).toContain("No any types allowed");
    expect(ctx.preferences).toContain("Prefer async/await over callbacks");
    expect(ctx.preferences).not.toContain("Not a preference");
    expect(ctx.claudeMdContent).toBe(claudeMd);
  });

  it("reads .claude/rules/*.md files", async () => {
    vi.mocked(mockFs.existsSync).mockImplementation((p: any) => {
      const s = String(p);
      if (s.includes(".claude") && s.includes("rules")) return true;
      return false;
    });

    vi.mocked(mockFs.readFileSync).mockImplementation(() => {
      throw new Error("ENOENT");
    });

    vi.mocked(mockFs.readdirSync).mockImplementation((p: any) => {
      const s = String(p);
      if (s.includes("rules")) return ["coding-style.md", "testing.md", "readme.txt"] as any;
      return [] as any;
    });

    const { detectProjectContext } = await import("./project-context.js");
    const ctx = detectProjectContext("/projects/myproj");

    expect(ctx.ruleFiles).toEqual(["coding-style.md", "testing.md"]);
    expect(ctx.ruleFiles).not.toContain("readme.txt");
  });

  it("detects infrastructure tags", async () => {
    vi.mocked(mockFs.existsSync).mockImplementation((p: any) => {
      const s = String(p);
      if (s.endsWith("Dockerfile")) return true;
      if (s.endsWith("workflows")) return true;
      return false;
    });

    vi.mocked(mockFs.readFileSync).mockImplementation(() => {
      throw new Error("ENOENT");
    });

    const { detectProjectContext } = await import("./project-context.js");
    const ctx = detectProjectContext("/projects/infra");

    expect(ctx.tags).toContain("docker");
    expect(ctx.tags).toContain("ci-cd");
    expect(ctx.tags).toContain("github-actions");
  });

  it("returns installed skills from getInstalledNames", async () => {
    vi.mocked(mockFs.existsSync).mockImplementation((p: any) => {
      const s = String(p);
      if (s === "/tmp/test-install") return true;
      return false;
    });

    vi.mocked(mockFs.readFileSync).mockImplementation(() => {
      throw new Error("ENOENT");
    });

    vi.mocked(mockFs.readdirSync).mockImplementation((p: any) => {
      const s = String(p);
      if (s === "/tmp/test-install") return ["review", "scaffold", "typescript"] as any;
      return [] as any;
    });

    vi.mocked(mockFs.statSync).mockImplementation(() => {
      return { isDirectory: () => true } as any;
    });

    const { detectProjectContext } = await import("./project-context.js");
    const ctx = detectProjectContext("/projects/myproj");

    expect(ctx.installedSkills).toEqual(["review", "scaffold", "typescript"]);
  });

  it("handles missing CLAUDE.md gracefully", async () => {
    vi.mocked(mockFs.existsSync).mockReturnValue(false);
    vi.mocked(mockFs.readFileSync).mockImplementation(() => {
      throw new Error("ENOENT");
    });

    const { detectProjectContext } = await import("./project-context.js");
    const ctx = detectProjectContext("/projects/noclaudemd");

    expect(ctx.claudeMdContent).toBeNull();
    expect(ctx.preferences).toEqual([]);
  });
});
