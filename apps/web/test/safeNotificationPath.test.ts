import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { safeNotificationPath } from "@/lib/safeNotificationPath";

describe("notification open path", () => {
  it("keeps in-app paths", () => {
    expect(safeNotificationPath("/tutor?grade=12")).toBe("/tutor?grade=12");
  });

  it("drops off-site and protocol-relative targets", () => {
    expect(safeNotificationPath("https://evil.example/phish")).toBe("/");
    expect(safeNotificationPath("//evil.example")).toBe("/");
    expect(safeNotificationPath("javascript:alert(1)")).toBe("/");
  });

  it("is the same check the service worker uses", () => {
    const source = readFileSync(join(__dirname, "..", "public", "sw.js"), "utf8");
    expect(source).toContain('value.startsWith("/")');
    expect(source).toContain('value.startsWith("//")');
  });
});
