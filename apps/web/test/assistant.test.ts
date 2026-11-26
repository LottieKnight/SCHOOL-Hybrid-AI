import {
  getAssistantValidationError,
  isSpecificStudyQuestion,
  mapAssistantUpstreamError,
} from "../lib/assistant";
import { describe, expect, it } from "vitest";

describe("assistant validation", () => {
  it("accepts a short real question", () => {
    expect(isSpecificStudyQuestion("What is inflation?")).toBe(true);
    expect(getAssistantValidationError("What is inflation?")).toBeNull();
  });

  it("rejects very short non-questions", () => {
    expect(getAssistantValidationError("hi")).toBe(
      "Please paste at least a sentence of notes or a specific question."
    );
  });

  it("accepts every prompt the UI suggests to the user", () => {
    // These strings are the StudyChat suggestion chips. The app must never
    // suggest a prompt its own backend rejects with a 400.
    for (const suggestion of [
      "Summarise my notes",
      "Generate practice questions",
      "Explain a concept",
    ]) {
      expect(getAssistantValidationError(suggestion)).toBeNull();
    }
  });

  it("recognises imperative study commands as specific requests", () => {
    expect(isSpecificStudyQuestion("Summarise my notes")).toBe(true);
    expect(isSpecificStudyQuestion("list the causes of WWI")).toBe(true);
  });
});

describe("assistant upstream error mapping", () => {
  it("maps quota exhaustion to a friendly 503", () => {
    const mapped = mapAssistantUpstreamError(
      429,
      JSON.stringify({
        error: {
          code: "insufficient_quota",
          message: "You exceeded your current quota.",
        },
      })
    );

    expect(mapped).toEqual({
      status: 503,
      error: "The study assistant is temporarily unavailable because the AI quota is exhausted.",
    });
  });
});
