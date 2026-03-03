import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("exportCommand", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();

    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("exports manifest JSON for installed skills", async () => {
    vi.doMock("../utils/fs.js", () => ({
      getInstallDir: vi.fn(() => "/fake/skills"),
      readSkillMeta: vi.fn((name: string) => {
        if (name === "skill-a") return { version: "1.0.0", source: "arcana", description: "A skill" };
        if (name === "skill-b") return { version: "2.0.0", source: "custom", description: "B skill" };
        return null;
      }),
    }));
    vi.doMock("../utils/integrity.js", () => ({
      readLockfile: vi.fn(() => []),
    }));
    vi.doMock("node:fs", () => ({
      readdirSync: vi.fn(() => ["skill-a", "skill-b"]),
      statSync: vi.fn(() => ({ isDirectory: () => true })),
    }));

    const { exportCommand } = await import("./export-cmd.js");
    await exportCommand({});

    const output = consoleLogSpy.mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty("exportedAt");
    expect(parsed).toHaveProperty("skillCount", 2);
    expect(parsed.skills).toHaveLength(2);
    expect(parsed.skills[0].name).toBe("skill-a");
    expect(parsed.skills[0].version).toBe("1.0.0");
    expect(parsed.skills[1].name).toBe("skill-b");
    expect(parsed.skills[1].source).toBe("custom");
  });

  it("outputs empty message when no skills installed", async () => {
    vi.doMock("../utils/fs.js", () => ({
      getInstallDir: vi.fn(() => "/fake/skills"),
      readSkillMeta: vi.fn(() => null),
    }));
    vi.doMock("../utils/integrity.js", () => ({
      readLockfile: vi.fn(() => []),
    }));
    vi.doMock("node:fs", () => ({
      readdirSync: vi.fn(() => {
        throw new Error("ENOENT");
      }),
      statSync: vi.fn(),
    }));

    const { exportCommand } = await import("./export-cmd.js");
    await exportCommand({});

    const output = consoleLogSpy.mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty("skills");
    expect(parsed.skills).toHaveLength(0);
    expect(parsed).toHaveProperty("message", "No skills installed");
  });

  it("includes hash from lockfile when --sbom flag is set", async () => {
    vi.doMock("../utils/fs.js", () => ({
      getInstallDir: vi.fn(() => "/fake/skills"),
      readSkillMeta: vi.fn(() => ({
        version: "1.0.0",
        source: "arcana",
        description: "Test",
      })),
    }));
    vi.doMock("../utils/integrity.js", () => ({
      readLockfile: vi.fn(() => [
        {
          skill: "my-skill",
          version: "1.0.0",
          hash: "abc123def456",
          source: "arcana",
          installedAt: "2025-01-01T00:00:00Z",
        },
      ]),
    }));
    vi.doMock("node:fs", () => ({
      readdirSync: vi.fn(() => ["my-skill"]),
      statSync: vi.fn(() => ({ isDirectory: () => true })),
    }));

    const { exportCommand } = await import("./export-cmd.js");
    await exportCommand({ sbom: true });

    const output = consoleLogSpy.mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty("spdxVersion", "SPDX-2.3");
    expect(parsed).toHaveProperty("packages");
    expect(parsed.packages).toHaveLength(1);
    expect(parsed.packages[0].hash).toBe("abc123def456");
    expect(parsed.packages[0].name).toBe("my-skill");
  });

  it("defaults to JSON manifest format", async () => {
    vi.doMock("../utils/fs.js", () => ({
      getInstallDir: vi.fn(() => "/fake/skills"),
      readSkillMeta: vi.fn(() => ({
        version: "1.0.0",
        source: "arcana",
        description: "Test",
      })),
    }));
    vi.doMock("../utils/integrity.js", () => ({
      readLockfile: vi.fn(() => []),
    }));
    vi.doMock("node:fs", () => ({
      readdirSync: vi.fn(() => ["test-skill"]),
      statSync: vi.fn(() => ({ isDirectory: () => true })),
    }));

    const { exportCommand } = await import("./export-cmd.js");
    await exportCommand({ json: true });

    const output = consoleLogSpy.mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(output);
    // Default is manifest format with exportedAt, skillCount, skills
    expect(parsed).toHaveProperty("exportedAt");
    expect(parsed).toHaveProperty("skillCount", 1);
    expect(parsed).toHaveProperty("skills");
    expect(Array.isArray(parsed.skills)).toBe(true);
  });
});
