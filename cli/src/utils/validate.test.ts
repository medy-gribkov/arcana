import { describe, it, expect } from "vitest";
import { validateSlug } from "./validate.js";

describe("validateSlug", () => {
  describe("valid slugs", () => {
    it("should accept simple alphanumeric slug", () => {
      expect(() => validateSlug("skill123", "skill")).not.toThrow();
    });

    it("should accept slug with hyphens", () => {
      expect(() => validateSlug("my-skill-name", "skill")).not.toThrow();
    });

    it("should accept slug with dots", () => {
      expect(() => validateSlug("my.skill.name", "skill")).not.toThrow();
    });

    it("should accept slug with underscores", () => {
      expect(() => validateSlug("my_skill_name", "skill")).not.toThrow();
    });

    it("should accept slug with mixed separators", () => {
      expect(() => validateSlug("my-skill_name.v2", "skill")).not.toThrow();
    });

    it("should accept single character slug", () => {
      expect(() => validateSlug("a", "skill")).not.toThrow();
    });

    it("should accept single digit slug", () => {
      expect(() => validateSlug("1", "skill")).not.toThrow();
    });

    it("should accept slug starting and ending with alphanumeric", () => {
      expect(() => validateSlug("a-b-c-1", "skill")).not.toThrow();
    });

    it("should accept uppercase letters", () => {
      expect(() => validateSlug("MySkill", "skill")).not.toThrow();
    });

    it("should accept mixed case with separators", () => {
      expect(() => validateSlug("My-Skill_Name.v1", "skill")).not.toThrow();
    });
  });

  describe("invalid slugs", () => {
    it("should reject slug starting with hyphen", () => {
      expect(() => validateSlug("-skill", "skill")).toThrow(
        'Invalid skill: "-skill". Only letters, numbers, hyphens, dots, underscores allowed.',
      );
    });

    it("should reject slug ending with hyphen", () => {
      expect(() => validateSlug("skill-", "skill")).toThrow(
        'Invalid skill: "skill-". Only letters, numbers, hyphens, dots, underscores allowed.',
      );
    });

    it("should reject slug starting with dot", () => {
      expect(() => validateSlug(".skill", "skill")).toThrow(
        'Invalid skill: ".skill". Only letters, numbers, hyphens, dots, underscores allowed.',
      );
    });

    it("should reject slug ending with dot", () => {
      expect(() => validateSlug("skill.", "skill")).toThrow(
        'Invalid skill: "skill.". Only letters, numbers, hyphens, dots, underscores allowed.',
      );
    });

    it("should reject slug starting with underscore", () => {
      expect(() => validateSlug("_skill", "skill")).toThrow(
        'Invalid skill: "_skill". Only letters, numbers, hyphens, dots, underscores allowed.',
      );
    });

    it("should reject slug ending with underscore", () => {
      expect(() => validateSlug("skill_", "skill")).toThrow(
        'Invalid skill: "skill_". Only letters, numbers, hyphens, dots, underscores allowed.',
      );
    });

    it("should reject empty string", () => {
      expect(() => validateSlug("", "skill")).toThrow(
        'Invalid skill: "". Only letters, numbers, hyphens, dots, underscores allowed.',
      );
    });

    it("should reject slug with spaces", () => {
      expect(() => validateSlug("my skill", "skill")).toThrow(
        'Invalid skill: "my skill". Only letters, numbers, hyphens, dots, underscores allowed.',
      );
    });

    it("should reject slug with @ symbol", () => {
      expect(() => validateSlug("my@skill", "skill")).toThrow(
        'Invalid skill: "my@skill". Only letters, numbers, hyphens, dots, underscores allowed.',
      );
    });

    it("should reject slug with forward slash", () => {
      expect(() => validateSlug("my/skill", "skill")).toThrow(
        'Invalid skill: "my/skill". Only letters, numbers, hyphens, dots, underscores allowed.',
      );
    });

    it("should reject slug with backslash", () => {
      expect(() => validateSlug("my\\skill", "skill")).toThrow(
        'Invalid skill: "my\\skill". Only letters, numbers, hyphens, dots, underscores allowed.',
      );
    });

    it("should reject path traversal with ..", () => {
      expect(() => validateSlug("../skill", "skill")).toThrow(
        'Invalid skill: "../skill". Only letters, numbers, hyphens, dots, underscores allowed.',
      );
    });

    it("should reject slug with special characters", () => {
      expect(() => validateSlug("skill!", "skill")).toThrow(
        'Invalid skill: "skill!". Only letters, numbers, hyphens, dots, underscores allowed.',
      );
    });

    it("should reject slug with parentheses", () => {
      expect(() => validateSlug("skill(1)", "skill")).toThrow(
        'Invalid skill: "skill(1)". Only letters, numbers, hyphens, dots, underscores allowed.',
      );
    });

    it("should use custom label in error message", () => {
      expect(() => validateSlug("bad-name-", "provider")).toThrow(
        'Invalid provider: "bad-name-". Only letters, numbers, hyphens, dots, underscores allowed.',
      );
    });

    it("should reject slug exceeding max length of 128 characters", () => {
      const longSlug = "a".repeat(129);
      expect(() => validateSlug(longSlug, "skill name")).toThrow(
        /exceeds max length of 128 characters/,
      );
    });

    it("should accept slug at exactly 128 characters", () => {
      const maxSlug = "a".repeat(128);
      expect(() => validateSlug(maxSlug, "skill name")).not.toThrow();
    });
  });
});
