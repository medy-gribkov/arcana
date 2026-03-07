import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("indexCommand", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let testInstallDir: string;

  beforeEach(() => {
    vi.resetModules();
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    testInstallDir = mkdtempSync(join(tmpdir(), "arcana-index-test-"));
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    vi.resetModules();
  });

  function createSkill(name: string, frontmatter: string, body = "# Body\nContent here."): void {
    const skillDir = join(testInstallDir, name);
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, "SKILL.md"), `---\n${frontmatter}\n---\n${body}`, "utf-8");
  }

  function setupMocks(): void {
    vi.doMock("../utils/fs.js", () => ({
      getInstallDir: vi.fn(() => testInstallDir),
    }));
    vi.doMock("../utils/ui.js", () => ({
      ui: {
        bold: (s: string) => s,
        dim: (s: string) => s,
        success: (s: string) => s,
      },
      banner: vi.fn(),
    }));
    vi.doMock("../utils/atomic.js", () => ({
      atomicWriteSync: vi.fn((path: string, content: string) => {
        writeFileSync(path, content, "utf-8");
      }),
    }));
  }

  describe("regenerateIndex", () => {
    it("returns 0 when no skills are installed", async () => {
      setupMocks();
      const { regenerateIndex } = await import("./index.js");
      const count = regenerateIndex();
      expect(count).toBe(0);
    });

    it("indexes skills and returns count", async () => {
      createSkill("golang-pro", 'description: "Go development best practices"');
      createSkill("typescript", 'description: "TypeScript patterns and guidelines"');
      setupMocks();

      const { regenerateIndex } = await import("./index.js");
      const count = regenerateIndex();
      expect(count).toBe(2);
    });

    it("writes _index.md file", async () => {
      createSkill("test-skill", 'description: "A test skill"');
      setupMocks();

      const { regenerateIndex } = await import("./index.js");
      regenerateIndex();

      const indexPath = join(testInstallDir, "_index.md");
      const content = readFileSync(indexPath, "utf-8");
      expect(content).toContain("test-skill");
      expect(content).toContain("A test skill");
      expect(content).toContain("Installed Skills (1)");
    });

    it("skips _ prefixed entries", async () => {
      createSkill("real-skill", 'description: "A real skill"');
      // Create a _index.md file (should be skipped)
      mkdirSync(join(testInstallDir, "_loaded"), { recursive: true });
      setupMocks();

      const { regenerateIndex } = await import("./index.js");
      const count = regenerateIndex();
      expect(count).toBe(1);
    });

    it("extracts description from frontmatter", async () => {
      createSkill("my-skill", 'description: "My cool description"');
      setupMocks();

      const { regenerateIndex } = await import("./index.js");
      regenerateIndex();

      const indexPath = join(testInstallDir, "_index.md");
      const content = readFileSync(indexPath, "utf-8");
      expect(content).toContain("My cool description");
    });

    it("handles missing description in frontmatter", async () => {
      createSkill("no-desc", "name: no-desc");
      setupMocks();

      const { regenerateIndex } = await import("./index.js");
      regenerateIndex();

      const indexPath = join(testInstallDir, "_index.md");
      const content = readFileSync(indexPath, "utf-8");
      expect(content).toContain("no-desc");
      // Should have empty description column
      expect(content).toContain("| no-desc |  |");
    });

    it("handles SKILL.md without frontmatter", async () => {
      const skillDir = join(testInstallDir, "bare-skill");
      mkdirSync(skillDir, { recursive: true });
      writeFileSync(join(skillDir, "SKILL.md"), "# No frontmatter\nJust content.", "utf-8");
      setupMocks();

      const { regenerateIndex } = await import("./index.js");
      regenerateIndex();

      const indexPath = join(testInstallDir, "_index.md");
      const content = readFileSync(indexPath, "utf-8");
      expect(content).toContain("bare-skill");
    });

    it("truncates long descriptions at 120 chars", async () => {
      const longDesc = "A".repeat(150);
      createSkill("long-desc", `description: "${longDesc}"`);
      setupMocks();

      const { regenerateIndex } = await import("./index.js");
      regenerateIndex();

      const indexPath = join(testInstallDir, "_index.md");
      const content = readFileSync(indexPath, "utf-8");
      expect(content).toContain("...");
      // Should NOT contain the full 150-char description
      expect(content).not.toContain(longDesc);
    });

    it("sorts skills alphabetically", async () => {
      createSkill("zeta-skill", 'description: "Last"');
      createSkill("alpha-skill", 'description: "First"');
      createSkill("mid-skill", 'description: "Middle"');
      setupMocks();

      const { regenerateIndex } = await import("./index.js");
      regenerateIndex();

      const indexPath = join(testInstallDir, "_index.md");
      const content = readFileSync(indexPath, "utf-8");
      const alphaIdx = content.indexOf("alpha-skill");
      const midIdx = content.indexOf("mid-skill");
      const zetaIdx = content.indexOf("zeta-skill");
      expect(alphaIdx).toBeLessThan(midIdx);
      expect(midIdx).toBeLessThan(zetaIdx);
    });

    it("generates markdown table format", async () => {
      createSkill("test-skill", 'description: "Test description"');
      setupMocks();

      const { regenerateIndex } = await import("./index.js");
      regenerateIndex();

      const indexPath = join(testInstallDir, "_index.md");
      const content = readFileSync(indexPath, "utf-8");
      expect(content).toContain("| Skill | Description |");
      expect(content).toContain("|-------|-------------|");
      expect(content).toContain("arcana load <skill-name>");
    });
  });

  describe("indexCommand output", () => {
    it("shows JSON output with --json", async () => {
      createSkill("test-skill", 'description: "Test"');
      setupMocks();

      const { indexCommand } = await import("./index.js");
      await indexCommand({ json: true });

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(output).toHaveProperty("indexed", 1);
      expect(output).toHaveProperty("path");
      expect(output.path).toContain("_index.md");
    });

    it("shows human-readable output without --json", async () => {
      createSkill("test-skill", 'description: "Test"');
      setupMocks();

      const { indexCommand } = await import("./index.js");
      await indexCommand({ json: false });

      const output = consoleLogSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Indexed 1 skills");
      expect(output).toContain("arcana load");
    });

    it("shows empty message when no skills installed", async () => {
      setupMocks();

      const { indexCommand } = await import("./index.js");
      await indexCommand({ json: false });

      const output = consoleLogSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("No skills installed");
    });

    it("returns 0 indexed in JSON when empty", async () => {
      setupMocks();

      const { indexCommand } = await import("./index.js");
      await indexCommand({ json: true });

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(output.indexed).toBe(0);
    });

    it("strips quotes from description values", async () => {
      createSkill("quoted", "description: 'Single quoted description'");
      setupMocks();

      const { regenerateIndex } = await import("./index.js");
      regenerateIndex();

      const indexPath = join(testInstallDir, "_index.md");
      const content = readFileSync(indexPath, "utf-8");
      expect(content).toContain("Single quoted description");
      expect(content).not.toContain("'Single");
    });
  });
});
