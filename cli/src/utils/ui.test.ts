import { describe, it, expect } from "vitest";
import { getErrorHint } from "./ui.js";

describe("getErrorHint", () => {
  it("returns network hint for ECONNREFUSED", () => {
    const err = new Error("connect ECONNREFUSED 127.0.0.1:443");
    const hint = getErrorHint(err);
    expect(hint).toContain("internet connection");
  });

  it("returns network hint for ETIMEDOUT", () => {
    const err = new Error("connect ETIMEDOUT");
    expect(getErrorHint(err)).toContain("internet connection");
  });

  it("returns 404 hint for Not Found", () => {
    const err = new Error("HTTP 404 Not Found");
    expect(getErrorHint(err)).toContain("search");
  });

  it("returns undefined for random error", () => {
    const err = new Error("Something went wrong");
    expect(getErrorHint(err)).toBeUndefined();
  });

  it("returns undefined for non-Error", () => {
    expect(getErrorHint("string error")).toBeUndefined();
    expect(getErrorHint(42)).toBeUndefined();
    expect(getErrorHint(null)).toBeUndefined();
  });

  it("returns hint for ENOTFOUND", () => {
    const err = new Error("getaddrinfo ENOTFOUND api.github.com");
    expect(getErrorHint(err)).toContain("internet connection");
  });
});
