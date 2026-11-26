import { describe, expect, it } from "vitest";
import {
  clampExtractedText,
  composeStudyMaterial,
  STUDY_ATTACHMENT_MAX_TEXT_LENGTH,
} from "../lib/studyAttachment";

describe("composeStudyMaterial", () => {
  it("uses the prompt alone when there is no extracted text", () => {
    expect(composeStudyMaterial("Explain photosynthesis", "")).toBe("Explain photosynthesis");
  });

  it("uses the extracted text alone when there is no prompt", () => {
    expect(composeStudyMaterial("   ", "Cell respiration converts glucose into ATP.")).toBe(
      "Cell respiration converts glucose into ATP."
    );
  });

  it("leads with the prompt and labels the attached material with the file name", () => {
    expect(
      composeStudyMaterial("Summarise this", "Newton's laws of motion.", "physics-notes.pdf")
    ).toBe("Summarise this\n\nMaterial from physics-notes.pdf:\nNewton's laws of motion.");
  });

  it("falls back to a generic label when no file name is given", () => {
    expect(composeStudyMaterial("Make a quiz", "Supply and demand.")).toBe(
      "Make a quiz\n\nAttached material:\nSupply and demand."
    );
  });

  it("returns an empty string when both inputs are empty", () => {
    expect(composeStudyMaterial("", "")).toBe("");
  });
});

describe("clampExtractedText", () => {
  it("trims surrounding whitespace", () => {
    expect(clampExtractedText("  hello world  ")).toBe("hello world");
  });

  it("caps text at the maximum length", () => {
    const long = "a".repeat(STUDY_ATTACHMENT_MAX_TEXT_LENGTH + 500);
    expect(clampExtractedText(long).length).toBe(STUDY_ATTACHMENT_MAX_TEXT_LENGTH);
  });
});
