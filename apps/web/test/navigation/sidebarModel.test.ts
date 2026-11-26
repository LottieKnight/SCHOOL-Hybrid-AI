import { describe, expect, it } from "vitest";
import { activeSidebarId, moreLinks, phoneBarLinks, practiceLinks, studyLinks } from "@/lib/navigation/sidebarModel";

describe("sidebar model", () => {
  it("keeps the study group to four destinations", () => {
    expect(studyLinks.map((link) => link.id)).toEqual(["today", "learn", "papers", "tutor"]);
    expect(studyLinks.find((link) => link.id === "tutor")?.href).toBe("/tutor");
  });

  it("puts secondary tools behind More, not in the phone bar", () => {
    const phoneIds = phoneBarLinks.map((link) => link.id);
    expect(phoneIds).toEqual(["today", "learn", "papers"]);
    for (const link of moreLinks) {
      expect(phoneIds).not.toContain(link.id);
    }
    expect(practiceLinks.map((link) => link.id)).toEqual(["planner", "quiz", "community"]);
  });

  it("highlights the right group for deep routes", () => {
    expect(activeSidebarId("/learn/fet/grade-12")).toBe("learn");
    expect(activeSidebarId("/past-papers?grade=12")).toBe("papers");
    expect(activeSidebarId("/tutor")).toBe("tutor");
    expect(activeSidebarId("/assistant")).toBe("tutor");
    expect(activeSidebarId("/community/games")).toBe("games");
    expect(activeSidebarId("/dashboard")).toBe("today");
    expect(activeSidebarId("/dashboard/progress")).toBe("progress");
  });
});
