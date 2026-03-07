import { describe, it, expect } from "vitest";
import { buildCustomHelp, renderBanner } from "./help.js";

describe("renderBanner", () => {
  it("contains ARCANA block characters", () => {
    const banner = renderBanner();
    expect(banner).toContain("█████");
    expect(banner).toContain("╔══");
  });

  it("has 6 lines", () => {
    const banner = renderBanner();
    // Strip ANSI codes then count non-empty lines
    const stripped = banner.replace(/\x1b\[[0-9;]*m/g, "");
    const lines = stripped.split("\n").filter((l) => l.trim().length > 0);
    expect(lines.length).toBe(6);
  });
});

describe("buildCustomHelp", () => {
  it("contains all section headers", () => {
    const help = buildCustomHelp("2.1.1");
    expect(help).toContain("GETTING STARTED");
    expect(help).toContain("SKILLS");
    expect(help).toContain("CONTEXT INTELLIGENCE");
    expect(help).toContain("SECURITY");
    expect(help).toContain("CONFIGURATION");
    expect(help).toContain("EXAMPLES");
    expect(help).toContain("LEARN MORE");
  });

  it("contains USAGE section", () => {
    const help = buildCustomHelp("2.1.1");
    expect(help).toContain("USAGE");
    expect(help).toContain("arcana <command> [options]");
  });

  it("contains tagline", () => {
    const help = buildCustomHelp("2.1.1");
    expect(help).toContain("Context intelligence for AI coding agents");
  });

  it("contains core commands", () => {
    const help = buildCustomHelp("1.0.0");
    const commands = [
      "init",
      "doctor",
      "list",
      "search",
      "install",
      "update",
      "uninstall",
      "recommend",
      "curate",
      "compress",
      "remember",
      "recall",
      "snapshot",
      "trim",
      "mcp",
      "scan",
      "verify",
      "lock",
      "config",
      "providers",
      "clean",
      "stats",
    ];
    for (const cmd of commands) {
      expect(help).toContain(cmd);
    }
  });

  it("contains version string", () => {
    const help = buildCustomHelp("3.5.7");
    expect(help).toContain("v3.5.7");
  });

  it("contains examples with actual commands", () => {
    const help = buildCustomHelp("1.0.0");
    expect(help).toContain("arcana install --all");
    expect(help).toContain("arcana curate");
    expect(help).toContain("arcana compress git status");
  });

  it("contains GitHub URL", () => {
    const help = buildCustomHelp("1.0.0");
    expect(help).toContain("github.com/medy-gribkov/arcana");
  });

  it("contains ASCII banner", () => {
    const help = buildCustomHelp("1.0.0");
    expect(help).toContain("█████");
  });
});
