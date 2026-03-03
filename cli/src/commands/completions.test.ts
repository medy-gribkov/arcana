import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("completionsCommand", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process.exit");
    }) as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("bash output contains complete -F", async () => {
    const { completionsCommand } = await import("./completions.js");

    completionsCommand("bash", {});

    const output = consoleLogSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("complete -F");
  });

  it("zsh output contains #compdef arcana", async () => {
    const { completionsCommand } = await import("./completions.js");

    completionsCommand("zsh", {});

    const output = consoleLogSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("#compdef arcana");
  });

  it("fish output contains complete -c arcana", async () => {
    const { completionsCommand } = await import("./completions.js");

    completionsCommand("fish", {});

    const output = consoleLogSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("complete -c arcana");
  });

  it("unsupported shell exits with error", async () => {
    const { completionsCommand } = await import("./completions.js");

    expect(() => completionsCommand("powershell", {})).toThrow("process.exit");
    expect(processExitSpy).toHaveBeenCalledWith(1);
    const errorOutput = consoleErrorSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(errorOutput).toContain("Unsupported shell: powershell");
  });

  it("--json mode returns JSON with script field", async () => {
    const { completionsCommand } = await import("./completions.js");

    completionsCommand("bash", { json: true });

    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
    expect(parsed).toHaveProperty("shell", "bash");
    expect(parsed).toHaveProperty("script");
    expect(parsed.script).toContain("complete -F");
  });

  it("unsupported shell with --json returns JSON error", async () => {
    const { completionsCommand } = await import("./completions.js");

    expect(() => completionsCommand("nushell", { json: true })).toThrow("process.exit");

    const jsonCall = consoleLogSpy.mock.calls.find((call) => {
      try {
        JSON.parse(call[0] as string);
        return true;
      } catch {
        return false;
      }
    });
    expect(jsonCall).toBeDefined();
    const parsed = JSON.parse(jsonCall![0] as string);
    expect(parsed).toHaveProperty("error");
    expect(parsed.error).toContain("nushell");
    expect(parsed).toHaveProperty("supported");
  });
});
