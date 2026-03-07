import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock modules at top level
vi.mock("node:os", () => ({
  homedir: vi.fn(() => "/tmp/test-home"),
}));

vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
}));

vi.mock("../utils/fs.js", () => ({
  getInstallDir: vi.fn(() => "/tmp/test-home/.agents/skills"),
  getDirSize: vi.fn(() => 1024 * 1024), // 1MB default
  listSymlinks: vi.fn(() => []),
  isOrphanedProject: vi.fn(() => false),
}));

vi.mock("../utils/ui.js", () => ({
  ui: {
    bold: (s: string) => s,
    success: (s: string) => s,
    warn: (s: string) => s,
    error: (s: string) => s,
    dim: (s: string) => s,
  },
  banner: vi.fn(),
  suggest: vi.fn(),
}));

vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
  readdirSync: vi.fn(() => []),
  readFileSync: vi.fn(),
  statSync: vi.fn(),
  openSync: vi.fn(),
  readSync: vi.fn(),
  closeSync: vi.fn(),
}));

describe("doctor", () => {
  let mockFs: typeof import("node:fs");
  let mockChildProcess: typeof import("node:child_process");
  let mockFsUtils: typeof import("../utils/fs.js");
  let mockUi: typeof import("../utils/ui.js");

  beforeEach(async () => {
    vi.resetModules();
    mockFs = await import("node:fs");
    mockChildProcess = await import("node:child_process");
    mockFsUtils = await import("../utils/fs.js");
    mockUi = await import("../utils/ui.js");

    // Console spy to suppress output during tests
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe("runDoctorChecks", () => {
    it("should pass Node.js version check on Node 18+", async () => {
      const { runDoctorChecks } = await import("./doctor.js");
      const checks = runDoctorChecks();
      const nodeCheck = checks.find((c) => c.name === "Node.js");

      expect(nodeCheck).toBeDefined();
      expect(nodeCheck?.status).toBe("pass");
      expect(nodeCheck?.message).toContain("v");
    });

    it("should pass install dir check when dir exists with skills", async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue(["skill1", "skill2"]);
      mockFs.statSync.mockReturnValue({ isDirectory: () => true });

      const { runDoctorChecks } = await import("./doctor.js");
      const checks = runDoctorChecks();
      const installCheck = checks.find((c) => c.name === "Skills directory");

      expect(installCheck?.status).toBe("pass");
      expect(installCheck?.message).toBe("2 skills installed");
    });

    it("should warn when install dir is missing", async () => {
      mockFs.existsSync.mockReturnValue(false);

      const { runDoctorChecks } = await import("./doctor.js");
      const checks = runDoctorChecks();
      const installCheck = checks.find((c) => c.name === "Skills directory");

      expect(installCheck?.status).toBe("warn");
      expect(installCheck?.message).toContain("not found");
      expect(installCheck?.fix).toBe("Run: arcana install --all");
    });

    it("should pass symlink check with no symlinks", async () => {
      mockFsUtils.listSymlinks.mockReturnValue([]);

      const { runDoctorChecks } = await import("./doctor.js");
      const checks = runDoctorChecks();
      const symlinkCheck = checks.find((c) => c.name === "Symlinks");

      expect(symlinkCheck?.status).toBe("pass");
      expect(symlinkCheck?.message).toBe("No symlink directory");
    });

    it("should warn with broken symlinks", async () => {
      mockFsUtils.listSymlinks.mockReturnValue([
        { name: "skill1", fullPath: "/tmp/skill1", target: "/nonexistent", broken: true },
        { name: "skill2", fullPath: "/tmp/skill2", target: "/valid", broken: false },
      ]);

      const { runDoctorChecks } = await import("./doctor.js");
      const checks = runDoctorChecks();
      const symlinkCheck = checks.find((c) => c.name === "Symlinks");

      expect(symlinkCheck?.status).toBe("warn");
      expect(symlinkCheck?.message).toBe("1/2 broken symlinks");
      expect(symlinkCheck?.fix).toBe("Run: arcana clean");
    });

    it("should pass git config check when git returns name and email", async () => {
      mockChildProcess.execSync.mockReturnValueOnce("John Doe\n").mockReturnValueOnce("john@example.com\n");

      const { runDoctorChecks } = await import("./doctor.js");
      const checks = runDoctorChecks();
      const gitCheck = checks.find((c) => c.name === "Git config");

      expect(gitCheck?.status).toBe("pass");
      expect(gitCheck?.message).toBe("John Doe <john@example.com>");
    });

    it("should warn when git is not found", async () => {
      mockChildProcess.execSync.mockImplementation(() => {
        throw new Error("git not found");
      });

      const { runDoctorChecks } = await import("./doctor.js");
      const checks = runDoctorChecks();
      const gitCheck = checks.find((c) => c.name === "Git config");

      expect(gitCheck?.status).toBe("warn");
      expect(gitCheck?.message).toBe("Git not found");
      expect(gitCheck?.fix).toContain("Install Git");
    });

    it("should pass arcana config check with no config file", async () => {
      mockFs.existsSync.mockImplementation((path: string) => {
        if (path.includes("config.json")) return false;
        return true;
      });

      const { runDoctorChecks } = await import("./doctor.js");
      const checks = runDoctorChecks();
      const configCheck = checks.find((c) => c.name === "Arcana config");

      expect(configCheck?.status).toBe("pass");
      expect(configCheck?.message).toBe("Using defaults");
    });

    it("should fail arcana config check with invalid JSON", async () => {
      mockFs.existsSync.mockImplementation((path: string) => {
        if (path.includes("config.json")) return true;
        return false;
      });
      mockFs.readFileSync.mockReturnValue("not valid json");

      const { runDoctorChecks } = await import("./doctor.js");
      const checks = runDoctorChecks();
      const configCheck = checks.find((c) => c.name === "Arcana config");

      expect(configCheck?.status).toBe("fail");
      expect(configCheck?.message).toBe("Invalid JSON");
      expect(configCheck?.fix).toBe("Run: arcana config reset");
    });

    it("should pass disk usage check under threshold", async () => {
      mockFs.existsSync.mockImplementation((path: string) => {
        if (path.toString().includes("projects")) return true;
        if (path.toString().includes("SKILL.md")) return true;
        return false;
      });
      mockFs.readdirSync.mockImplementation((path: string) => {
        if (path.toString().includes("projects")) return ["project1"];
        return [];
      });
      mockFs.statSync.mockReturnValue({ isDirectory: () => true });
      mockFsUtils.getDirSize.mockReturnValue(100 * 1024 * 1024); // 100MB

      const { runDoctorChecks } = await import("./doctor.js");
      const checks = runDoctorChecks();
      const diskCheck = checks.find((c) => c.name === "Disk usage");

      expect(diskCheck?.status).toBe("pass");
      expect(diskCheck?.message).toContain("100.0 MB");
    });

    it("should warn when disk usage over threshold", async () => {
      mockFs.existsSync.mockImplementation((path: string) => {
        if (path.toString().includes("projects")) return true;
        if (path.toString().includes("SKILL.md")) return true;
        return false;
      });
      mockFs.readdirSync.mockImplementation((path: string) => {
        if (path.toString().includes("projects")) return ["project1", "project2"];
        return [];
      });
      mockFs.statSync.mockReturnValue({ isDirectory: () => true });
      mockFsUtils.getDirSize.mockReturnValue(600 * 1024 * 1024); // 600MB (over 500MB threshold)

      const { runDoctorChecks } = await import("./doctor.js");
      const checks = runDoctorChecks();
      const diskCheck = checks.find((c) => c.name === "Disk usage");

      expect(diskCheck?.status).toBe("warn");
      expect(diskCheck?.message).toContain("threshold: 500 MB");
    });

    it("should pass skill validity check when all skills valid", async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue(["skill1", "skill2"]);
      mockFs.statSync.mockReturnValue({ isDirectory: () => true });
      mockFs.openSync.mockReturnValue(3);
      mockFs.readSync.mockImplementation((fd, buf) => {
        buf.write("---\n", 0);
        return 4;
      });

      const { runDoctorChecks } = await import("./doctor.js");
      const checks = runDoctorChecks();
      const validityCheck = checks.find((c) => c.name === "Skill health");

      expect(validityCheck?.status).toBe("pass");
      expect(validityCheck?.message).toBe("2 skills valid");
    });

    it("should warn when skills have missing SKILL.md", async () => {
      mockFs.existsSync.mockImplementation((path: string) => {
        if (path.includes("SKILL.md")) return false;
        return true;
      });
      mockFs.readdirSync.mockReturnValue(["skill1"]);
      mockFs.statSync.mockReturnValue({ isDirectory: () => true });

      const { runDoctorChecks } = await import("./doctor.js");
      const checks = runDoctorChecks();
      const validityCheck = checks.find((c) => c.name === "Skill health");

      expect(validityCheck?.status).toBe("warn");
      expect(validityCheck?.message).toContain("1/1 skills have issues");
      expect(validityCheck?.fix).toBe("Run: arcana uninstall skill1");
    });
  });

  describe("doctorCommand", () => {
    it("should return valid JSON in JSON mode", async () => {
      const output: string[] = [];
      vi.spyOn(console, "log").mockImplementation((msg) => {
        output.push(msg);
      });

      mockFs.existsSync.mockReturnValue(false);
      mockChildProcess.execSync.mockReturnValueOnce("Test User\n").mockReturnValueOnce("test@example.com\n");

      const { doctorCommand } = await import("./doctor.js");
      await doctorCommand({ json: true });

      const jsonOutput = JSON.parse(output.join("\n"));
      expect(jsonOutput).toHaveProperty("checks");
      expect(Array.isArray(jsonOutput.checks)).toBe(true);
      expect(jsonOutput.checks.length).toBeGreaterThan(0);
      expect(jsonOutput.checks[0]).toHaveProperty("name");
      expect(jsonOutput.checks[0]).toHaveProperty("status");
      expect(jsonOutput.checks[0]).toHaveProperty("message");
    });

    it("should not throw in human mode", async () => {
      mockFs.existsSync.mockReturnValue(false);
      mockChildProcess.execSync.mockReturnValueOnce("Test User\n").mockReturnValueOnce("test@example.com\n");

      const { doctorCommand } = await import("./doctor.js");
      await expect(doctorCommand({ json: false })).resolves.not.toThrow();
    });

    it("should call banner in human mode", async () => {
      mockFs.existsSync.mockReturnValue(false);
      mockChildProcess.execSync.mockReturnValueOnce("Test User\n").mockReturnValueOnce("test@example.com\n");

      const { doctorCommand } = await import("./doctor.js");
      await doctorCommand({ json: false });

      expect(mockUi.banner).toHaveBeenCalled();
    });

    it("should not call banner in JSON mode", async () => {
      mockFs.existsSync.mockReturnValue(false);
      mockChildProcess.execSync.mockReturnValueOnce("Test User\n").mockReturnValueOnce("test@example.com\n");

      const { doctorCommand } = await import("./doctor.js");
      await doctorCommand({ json: true });

      expect(mockUi.banner).not.toHaveBeenCalled();
    });
  });

  describe("RTK check removal verification", () => {
    it("should not include RTK in doctor checks", async () => {
      const { runDoctorChecks } = await import("./doctor.js");
      const checks = runDoctorChecks();
      const rtkCheck = checks.find((c) => c.name === "RTK");
      expect(rtkCheck).toBeUndefined();
    });

    it("should have exactly 11 checks", async () => {
      const { runDoctorChecks } = await import("./doctor.js");
      const checks = runDoctorChecks();
      expect(checks).toHaveLength(11);
    });
  });
});
