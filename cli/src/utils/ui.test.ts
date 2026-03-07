import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { ui, banner, table, getErrorHint, printErrorWithHint, suggest, errorAndExit, noopSpinner } from "./ui.js";

describe("ui formatting", () => {
  it("brand returns non-empty string", () => {
    expect(ui.brand("test").length).toBeGreaterThan(0);
  });

  it("success returns non-empty string", () => {
    expect(ui.success("ok").length).toBeGreaterThan(0);
  });

  it("error returns non-empty string", () => {
    expect(ui.error("bad").length).toBeGreaterThan(0);
  });

  it("warn returns non-empty string", () => {
    expect(ui.warn("caution").length).toBeGreaterThan(0);
  });

  it("dim returns non-empty string", () => {
    expect(ui.dim("faded").length).toBeGreaterThan(0);
  });

  it("bold returns non-empty string", () => {
    expect(ui.bold("strong").length).toBeGreaterThan(0);
  });

  it("cyan returns non-empty string", () => {
    expect(ui.cyan("colored").length).toBeGreaterThan(0);
  });
});

describe("banner", () => {
  it("prints banner text", () => {
    const logs: string[] = [];
    const orig = console.log;
    console.log = (...args: unknown[]) => logs.push(args.join(" "));
    banner();
    console.log = orig;
    expect(logs.some((l) => l.includes("arcana"))).toBe(true);
  });
});

describe("noopSpinner", () => {
  it("returns object with all spinner methods", () => {
    const s = noopSpinner();
    expect(typeof s.start).toBe("function");
    expect(typeof s.stop).toBe("function");
    expect(typeof s.succeed).toBe("function");
    expect(typeof s.info).toBe("function");
    expect(typeof s.fail).toBe("function");
    s.start();
    s.stop();
    s.succeed("done");
    s.info("info");
    s.fail("failed");
  });
});

describe("table", () => {
  let logs: string[];
  const orig = console.log;

  beforeEach(() => {
    logs = [];
    console.log = (...args: unknown[]) => logs.push(args.join(" "));
  });

  afterAll(() => {
    console.log = orig;
  });

  it("prints nothing for empty rows", () => {
    table([]);
    expect(logs.length).toBe(0);
  });

  it("prints rows with padding", () => {
    table([
      ["Name", "Version"],
      ["skill-a", "1.0.0"],
      ["skill-b", "2.0.0"],
    ]);
    expect(logs.length).toBe(3);
    expect(logs[0]!).toContain("Name");
    expect(logs[1]!).toContain("skill-a");
  });

  it("handles single-column tables", () => {
    table([["Only"]]);
    expect(logs.length).toBe(1);
  });
});

describe("getErrorHint", () => {
  it("returns network hint for ECONNREFUSED", () => {
    const err = new Error("connect ECONNREFUSED 127.0.0.1:443");
    expect(getErrorHint(err)).toContain("internet connection");
  });

  it("returns network hint for ETIMEDOUT", () => {
    expect(getErrorHint(new Error("connect ETIMEDOUT"))).toContain("internet connection");
  });

  it("returns network hint for ENOTFOUND", () => {
    expect(getErrorHint(new Error("getaddrinfo ENOTFOUND"))).toContain("internet connection");
  });

  it("returns network hint for ENETUNREACH", () => {
    expect(getErrorHint(new Error("ENETUNREACH"))).toContain("internet connection");
  });

  it("returns network hint for EAI_AGAIN", () => {
    expect(getErrorHint(new Error("EAI_AGAIN"))).toContain("internet connection");
  });

  it("returns 404 hint", () => {
    expect(getErrorHint(new Error("HTTP 404 Not Found"))).toContain("search");
  });

  it("returns undefined for random error", () => {
    expect(getErrorHint(new Error("something went wrong"))).toBeUndefined();
  });

  it("returns undefined for non-Error", () => {
    expect(getErrorHint("string")).toBeUndefined();
    expect(getErrorHint(null)).toBeUndefined();
  });
});

describe("printErrorWithHint", () => {
  let errorLogs: string[];
  const origError = console.error;

  beforeEach(() => {
    errorLogs = [];
    console.error = (...args: unknown[]) => errorLogs.push(args.join(" "));
  });

  afterAll(() => {
    console.error = origError;
  });

  it("prints message when showMessage is true", () => {
    printErrorWithHint(new Error("test error"), true);
    expect(errorLogs.some((l) => l.includes("test error"))).toBe(true);
  });

  it("prints hint for network error", () => {
    printErrorWithHint(new Error("connect ECONNREFUSED"));
    expect(errorLogs.some((l) => l.includes("internet connection"))).toBe(true);
    expect(errorLogs.some((l) => l.includes("Try again"))).toBe(true);
  });

  it("prints retry advice for transient HTTP errors", () => {
    printErrorWithHint(new Error("Server returned 503"));
    expect(errorLogs.some((l) => l.includes("Try again"))).toBe(true);
  });

  it("does not print retry for non-transient errors", () => {
    printErrorWithHint(new Error("permission denied"));
    expect(errorLogs.every((l) => !l.includes("Try again"))).toBe(true);
  });

  it("handles non-Error gracefully", () => {
    printErrorWithHint("string error");
    // Should not throw
  });
});

describe("suggest", () => {
  let logs: string[];
  const orig = console.log;

  beforeEach(() => {
    logs = [];
    console.log = (...args: unknown[]) => logs.push(args.join(" "));
  });

  afterAll(() => {
    console.log = orig;
  });

  it("does nothing when not TTY", () => {
    const origTTY = process.stdout.isTTY;
    Object.defineProperty(process.stdout, "isTTY", { value: false, writable: true });
    suggest("try this");
    expect(logs.length).toBe(0);
    Object.defineProperty(process.stdout, "isTTY", { value: origTTY, writable: true });
  });
});

describe("errorAndExit", () => {
  it("exits with error message", () => {
    const mockExit = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("exit");
    });
    const errorLogs: string[] = [];
    const origError = console.error;
    console.error = (...args: unknown[]) => errorLogs.push(args.join(" "));

    expect(() => errorAndExit("test failure")).toThrow("exit");
    expect(errorLogs.some((l) => l.includes("test failure"))).toBe(true);
    expect(errorLogs.some((l) => l.includes("doctor"))).toBe(true);

    console.error = origError;
    mockExit.mockRestore();
  });

  it("uses custom hint when provided", () => {
    const mockExit = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("exit");
    });
    const errorLogs: string[] = [];
    const origError = console.error;
    console.error = (...args: unknown[]) => errorLogs.push(args.join(" "));

    expect(() => errorAndExit("test failure", "custom hint")).toThrow("exit");
    expect(errorLogs.some((l) => l.includes("custom hint"))).toBe(true);

    console.error = origError;
    mockExit.mockRestore();
  });
});
