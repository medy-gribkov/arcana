import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

let tempHome: string;

vi.mock("node:os", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:os")>();
  return { ...actual, homedir: () => tempHome };
});

// The optimize command imports getInstallDir which reads config.
// We mock the fs utility to return a path under tempHome.
vi.mock("../utils/fs.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../utils/fs.js")>();
  return {
    ...actual,
    getInstallDir: () => join(tempHome, ".agents", "skills"),
  };
});

beforeEach(() => {
  tempHome = mkdtempSync(join(tmpdir(), "arcana-optimize-test-"));
});

afterEach(() => {
  if (tempHome && existsSync(tempHome)) {
    try {
      rmSync(tempHome, { recursive: true, force: true });
    } catch {
      /* skip */
    }
  }
});

function writeSettings(settings: Record<string, unknown>) {
  const claudeDir = join(tempHome, ".claude");
  mkdirSync(claudeDir, { recursive: true });
  writeFileSync(join(claudeDir, "settings.json"), JSON.stringify(settings), "utf-8");
}

describe("optimizeCommand", () => {
  it("runs without error when no settings exist (JSON mode)", async () => {
    const { optimizeCommand } = await import("./optimize.js");
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});

    await optimizeCommand({ json: true });

    const output = spy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("recommendations");
    const parsed = JSON.parse(spy.mock.calls[0]![0] as string);
    expect(parsed.recommendations).toBeInstanceOf(Array);
    expect(parsed.recommendations.length).toBeGreaterThan(0);

    spy.mockRestore();
  });

  it("reports autocompact as suggest when not configured", async () => {
    writeSettings({});
    const { optimizeCommand } = await import("./optimize.js");
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});

    await optimizeCommand({ json: true });

    const parsed = JSON.parse(spy.mock.calls[0]![0] as string);
    const autocompact = parsed.recommendations.find((r: { area: string }) => r.area === "Autocompact");
    expect(autocompact).toBeDefined();
    expect(autocompact.status).toBe("suggest");

    spy.mockRestore();
  });

  it("reports autocompact as good when set to 80%", async () => {
    writeSettings({ env: { CLAUDE_AUTOCOMPACT_PCT_OVERRIDE: "80" } });
    const { optimizeCommand } = await import("./optimize.js");
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});

    await optimizeCommand({ json: true });

    const parsed = JSON.parse(spy.mock.calls[0]![0] as string);
    const autocompact = parsed.recommendations.find((r: { area: string }) => r.area === "Autocompact");
    expect(autocompact.status).toBe("good");

    spy.mockRestore();
  });

  it("reports autocompact as warn when set too low (<=70)", async () => {
    writeSettings({ env: { CLAUDE_AUTOCOMPACT_PCT_OVERRIDE: "60" } });
    const { optimizeCommand } = await import("./optimize.js");
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});

    await optimizeCommand({ json: true });

    const parsed = JSON.parse(spy.mock.calls[0]![0] as string);
    const autocompact = parsed.recommendations.find((r: { area: string }) => r.area === "Autocompact");
    expect(autocompact.status).toBe("warn");

    spy.mockRestore();
  });

  it("reports good skill token budget with no skills installed", async () => {
    writeSettings({});
    const { optimizeCommand } = await import("./optimize.js");
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});

    await optimizeCommand({ json: true });

    const parsed = JSON.parse(spy.mock.calls[0]![0] as string);
    const budget = parsed.recommendations.find((r: { area: string }) => r.area === "Skill token budget");
    expect(budget.status).toBe("good");

    spy.mockRestore();
  });

  it("prints human-readable output in non-JSON mode", async () => {
    writeSettings({});
    const { optimizeCommand } = await import("./optimize.js");
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});

    await optimizeCommand({ json: false });

    const output = spy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(output).toContain("Optimization Report");

    spy.mockRestore();
  });
});
