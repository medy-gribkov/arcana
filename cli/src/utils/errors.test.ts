import { describe, it, expect } from "vitest";
import { CliError } from "./errors.js";

describe("CliError", () => {
  it("should create error with default code and exitCode", () => {
    const error = new CliError("Something went wrong");
    expect(error.message).toBe("Something went wrong");
    expect(error.code).toBe("CLI_ERROR");
    expect(error.exitCode).toBe(1);
    expect(error.name).toBe("CliError");
  });

  it("should create error with custom code", () => {
    const error = new CliError("Invalid input", "VALIDATION_ERROR");
    expect(error.message).toBe("Invalid input");
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.exitCode).toBe(1);
    expect(error.name).toBe("CliError");
  });

  it("should create error with custom code and exitCode", () => {
    const error = new CliError("Not found", "NOT_FOUND", 127);
    expect(error.message).toBe("Not found");
    expect(error.code).toBe("NOT_FOUND");
    expect(error.exitCode).toBe(127);
    expect(error.name).toBe("CliError");
  });

  it("should be instanceof Error", () => {
    const error = new CliError("Test error");
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(CliError);
  });

  it("should have correct name property", () => {
    const error = new CliError("Test");
    expect(error.name).toBe("CliError");
  });

  it("should preserve stack trace", () => {
    const error = new CliError("Test error");
    expect(error.stack).toBeDefined();
    expect(error.stack).toContain("CliError");
  });

  it("should allow zero exitCode", () => {
    const error = new CliError("Warning", "WARN", 0);
    expect(error.exitCode).toBe(0);
  });
});
