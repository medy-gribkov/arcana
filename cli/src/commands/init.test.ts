import { describe, it, expect } from "vitest";
import { mkdtempSync, existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { detectProject, SKILL_SUGGESTIONS, SKILL_SUGGESTIONS_DEFAULT } from "./init.js";

describe("detectProject", () => {
  it("detects Go project from go.mod", () => {
    const dir = mkdtempSync(join(tmpdir(), "arcana-init-test-"));
    writeFileSync(join(dir, "go.mod"), "module example.com/test\n\ngo 1.23", "utf-8");
    const result = detectProject(dir);
    expect(result.type).toBe("Go");
    expect(result.lang).toBe("go");
  });

  it("detects Rust project from Cargo.toml", () => {
    const dir = mkdtempSync(join(tmpdir(), "arcana-init-test-"));
    writeFileSync(join(dir, "Cargo.toml"), '[package]\nname = "test"', "utf-8");
    const result = detectProject(dir);
    expect(result.type).toBe("Rust");
    expect(result.lang).toBe("rust");
  });

  it("detects Python project from requirements.txt", () => {
    const dir = mkdtempSync(join(tmpdir(), "arcana-init-test-"));
    writeFileSync(join(dir, "requirements.txt"), "flask==2.0\n", "utf-8");
    const result = detectProject(dir);
    expect(result.type).toBe("Python");
    expect(result.lang).toBe("python");
  });

  it("detects Python project from pyproject.toml", () => {
    const dir = mkdtempSync(join(tmpdir(), "arcana-init-test-"));
    writeFileSync(join(dir, "pyproject.toml"), "[project]\nname = 'test'", "utf-8");
    const result = detectProject(dir);
    expect(result.type).toBe("Python");
    expect(result.lang).toBe("python");
  });

  it("detects Next.js project from package.json with next dependency", () => {
    const dir = mkdtempSync(join(tmpdir(), "arcana-init-test-"));
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({ name: "test", dependencies: { next: "15.0.0" } }),
      "utf-8",
    );
    const result = detectProject(dir);
    expect(result.type).toBe("Next.js");
    expect(result.lang).toBe("typescript");
  });

  it("detects React project from package.json with react dependency", () => {
    const dir = mkdtempSync(join(tmpdir(), "arcana-init-test-"));
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({ name: "test", dependencies: { react: "19.0.0" } }),
      "utf-8",
    );
    const result = detectProject(dir);
    expect(result.type).toBe("React");
    expect(result.lang).toBe("typescript");
  });

  it("detects generic Node.js project from package.json without frameworks", () => {
    const dir = mkdtempSync(join(tmpdir(), "arcana-init-test-"));
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({ name: "test", dependencies: { express: "4.0.0" } }),
      "utf-8",
    );
    const result = detectProject(dir);
    expect(result.type).toBe("Node.js");
    expect(result.lang).toBe("typescript");
  });

  it("returns Unknown for empty directory", () => {
    const dir = mkdtempSync(join(tmpdir(), "arcana-init-test-"));
    const result = detectProject(dir);
    expect(result.type).toBe("Unknown");
    expect(result.lang).toBe("general");
  });

  it("uses directory basename as project name", () => {
    const dir = mkdtempSync(join(tmpdir(), "my-cool-project-"));
    const result = detectProject(dir);
    expect(result.name).toContain("my-cool-project");
  });

  it("prioritizes Go over Node.js when both exist", () => {
    const dir = mkdtempSync(join(tmpdir(), "arcana-init-test-"));
    writeFileSync(join(dir, "go.mod"), "module test\ngo 1.23", "utf-8");
    writeFileSync(join(dir, "package.json"), '{"name":"test"}', "utf-8");
    const result = detectProject(dir);
    expect(result.type).toBe("Go");
  });
});

describe("SKILL_SUGGESTIONS", () => {
  it("has suggestions for Go projects", () => {
    expect(SKILL_SUGGESTIONS["Go"]).toBeDefined();
    expect(SKILL_SUGGESTIONS["Go"]!.length).toBeGreaterThan(0);
    expect(SKILL_SUGGESTIONS["Go"]).toContain("golang-pro");
  });

  it("has suggestions for Next.js projects", () => {
    expect(SKILL_SUGGESTIONS["Next.js"]).toBeDefined();
    expect(SKILL_SUGGESTIONS["Next.js"]).toContain("typescript");
  });

  it("has suggestions for React projects", () => {
    expect(SKILL_SUGGESTIONS["React"]).toBeDefined();
    expect(SKILL_SUGGESTIONS["React"]).toContain("frontend-design");
  });

  it("has default suggestions for unknown types", () => {
    expect(SKILL_SUGGESTIONS_DEFAULT.length).toBeGreaterThan(0);
    expect(SKILL_SUGGESTIONS_DEFAULT).toContain("code-reviewer");
  });
});
