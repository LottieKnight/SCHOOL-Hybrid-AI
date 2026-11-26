import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { shouldPlaySplashSound, shouldSkipSplash } from "@/lib/splashPolicy";

const open = {
  reducedMotion: false,
  saveData: false,
  effectiveType: "4g",
  liteMode: false,
  alreadySeenThisSession: false,
};

describe("splash policy", () => {
  it("shows the splash on a first visit with a normal connection", () => {
    expect(shouldSkipSplash(open)).toBe(false);
  });

  it("skips the splash when data saver, 2g, lite mode, reduced motion, or a return in this session", () => {
    expect(shouldSkipSplash({ ...open, saveData: true })).toBe(true);
    expect(shouldSkipSplash({ ...open, effectiveType: "2g" })).toBe(true);
    expect(shouldSkipSplash({ ...open, liteMode: true })).toBe(true);
    expect(shouldSkipSplash({ ...open, reducedMotion: true })).toBe(true);
    expect(shouldSkipSplash({ ...open, alreadySeenThisSession: true })).toBe(true);
  });

  it("does not play a sound unless the learner turned it on", () => {
    expect(shouldPlaySplashSound(null)).toBe(false);
    expect(shouldPlaySplashSound("muted")).toBe(false);
    expect(shouldPlaySplashSound("on")).toBe(true);
  });

  it("keeps past-paper pages in the offline navigation cache", () => {
    const source = readFileSync(join(__dirname, "..", "public", "sw.js"), "utf8");
    expect(source).toContain('path.startsWith("/past-papers/")');
  });
});
