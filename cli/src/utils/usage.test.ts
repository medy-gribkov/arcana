import { describe, it, expect, vi, beforeEach } from "vitest";
import { recordLoad, recordCuration, getAllUsage, getUnusedSkills, getUsageBoost } from "./usage.js";

// Mock the file system
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
    __reset: () => {
      store = {};
    },
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

describe("recordLoad", () => {
  it("records a load event", () => {
    recordLoad("typescript");
    const usage = getAllUsage();
    expect(usage["typescript"]).toBeDefined();
    expect(usage["typescript"]!.loads).toBe(1);
  });

  it("increments load count on repeated calls", () => {
    recordLoad("typescript");
    recordLoad("typescript");
    recordLoad("typescript");
    const usage = getAllUsage();
    expect(usage["typescript"]!.loads).toBe(3);
  });

  it("tracks project when provided", () => {
    recordLoad("golang", "my-project");
    const usage = getAllUsage();
    expect(usage["golang"]!.projects).toContain("my-project");
  });

  it("does not duplicate projects", () => {
    recordLoad("golang", "my-project");
    recordLoad("golang", "my-project");
    const usage = getAllUsage();
    expect(usage["golang"]!.projects.length).toBe(1);
  });

  it("updates lastUsed timestamp", () => {
    recordLoad("typescript");
    const usage = getAllUsage();
    const date = new Date(usage["typescript"]!.lastUsed);
    expect(date.getTime()).toBeGreaterThan(Date.now() - 5000);
  });
});

describe("recordCuration", () => {
  it("records a curation event", () => {
    recordCuration("react");
    const usage = getAllUsage();
    expect(usage["react"]).toBeDefined();
    expect(usage["react"]!.curations).toBe(1);
    expect(usage["react"]!.loads).toBe(0);
  });

  it("increments curation count", () => {
    recordCuration("react");
    recordCuration("react");
    const usage = getAllUsage();
    expect(usage["react"]!.curations).toBe(2);
  });
});

describe("getAllUsage", () => {
  it("returns empty object when no data", () => {
    expect(getAllUsage()).toEqual({});
  });

  it("returns all tracked skills", () => {
    recordLoad("typescript");
    recordLoad("golang");
    recordCuration("react");
    const usage = getAllUsage();
    expect(Object.keys(usage)).toEqual(expect.arrayContaining(["typescript", "golang", "react"]));
  });
});

describe("getUnusedSkills", () => {
  it("returns skills not used recently", async () => {
    // Record a skill with an old lastUsed date
    recordLoad("old-skill");
    const usage = getAllUsage();
    // Manually set lastUsed to 60 days ago
    usage["old-skill"]!.lastUsed = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    // Write back through the mock using the same path usage.ts computes
    const fs = await import("node:fs");
    const path = await import("node:path");
    const os = await import("node:os");
    const usagePath = path.join(os.homedir(), ".arcana", "usage.json");
    fs.writeFileSync(usagePath, JSON.stringify(usage));

    const unused = getUnusedSkills(30);
    expect(unused).toContain("old-skill");
  });

  it("does not return recently used skills", () => {
    recordLoad("active-skill");
    const unused = getUnusedSkills(30);
    expect(unused).not.toContain("active-skill");
  });
});

describe("getUsageBoost", () => {
  it("returns 0 for unknown skills", () => {
    expect(getUsageBoost("nonexistent")).toBe(0);
  });

  it("returns 15 for skill used today", () => {
    recordLoad("recent-skill");
    const boost = getUsageBoost("recent-skill");
    expect(boost).toBe(15);
  });

  it("returns 10 for skill used 3 days ago", async () => {
    recordLoad("three-day-skill");
    const usage = getAllUsage();
    usage["three-day-skill"]!.lastUsed = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    // Write back through mock
    const fs = await import("node:fs");
    const path = await import("node:path");
    const os = await import("node:os");
    const usagePath = path.join(os.homedir(), ".arcana", "usage.json");
    fs.writeFileSync(usagePath, JSON.stringify(usage));

    expect(getUsageBoost("three-day-skill")).toBe(10);
  });

  it("returns 5 for skill used 10 days ago", async () => {
    recordLoad("ten-day-skill");
    const usage = getAllUsage();
    usage["ten-day-skill"]!.lastUsed = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    const fs = await import("node:fs");
    const path = await import("node:path");
    const os = await import("node:os");
    const usagePath = path.join(os.homedir(), ".arcana", "usage.json");
    fs.writeFileSync(usagePath, JSON.stringify(usage));

    expect(getUsageBoost("ten-day-skill")).toBe(5);
  });

  it("returns 0 for skill used 30 days ago", async () => {
    recordLoad("old-skill");
    const usage = getAllUsage();
    usage["old-skill"]!.lastUsed = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const fs = await import("node:fs");
    const path = await import("node:path");
    const os = await import("node:os");
    const usagePath = path.join(os.homedir(), ".arcana", "usage.json");
    fs.writeFileSync(usagePath, JSON.stringify(usage));

    expect(getUsageBoost("old-skill")).toBe(0);
  });
});

describe("readUsage edge cases", () => {
  it("returns {} when usage file has invalid JSON", async () => {
    // Write invalid JSON to the usage file path
    const fs = await import("node:fs");
    const path = await import("node:path");
    const os = await import("node:os");
    const usagePath = path.join(os.homedir(), ".arcana", "usage.json");
    fs.writeFileSync(usagePath, "not valid json {{{}");

    // getAllUsage calls readUsage internally
    const usage = getAllUsage();
    expect(usage).toEqual({});
  });
});
