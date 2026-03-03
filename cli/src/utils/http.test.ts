import { describe, it, expect } from "vitest";
import { sanitizeUrl, HttpError, RateLimitError } from "./http.js";

describe("sanitizeUrl", () => {
  it("strips token query param", () => {
    const url = "https://api.github.com/repos?token=secret123&other=ok";
    const result = sanitizeUrl(url);
    expect(result).not.toContain("secret123");
    expect(result).toContain("token=***");
    expect(result).toContain("other=ok");
  });

  it("strips access_token query param", () => {
    const url = "https://api.example.com/data?access_token=mytoken";
    const result = sanitizeUrl(url);
    expect(result).not.toContain("mytoken");
    expect(result).toContain("access_token=***");
  });

  it("strips username and password", () => {
    const url = "https://user:pass@api.github.com/repos";
    const result = sanitizeUrl(url);
    expect(result).not.toContain("user");
    expect(result).not.toContain("pass");
    expect(result).toContain("***");
  });

  it("preserves clean URLs", () => {
    const url = "https://api.github.com/repos/owner/repo";
    expect(sanitizeUrl(url)).toBe("https://api.github.com/repos/owner/repo");
  });
});

describe("HttpError", () => {
  it("includes status code in message", () => {
    const err = new HttpError(404, "https://example.com/path");
    expect(err.message).toContain("404");
    expect(err.statusCode).toBe(404);
    expect(err.name).toBe("HttpError");
  });

  it("sanitizes URL in default message", () => {
    const err = new HttpError(500, "https://api.com?token=secret");
    expect(err.message).not.toContain("secret");
  });
});

describe("RateLimitError", () => {
  it("includes reset time", () => {
    const resetAt = new Date("2026-01-01T12:00:00Z");
    const err = new RateLimitError("https://api.github.com", resetAt);
    expect(err.message).toContain("rate limit");
    expect(err.statusCode).toBe(403);
    expect(err.name).toBe("RateLimitError");
  });

  it("handles null reset", () => {
    const err = new RateLimitError("https://api.github.com", null);
    expect(err.message).toContain("rate limit");
    expect(err.message).not.toContain("Resets at");
  });
});
