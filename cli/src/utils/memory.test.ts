import { describe, it, expect, vi, beforeEach } from "vitest";
import { addMemory, searchMemories, listMemories, removeMemory, getProjectMemories } from "./memory.js";

// Mock the file system and homedir
vi.mock("node:fs", async () => {
  let store: Record<string, string> = {};
  return {
    existsSync: (p: string) => p in store,
    readFileSync: (p: string) => {
      if (!(p in store)) throw new Error("ENOENT");
      return store[p];
    },
    mkdirSync: () => {},
    writeFileSync: (p: string, data: string) => {
      store[p] = data;
    },
    // Reset helper
    __reset: () => {
      store = {};
    },
    __getStore: () => store,
  };
});

vi.mock("./atomic.js", async () => {
  const fs = await import("node:fs");
  return {
    atomicWriteSync: (path: string, content: string) => {
      (fs as unknown as { writeFileSync: (p: string, d: string) => void }).writeFileSync(path, content);
    },
  };
});

beforeEach(async () => {
  const fs = await import("node:fs");
  (fs as unknown as { __reset: () => void }).__reset();
});

describe("addMemory", () => {
  it("creates a memory with auto-generated id", () => {
    const mem = addMemory("always use pnpm for monorepos");
    expect(mem.id).toBeTruthy();
    expect(mem.id.length).toBe(8);
    expect(mem.content).toBe("always use pnpm for monorepos");
    expect(mem.created).toBeTruthy();
  });

  it("assigns provided tags", () => {
    const mem = addMemory("use vitest", { tags: ["testing", "vitest"] });
    expect(mem.tags).toEqual(["testing", "vitest"]);
  });

  it("auto-extracts tags when none provided", () => {
    const mem = addMemory("prefer pnpm over yarn in large projects");
    expect(mem.tags.length).toBeGreaterThan(0);
    // Should extract meaningful words > 3 chars
    expect(mem.tags.some((t) => t.length > 3)).toBe(true);
  });

  it("stores project from cwd", () => {
    const mem = addMemory("test fact");
    expect(mem.project).toBeTruthy();
  });

  it("uses provided project name", () => {
    const mem = addMemory("test fact", { project: "my-project" });
    expect(mem.project).toBe("my-project");
  });
});

describe("searchMemories", () => {
  it("finds memories by content substring", () => {
    addMemory("always use strict TypeScript", { project: "test" });
    addMemory("prefer async/await over callbacks", { project: "test" });

    const results = searchMemories("TypeScript");
    expect(results.length).toBe(1);
    expect(results[0]!.content).toContain("TypeScript");
  });

  it("finds memories by tag", () => {
    addMemory("use vitest", { tags: ["testing"], project: "test" });
    addMemory("use prettier", { tags: ["formatting"], project: "test" });

    const results = searchMemories("testing");
    expect(results.length).toBe(1);
  });

  it("is case insensitive", () => {
    addMemory("Always use PNPM", { project: "test" });

    const results = searchMemories("pnpm");
    expect(results.length).toBe(1);
  });

  it("filters by project", () => {
    addMemory("fact for project A", { project: "project-a" });
    addMemory("fact for project B", { project: "project-b" });

    const results = searchMemories("fact", { project: "project-a" });
    expect(results.length).toBe(1);
    expect(results[0]!.project).toBe("project-a");
  });

  it("returns empty for no matches", () => {
    addMemory("something", { project: "test" });
    const results = searchMemories("nonexistent");
    expect(results.length).toBe(0);
  });
});

describe("listMemories", () => {
  it("returns all memories sorted by date", () => {
    addMemory("first", { project: "test" });
    addMemory("second", { project: "test" });
    addMemory("third", { project: "test" });

    const all = listMemories();
    expect(all.length).toBe(3);
  });

  it("filters by project", () => {
    addMemory("a", { project: "proj1" });
    addMemory("b", { project: "proj2" });

    const filtered = listMemories({ project: "proj1" });
    expect(filtered.length).toBe(1);
  });

  it("respects limit", () => {
    addMemory("a", { project: "test" });
    addMemory("b", { project: "test" });
    addMemory("c", { project: "test" });

    const limited = listMemories({ limit: 2 });
    expect(limited.length).toBe(2);
  });
});

describe("removeMemory", () => {
  it("removes a memory by id", () => {
    const mem = addMemory("to be removed", { project: "test" });
    const removed = removeMemory(mem.id);
    expect(removed).toBe(true);

    const all = listMemories();
    expect(all.find((m) => m.id === mem.id)).toBeUndefined();
  });

  it("returns false for nonexistent id", () => {
    expect(removeMemory("nonexistent")).toBe(false);
  });
});

describe("getProjectMemories", () => {
  it("returns memories for current project", () => {
    addMemory("relevant", { project: "arcana" });
    addMemory("other", { project: "other-project" });

    const mems = getProjectMemories("arcana");
    expect(mems.length).toBe(1);
    expect(mems[0]!.content).toBe("relevant");
  });
});
