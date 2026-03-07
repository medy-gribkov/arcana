import { describe, it, expect } from "vitest";
import { getCommandNames, getGroupedCommands, findClosestCommand, getCliReference } from "./command-defs.js";

describe("command-defs", () => {
  describe("getCommandNames", () => {
    it("returns all command names as strings", () => {
      const names = getCommandNames();
      expect(names).toBeInstanceOf(Array);
      expect(names.length).toBeGreaterThan(20);
      expect(names).toContain("install");
      expect(names).toContain("search");
      expect(names).toContain("clean");
      expect(names).toContain("doctor");
    });

    it("contains no duplicates", () => {
      const names = getCommandNames();
      const unique = new Set(names);
      expect(unique.size).toBe(names.length);
    });
  });

  describe("getGroupedCommands", () => {
    it("returns groups with entries", () => {
      const groups = getGroupedCommands();
      expect(Object.keys(groups).length).toBeGreaterThanOrEqual(5);
      expect(groups["SKILLS"]).toBeDefined();
      expect(groups["SKILLS"]!.length).toBeGreaterThan(3);
    });

    it("every entry has required fields", () => {
      const groups = getGroupedCommands();
      for (const entries of Object.values(groups)) {
        for (const entry of entries) {
          expect(entry.name).toBeTruthy();
          expect(entry.usage).toBeTruthy();
          expect(entry.description).toBeTruthy();
          expect(entry.group).toBeTruthy();
        }
      }
    });
  });

  describe("findClosestCommand", () => {
    it("finds exact prefix matches", () => {
      expect(findClosestCommand("ini")).toBe("init");
      expect(findClosestCommand("sea")).toBe("search");
      expect(findClosestCommand("doc")).toBe("doctor");
    });

    it("returns exact command name when input matches", () => {
      expect(findClosestCommand("install")).toBe("install");
      expect(findClosestCommand("search")).toBe("search");
    });

    it("returns undefined for no match", () => {
      expect(findClosestCommand("zzz")).toBeUndefined();
      expect(findClosestCommand("xyz")).toBeUndefined();
    });

    it("is case-insensitive", () => {
      expect(findClosestCommand("SEA")).toBe("search");
      expect(findClosestCommand("Doc")).toBe("doctor");
    });
  });

  describe("getCliReference", () => {
    it("returns newline-separated reference lines", () => {
      const ref = getCliReference();
      const lines = ref.split("\n");
      expect(lines.length).toBeGreaterThan(20);
      expect(lines[0]).toMatch(/^arcana /);
    });

    it("includes all command names", () => {
      const ref = getCliReference();
      const names = getCommandNames();
      for (const name of names) {
        expect(ref).toContain(`arcana ${name}`);
      }
    });
  });
});
