import { describe, expect, it } from "vitest";
import { buildFallbackConceptSlug, getMasteryBand, scoreMemoryRelevance } from "../lib/memoryShared";

describe("memory helpers", () => {
  it("maps mastery scores to qualitative bands", () => {
    expect(getMasteryBand(0.1)).toBe("Needs Review");
    expect(getMasteryBand(0.4)).toBe("Developing");
    expect(getMasteryBand(0.9)).toBe("Confident");
  });

  it("builds a short fallback concept slug from meaningful keywords", () => {
    expect(buildFallbackConceptSlug("Please explain leverage and working capital management")).toBe(
      "leverage-working-capital"
    );
    expect(buildFallbackConceptSlug("hi")).toBeNull();
  });

  it("scores memory relevance using the configured additive model", () => {
    expect(
      scoreMemoryRelevance({
        strugglingMatches: 1,
        recentMatches: 1,
        openedButNotCompleted: true,
        moduleMatch: true,
      })
    ).toBe(0.85);

    expect(
      scoreMemoryRelevance({
        strugglingMatches: 0,
        recentMatches: 0,
        openedButNotCompleted: false,
        moduleMatch: false,
      })
    ).toBe(0);
  });
});
