import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("learn hero", () => {
  it("does not load the doodle background as the first paint", () => {
    const page = readFileSync(join(__dirname, "..", "app", "learn", "page.tsx"), "utf8");
    expect(page).not.toContain("phase-background");
    expect(page).not.toContain("priority");
  });
});
