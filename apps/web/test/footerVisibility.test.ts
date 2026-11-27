import { describe, expect, it } from "vitest";
import {
  COMPANY_LINKS,
  COMPANY_REGISTRATION,
  companyRegistrationLine,
  shouldShowCompanyFooter,
} from "../lib/shell/companyFooter";

describe("company footer visibility", () => {
  it("keeps the full footer on the marketing homepage and features", () => {
    expect(shouldShowCompanyFooter("/")).toBe(true);
    expect(shouldShowCompanyFooter("/features")).toBe(true);
    expect(shouldShowCompanyFooter("/features/campus")).toBe(true);
  });

  it("hides the company footer on app screens", () => {
    for (const path of ["/tutor", "/past-papers", "/past-papers/abc", "/learn", "/learn/fet", "/dashboard", "/settings", "/legal/terms", "/legal/privacy", "/legal/paia"]) {
      expect(shouldShowCompanyFooter(path)).toBe(false);
    }
  });

  it("ignores query strings and keeps legal links reachable", () => {
    expect(shouldShowCompanyFooter("/tutor?mode=hints")).toBe(false);
    expect(shouldShowCompanyFooter("/?ref=1")).toBe(true);
    expect(COMPANY_LINKS.map((link) => link.label)).toEqual(
      expect.arrayContaining(["Terms", "Privacy", "PAIA"])
    );
    expect(companyRegistrationLine(2026)).toContain(COMPANY_REGISTRATION);
    expect(companyRegistrationLine(2026)).toContain("DITSHEGO VENTURES");
  });
});
