import { describe, expect, it } from "vitest";
import {
  isLearnerNavActive,
  learnerNavItems,
  learnerPrimaryAction,
  resolveLearnerNavDisplayId,
  resolveLearnerNavId,
} from "@/lib/navigation/navManifest";

describe("learner navigation manifest", () => {
  it("keeps the primary destinations in a stable five-item order", () => {
    expect(learnerNavItems.map((item) => item.id)).toEqual([
      "dashboard",
      "learn",
      "practice",
      "community",
      "profile",
    ]);
  });

  it("keeps AI Tutor outside the tab bar", () => {
    expect(learnerNavItems.some((item) => item.href === learnerPrimaryAction.href)).toBe(false);
    expect(learnerPrimaryAction).toMatchObject({
      id: "assistant",
      label: "Hybrid tutor",
      href: "/tutor",
    });
  });

  it("resolves deep routes to the correct active section", () => {
    expect(resolveLearnerNavId("/learn/wves312")).toBe("learn");
    expect(resolveLearnerNavId("/phase/foundation")).toBe("learn");
    expect(resolveLearnerNavId("/past-papers?grade=12")).toBe("practice");
    expect(resolveLearnerNavId("/community/games")).toBe("community");
    expect(resolveLearnerNavId("/profile/learning")).toBe("profile");
  });

  it("keeps assistant routes outside the primary section set", () => {
    expect(resolveLearnerNavId("/assistant")).toBeNull();
    expect(isLearnerNavActive("dashboard", "/dashboard")).toBe(true);
    expect(isLearnerNavActive("profile", "/settings")).toBe(true);
  });

  it("preserves the last known tab highlight on secondary routes", () => {
    expect(resolveLearnerNavDisplayId("/assistant", "learn")).toBe("learn");
    expect(resolveLearnerNavDisplayId("/planner", "dashboard")).toBe("dashboard");
    expect(resolveLearnerNavDisplayId("/profile/learning", null)).toBe("profile");
  });
});
