import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter } from "node:events";

// Mock the https module before imports
const { mockGet, MockAgent } = vi.hoisted(() => {
  class MockAgent {}
  return { mockGet: vi.fn(), MockAgent };
});

vi.mock("node:https", () => ({
  default: {
    Agent: MockAgent,
    get: (...args: unknown[]) => mockGet(...args),
  },
  Agent: MockAgent,
  get: (...args: unknown[]) => mockGet(...args),
}));

import { sanitizeUrl, HttpError, RateLimitError, httpGet } from "./http.js";

beforeEach(() => {
  vi.clearAllMocks();
});

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
    expect(result).not.toContain("user:pass");
    expect(result).toContain("***");
  });

  it("preserves clean URLs", () => {
    const url = "https://api.github.com/repos/owner/repo";
    expect(sanitizeUrl(url)).toBe("https://api.github.com/repos/owner/repo");
  });

  it("handles invalid URLs with fallback regex", () => {
    const url = "not-a-url?token=secret";
    const result = sanitizeUrl(url);
    expect(result).not.toContain("secret");
    expect(result).toContain("token=***");
  });
});

describe("HttpError", () => {
  it("includes status code in message", () => {
    const err = new HttpError(404, "https://example.com/path");
    expect(err.message).toContain("404");
    expect(err.statusCode).toBe(404);
    expect(err.name).toBe("HttpError");
    expect(err.url).toBe("https://example.com/path");
  });

  it("sanitizes URL in default message", () => {
    const err = new HttpError(500, "https://api.com?token=secret");
    expect(err.message).not.toContain("secret");
  });

  it("uses custom message when provided", () => {
    const err = new HttpError(418, "https://example.com", "I'm a teapot");
    expect(err.message).toBe("I'm a teapot");
  });
});

describe("RateLimitError", () => {
  it("includes reset time", () => {
    const resetAt = new Date("2026-01-01T12:00:00Z");
    const err = new RateLimitError("https://api.github.com", resetAt);
    expect(err.message).toContain("rate limit");
    expect(err.statusCode).toBe(403);
    expect(err.name).toBe("RateLimitError");
    expect(err.resetAt).toEqual(resetAt);
  });

  it("handles null reset", () => {
    const err = new RateLimitError("https://api.github.com", null);
    expect(err.message).toContain("rate limit");
    expect(err.message).not.toContain("Resets at");
    expect(err.resetAt).toBeNull();
  });
});

function createMockResponse(statusCode: number, body: string, headers: Record<string, string> = {}) {
  const res = new EventEmitter();
  Object.assign(res, { statusCode, headers });
  setTimeout(() => {
    res.emit("data", Buffer.from(body));
    res.emit("end");
  }, 0);
  return res;
}

describe("httpGet", () => {
  it("returns response for successful GET", async () => {
    mockGet.mockImplementation((_url: string, _opts: unknown, cb: (res: unknown) => void) => {
      cb(createMockResponse(200, '{"ok":true}', { "content-type": "application/json" }));
      return new EventEmitter();
    });

    const result = await httpGet("https://api.github.com/test", 5000);
    expect(result.statusCode).toBe(200);
    expect(result.body).toContain("ok");
  });

  it("throws HttpError for 404", async () => {
    mockGet.mockImplementation((_url: string, _opts: unknown, cb: (res: unknown) => void) => {
      cb(createMockResponse(404, "Not Found"));
      return new EventEmitter();
    });

    await expect(httpGet("https://api.github.com/missing", 5000)).rejects.toThrow(HttpError);
  });

  it("throws RateLimitError when rate limited", async () => {
    mockGet.mockImplementation((_url: string, _opts: unknown, cb: (res: unknown) => void) => {
      cb(
        createMockResponse(403, "limited", {
          "x-ratelimit-limit": "60",
          "x-ratelimit-remaining": "0",
          "x-ratelimit-reset": String(Math.floor(Date.now() / 1000) + 3600),
        }),
      );
      return new EventEmitter();
    });

    await expect(httpGet("https://api.github.com/data", 5000)).rejects.toThrow(RateLimitError);
  });

  it("retries on transient errors", async () => {
    let callCount = 0;
    mockGet.mockImplementation((_url: string, _opts: unknown, cb: (res: unknown) => void) => {
      callCount++;
      if (callCount < 3) {
        cb(createMockResponse(503, "Service Unavailable"));
      } else {
        cb(createMockResponse(200, "ok"));
      }
      return new EventEmitter();
    });

    const result = await httpGet("https://api.github.com/test", 5000);
    expect(result.statusCode).toBe(200);
    expect(callCount).toBe(3);
  });

  it("handles network errors with retries", async () => {
    let callCount = 0;
    mockGet.mockImplementation((_url: string, _opts: unknown, _cb: (res: unknown) => void) => {
      callCount++;
      const req = new EventEmitter();
      setTimeout(() => {
        const err = new Error("connect ECONNREFUSED") as NodeJS.ErrnoException;
        err.code = "ECONNREFUSED";
        req.emit("error", err);
      }, 0);
      return req;
    });

    await expect(httpGet("https://api.github.com/data", 1000)).rejects.toThrow("ECONNREFUSED");
    expect(callCount).toBeGreaterThan(1);
  });

  it("handles timeout", async () => {
    mockGet.mockImplementation((_url: string, _opts: unknown, _cb: (res: unknown) => void) => {
      const req = new EventEmitter();
      Object.assign(req, { destroy: vi.fn() });
      setTimeout(() => req.emit("timeout"), 0);
      return req;
    });

    await expect(httpGet("https://api.github.com/data", 100)).rejects.toThrow("timed out");
  });

  it("follows redirects", async () => {
    let callCount = 0;
    mockGet.mockImplementation((url: string, _opts: unknown, cb: (res: unknown) => void) => {
      callCount++;
      if (callCount === 1) {
        const res = new EventEmitter();
        Object.assign(res, {
          statusCode: 302,
          headers: { location: "https://raw.githubusercontent.com/final" },
        });
        setTimeout(() => res.emit("end"), 0);
        cb(res);
      } else {
        cb(createMockResponse(200, "final content"));
      }
      return new EventEmitter();
    });

    const result = await httpGet("https://github.com/redirect", 5000);
    expect(result.body).toContain("final content");
    expect(callCount).toBe(2);
  });
});
