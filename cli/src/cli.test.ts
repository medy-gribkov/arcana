import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Command } from "commander";

// Mock node:module before importing cli
vi.mock("node:module", () => ({
  createRequire: () => (id: string) => {
    if (id.includes("package.json")) return { version: "1.0.0-test" };
    return {};
  },
}));

vi.mock("./utils/ui.js", () => ({
  ui: {
    error: (s: string) => s,
    dim: (s: string) => s,
  },
}));

// Import after mocks
const { createCli } = await import("./cli.js");

describe("createCli", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  it("returns a Command instance", () => {
    const program = createCli();
    expect(program).toBeInstanceOf(Command);
  });

  it("has correct name and version", () => {
    const program = createCli();
    expect(program.name()).toBe("arcana");
    expect(program.version()).toBe("1.0.0-test");
  });

  it("registers all expected subcommands", () => {
    const program = createCli();
    const commandNames = program.commands.map((cmd) => cmd.name());

    const expectedCommands = [
      "list",
      "install",
      "info",
      "search",
      "providers",
      "create",
      "validate",
      "update",
      "uninstall",
      "init",
      "doctor",
      "clean",
      "compact",
      "stats",
      "config",
      "audit",
      "scan",
      "optimize",
    ];

    for (const cmd of expectedCommands) {
      expect(commandNames).toContain(cmd);
    }
    expect(commandNames.length).toBeGreaterThanOrEqual(expectedCommands.length);
  });

  it("suggests similar commands for unknown command", async () => {
    const program = createCli();
    program.exitOverride();

    try {
      await program.parseAsync(["node", "arcana", "lis"]);
    } catch {
      // Expected - either process.exit mock or exitOverride throws
    }

    expect(processExitSpy).toHaveBeenCalledWith(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("unknown command"));
  });

  it("list command has expected options", () => {
    const program = createCli();
    const listCmd = program.commands.find((cmd) => cmd.name() === "list");

    expect(listCmd).toBeDefined();
    const optionFlags = listCmd!.options.map((opt) => opt.flags);

    expect(optionFlags).toContain("-p, --provider <name>");
    expect(optionFlags).toContain("-a, --all");
    expect(optionFlags).toContain("--installed");
    expect(optionFlags).toContain("--no-cache");
    expect(optionFlags).toContain("-j, --json");
  });

  it("install command has expected options", () => {
    const program = createCli();
    const installCmd = program.commands.find((cmd) => cmd.name() === "install");

    expect(installCmd).toBeDefined();
    const optionFlags = installCmd!.options.map((opt) => opt.flags);

    expect(optionFlags).toContain("-p, --provider <name>");
    expect(optionFlags).toContain("-a, --all");
    expect(optionFlags).toContain("-f, --force");
    expect(optionFlags).toContain("--dry-run");
    expect(optionFlags).toContain("-j, --json");
  });
});
