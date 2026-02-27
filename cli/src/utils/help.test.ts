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
    expect(help).toContain("DEVELOPMENT");
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
    expect(help).toContain("Supercharge any AI coding agent");
  });

  it("contains all 15 commands", () => {
    const help = buildCustomHelp("1.0.0");
    const commands = [
      "init",
      "doctor",
      "list",
      "search",
      "info",
      "install",
      "update",
      "uninstall",
      "create",
      "validate",
      "audit",
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
    expect(help).toContain("arcana install code-reviewer");
    expect(help).toContain("arcana search");
    expect(help).toContain("arcana init --tool claude");
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
