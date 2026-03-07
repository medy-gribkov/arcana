import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";

const mockMemory = vi.hoisted(() => ({
  addMemory: vi.fn(),
  searchMemories: vi.fn(),
  listMemories: vi.fn(),
  removeMemory: vi.fn(),
}));

vi.mock("../utils/memory.js", () => mockMemory);
vi.mock("../utils/ui.js", () => ({
  ui: {
    bold: (s: string) => s,
    dim: (s: string) => s,
    success: (s: string) => s,
    warn: (s: string) => s,
  },
  banner: () => {},
}));

import { rememberCommand, recallCommand, forgetCommand } from "./remember.js";

let logOutput: string[] = [];
let errorOutput: string[] = [];
const originalLog = console.log;
const originalError = console.error;

beforeEach(() => {
  vi.clearAllMocks();
  logOutput = [];
  errorOutput = [];
  console.log = (...args: unknown[]) => logOutput.push(args.join(" "));
  console.error = (...args: unknown[]) => errorOutput.push(args.join(" "));
});

afterAll(() => {
  console.log = originalLog;
  console.error = originalError;
});

describe("rememberCommand", () => {
  it("saves memory and outputs JSON", async () => {
    const mem = { id: "abc12345", content: "use pnpm", tags: ["pnpm"], project: "arcana", created: "2026-01-01" };
    mockMemory.addMemory.mockReturnValue(mem);

    await rememberCommand(["use", "pnpm"], { json: true });

    expect(mockMemory.addMemory).toHaveBeenCalledWith("use pnpm", expect.objectContaining({}));
    const output = JSON.parse(logOutput[0]!);
    expect(output.id).toBe("abc12345");
    expect(output.content).toBe("use pnpm");
  });

  it("saves memory with display output", async () => {
    const mem = { id: "abc12345", content: "use vitest", tags: ["vitest"], project: "arcana", created: "2026-01-01" };
    mockMemory.addMemory.mockReturnValue(mem);

    await rememberCommand(["use", "vitest"], {});

    expect(logOutput.some((l) => l.includes("Saved"))).toBe(true);
    expect(logOutput.some((l) => l.includes("abc12345"))).toBe(true);
  });

  it("exits with error on empty content", async () => {
    const mockExit = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit");
    });

    await expect(rememberCommand([""], { json: true })).rejects.toThrow("process.exit");
    const output = JSON.parse(logOutput[0]!);
    expect(output.error).toContain("Provide content");
    mockExit.mockRestore();
  });

  it("passes tags when provided", async () => {
    const mem = { id: "x", content: "t", tags: ["a"], project: "p", created: "2026-01-01" };
    mockMemory.addMemory.mockReturnValue(mem);

    await rememberCommand(["test"], { json: true, tag: ["testing"] });
    expect(mockMemory.addMemory).toHaveBeenCalledWith("test", expect.objectContaining({ tags: ["testing"] }));
  });
});

describe("recallCommand", () => {
  it("returns search results as JSON", async () => {
    const results = [{ id: "a", content: "use pnpm", tags: [], project: "p", created: "2026-01-01" }];
    mockMemory.searchMemories.mockReturnValue(results);

    await recallCommand(["pnpm"], { json: true });

    const output = JSON.parse(logOutput[0]!);
    expect(output.length).toBe(1);
    expect(output[0].content).toBe("use pnpm");
  });

  it("lists all memories with --all flag", async () => {
    const mems = [
      { id: "a", content: "fact 1", tags: [], project: "p", created: "2026-01-01" },
      { id: "b", content: "fact 2", tags: [], project: "p", created: "2026-01-02" },
    ];
    mockMemory.listMemories.mockReturnValue(mems);

    await recallCommand([], { all: true, json: true });

    const output = JSON.parse(logOutput[0]!);
    expect(output.length).toBe(2);
  });

  it("exits with error on empty query without --all", async () => {
    const mockExit = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit");
    });

    await expect(recallCommand([""], { json: true })).rejects.toThrow("process.exit");
    const output = JSON.parse(logOutput[0]!);
    expect(output.error).toContain("search query");
    mockExit.mockRestore();
  });

  it("displays results in non-JSON mode", async () => {
    mockMemory.searchMemories.mockReturnValue([
      { id: "x", content: "hello", tags: ["t"], project: "p", created: "2026-01-01" },
    ]);

    await recallCommand(["hello"], {});
    expect(logOutput.some((l) => l.includes("hello"))).toBe(true);
  });

  it("shows empty message for no matches", async () => {
    mockMemory.searchMemories.mockReturnValue([]);

    await recallCommand(["nope"], {});
    expect(logOutput.some((l) => l.includes("No memories matching"))).toBe(true);
  });

  it("filters by project when provided", async () => {
    mockMemory.searchMemories.mockReturnValue([]);

    await recallCommand(["test"], { project: "my-proj", json: true });
    expect(mockMemory.searchMemories).toHaveBeenCalledWith("test", { project: "my-proj" });
  });
});

describe("forgetCommand", () => {
  it("removes memory and outputs JSON", async () => {
    mockMemory.removeMemory.mockReturnValue(true);

    await forgetCommand("abc123", { json: true });

    const output = JSON.parse(logOutput[0]!);
    expect(output.removed).toBe(true);
    expect(output.id).toBe("abc123");
  });

  it("handles nonexistent memory", async () => {
    mockMemory.removeMemory.mockReturnValue(false);

    await forgetCommand("nonexistent", { json: true });

    const output = JSON.parse(logOutput[0]!);
    expect(output.removed).toBe(false);
  });

  it("exits with error on empty id", async () => {
    const mockExit = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit");
    });

    await expect(forgetCommand("", { json: true })).rejects.toThrow("process.exit");
    mockExit.mockRestore();
  });

  it("displays success in non-JSON mode", async () => {
    mockMemory.removeMemory.mockReturnValue(true);

    await forgetCommand("abc", {});
    expect(logOutput.some((l) => l.includes("removed"))).toBe(true);
  });

  it("displays not-found in non-JSON mode", async () => {
    mockMemory.removeMemory.mockReturnValue(false);

    await forgetCommand("abc", {});
    expect(logOutput.some((l) => l.includes("not found"))).toBe(true);
  });
});
