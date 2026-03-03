import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";

// Test loadConfig indirectly: verify the config module exports expected types
// Deep env override testing requires FS mocking which is fragile in ESM.
// Instead, test the observable contract.

describe("config module", () => {
  it("loadConfig returns valid config shape", async () => {
    const { loadConfig } = await import("./config.js");
    const config = loadConfig();
    expect(config).toHaveProperty("defaultProvider");
    expect(config).toHaveProperty("installDir");
    expect(config).toHaveProperty("providers");
    expect(typeof config.defaultProvider).toBe("string");
    expect(typeof config.installDir).toBe("string");
    expect(Array.isArray(config.providers)).toBe(true);
  });

  it("loadConfig returns arcana as default provider", async () => {
    const { loadConfig } = await import("./config.js");
    const config = loadConfig();
    // Default provider should always be arcana unless overridden
    expect(config.defaultProvider).toBe("arcana");
  });

  it("loadConfig providers include arcana", async () => {
    const { loadConfig } = await import("./config.js");
    const config = loadConfig();
    const arcana = config.providers.find((p) => p.name === "arcana");
    expect(arcana).toBeDefined();
    expect(arcana!.type).toBe("github");
    expect(arcana!.enabled).toBe(true);
  });

  it("installDir is an absolute path", async () => {
    const { loadConfig } = await import("./config.js");
    const config = loadConfig();
    // On Windows: starts with drive letter, on Unix: starts with /
    const isAbsolute = config.installDir.startsWith("/") || /^[A-Z]:\\/i.test(config.installDir);
    expect(isAbsolute).toBe(true);
  });
});
