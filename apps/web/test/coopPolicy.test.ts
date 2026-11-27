import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { CROSS_ORIGIN_OPENER_POLICY, crossOriginOpenerPolicyForPath } from "@/lib/coopPolicy";
import { middleware } from "../middleware";

const AUTH_PATHS = ["/login", "/signup", "/register", "/settings", "/onboarding"];

describe("Cross-Origin-Opener-Policy", () => {
  it("keeps the Google popup channel open on the entry screens", () => {
    expect(CROSS_ORIGIN_OPENER_POLICY).toBe("same-origin-allow-popups");
    for (const path of AUTH_PATHS) {
      expect(crossOriginOpenerPolicyForPath(path)).toBe("same-origin-allow-popups");
      expect(crossOriginOpenerPolicyForPath(path)).not.toBe("same-origin");
    }
    expect(crossOriginOpenerPolicyForPath("/dashboard")).toBe("same-origin-allow-popups");
  });

  it("sets the header from middleware and does not bounce a cookieless visit back to login", () => {
    for (const path of ["/login", "/dashboard", "/onboarding", "/signup"]) {
      const response = middleware(new NextRequest(`https://school.ditshego-ventures.co.za${path}`));
      expect(response.headers.get("Cross-Origin-Opener-Policy")).toBe("same-origin-allow-popups");
      expect(response.headers.get("location")).toBeNull();
    }
  });

  it("declares the same popup policy in next.config", () => {
    const source = readFileSync(new URL("../next.config.mjs", import.meta.url), "utf8");
    expect(source).toContain('key: "Cross-Origin-Opener-Policy"');
    expect(source).toContain('value: "same-origin-allow-popups"');
    expect(source).not.toContain('value: "same-origin"');
  });
});
