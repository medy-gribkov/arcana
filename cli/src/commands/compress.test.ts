import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("compressCommand", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;
  let stdoutWriteSpy: ReturnType<typeof vi.spyOn>;
  let compressMock: ReturnType<typeof vi.fn>;
  let compressionStatsMock: ReturnType<typeof vi.fn>;
  let recordCompressionMock: ReturnType<typeof vi.fn>;
  let execSyncMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();

    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, "exit").mockImplementation((() => {}) as never);
    stdoutWriteSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    compressMock = vi.fn((input: string) => `compressed:${input}`);
    compressionStatsMock = vi.fn(() => ({ originalTokens: 100, compressedTokens: 50 }));
    recordCompressionMock = vi.fn();
    execSyncMock = vi.fn(() => "command output");

    vi.doMock("../compress/index.js", () => ({
      compress: compressMock,
      compressionStats: compressionStatsMock,
      recordCompression: recordCompressionMock,
    }));

    vi.doMock("node:child_process", () => ({
      execSync: execSyncMock,
    }));
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
    stdoutWriteSpy.mockRestore();
    vi.resetModules();
  });

  it("prints usage and exits when no command and no --stdin", async () => {
    const { compressCommand } = await import("./compress.js");
    await compressCommand([], {});

    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Usage:"));
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it("runs execSync when command args are provided", async () => {
    const { compressCommand } = await import("./compress.js");
    await compressCommand(["git", "log"], {});

    expect(execSyncMock).toHaveBeenCalledWith("git log", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      maxBuffer: 10 * 1024 * 1024,
    });
    expect(compressMock).toHaveBeenCalledWith("command output", "git");
    expect(compressionStatsMock).toHaveBeenCalledWith("command output", "compressed:command output");
    expect(recordCompressionMock).toHaveBeenCalledWith("git", 100, 50);
  });

  it("outputs JSON stats when opts.json is true", async () => {
    const { compressCommand } = await import("./compress.js");
    await compressCommand(["npm", "test"], { json: true });

    const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
    expect(output).toEqual({ originalTokens: 100, compressedTokens: 50 });
  });

  it("writes compressed text to stdout when opts.json is false", async () => {
    const { compressCommand } = await import("./compress.js");
    await compressCommand(["git", "status"], {});

    expect(stdoutWriteSpy).toHaveBeenCalledWith("compressed:command output");
    expect(consoleLogSpy).not.toHaveBeenCalled();
  });

  it("uses opts.tool as the tool name when provided", async () => {
    const { compressCommand } = await import("./compress.js");
    await compressCommand(["some-cmd"], { tool: "custom-tool" });

    expect(compressMock).toHaveBeenCalledWith("command output", "custom-tool");
    expect(recordCompressionMock).toHaveBeenCalledWith("custom-tool", 100, 50);
  });

  it("captures stdout from failed execSync", async () => {
    execSyncMock.mockImplementation(() => {
      const err = new Error("Command failed") as Error & { stdout?: string; stderr?: string };
      err.stdout = "partial output";
      err.stderr = "some error";
      throw err;
    });

    const { compressCommand } = await import("./compress.js");
    await compressCommand(["bad-cmd"], { json: true });

    expect(compressMock).toHaveBeenCalledWith("partial output", "bad-cmd");
  });

  it("handles execSync error with no stdout", async () => {
    execSyncMock.mockImplementation(() => {
      const err = new Error("Command failed") as Error & { stdout?: string; stderr?: string };
      err.stderr = "error text";
      throw err;
    });

    const { compressCommand } = await import("./compress.js");
    await compressCommand(["bad-cmd"], { json: true });

    // When stdout is undefined: undefined ?? "" + "error text" = "error text"
    // (but due to operator precedence: undefined ?? ("" + "error text") = "error text" only when stdout is nullish)
    expect(compressMock).toHaveBeenCalled();
  });

  it("reads from stdin when opts.stdin is true", async () => {
    // Create a mock readable stream
    const { Readable } = await import("node:stream");
    const mockStdin = new Readable({
      read() {
        this.push(Buffer.from("stdin input"));
        this.push(null);
      },
    });

    // Replace process.stdin temporarily
    const originalStdin = process.stdin;
    Object.defineProperty(process, "stdin", { value: mockStdin, writable: true, configurable: true });

    const { compressCommand } = await import("./compress.js");
    await compressCommand([], { stdin: true, tool: "git" });

    expect(compressMock).toHaveBeenCalledWith("stdin input", "git");
    expect(recordCompressionMock).toHaveBeenCalledWith("git", 100, 50);

    // Restore
    Object.defineProperty(process, "stdin", { value: originalStdin, writable: true, configurable: true });
  });

  it("uses 'unknown' as tool when no command and no opts.tool (stdin mode)", async () => {
    const { Readable } = await import("node:stream");
    const mockStdin = new Readable({
      read() {
        this.push(Buffer.from("data"));
        this.push(null);
      },
    });

    const originalStdin = process.stdin;
    Object.defineProperty(process, "stdin", { value: mockStdin, writable: true, configurable: true });

    const { compressCommand } = await import("./compress.js");
    await compressCommand([], { stdin: true });

    // tool = opts.tool ?? command[0] ?? "unknown" => undefined ?? undefined ?? "unknown"
    expect(compressMock).toHaveBeenCalledWith("data", "unknown");

    Object.defineProperty(process, "stdin", { value: originalStdin, writable: true, configurable: true });
  });
});
