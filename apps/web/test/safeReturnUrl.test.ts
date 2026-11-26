import { describe, test, expect } from "vitest";
import { safeReturnUrl, DEFAULT_RETURN_URL } from "../lib/safeReturnUrl.js";

describe("safeReturnUrl", () => {
  test("accepts a same-origin relative path", () => {
    expect(safeReturnUrl("/dashboard")).toBe("/dashboard");
    expect(safeReturnUrl("/planner?tab=week")).toBe("/planner?tab=week");
  });

  test.each([
    ["//evil.com", "protocol-relative"],
    ["/\\evil.com", "backslash bypass"],
    ["/%5Cevil.com", "encoded-backslash bypass"],
    ["https://evil.com", "absolute http(s)"],
    ["evil.com", "no leading slash"],
    ["javascript:alert(1)", "scheme injection"],
    ["", "empty"],
  ])("rejects %s (%s) and returns the fallback", (input) => {
    expect(safeReturnUrl(input)).toBe(DEFAULT_RETURN_URL);
  });

  test("returns the fallback for null/undefined", () => {
    expect(safeReturnUrl(null)).toBe(DEFAULT_RETURN_URL);
    expect(safeReturnUrl(undefined)).toBe(DEFAULT_RETURN_URL);
  });

  test("honours a custom fallback for unsafe input", () => {
    expect(safeReturnUrl("//evil.com", "/home")).toBe("/home");
  });
});
