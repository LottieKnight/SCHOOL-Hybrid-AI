import { describe, expect, it } from "vitest";
import {
  PLANNER_UPLOAD_MAX_BYTES,
  sanitizePlannerFileName,
  validatePlannerUploadFile,
} from "../lib/plannerUploadValidation";

describe("planner upload validation", () => {
  it("accepts txt uploads", () => {
    expect(validatePlannerUploadFile("semester-plan.txt", "text/plain", 1024)).toEqual({
      ok: true,
      kind: "txt",
      extension: ".txt",
      mimeType: "text/plain",
    });
  });

  it("accepts pdf uploads", () => {
    expect(validatePlannerUploadFile("schedule.pdf", "application/pdf", 1024)).toEqual({
      ok: true,
      kind: "pdf",
      extension: ".pdf",
      mimeType: "application/pdf",
    });
  });

  it("accepts docx uploads", () => {
    expect(
      validatePlannerUploadFile(
        "module-outline.docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        1024
      )
    ).toEqual({
      ok: true,
      kind: "docx",
      extension: ".docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
  });

  it("accepts image uploads", () => {
    expect(validatePlannerUploadFile("module-schedule.png", "image/png", 1024)).toEqual({
      ok: true,
      kind: "image",
      extension: ".png",
      mimeType: "image/png",
    });
  });

  it("rejects unsupported file types", () => {
    expect(validatePlannerUploadFile("notes.zip", "application/zip", 1024)).toEqual({
      ok: false,
      error: "Only PDF, Word, text, or image files are accepted.",
    });
  });

  it("rejects files above the size limit", () => {
    expect(validatePlannerUploadFile("schedule.pdf", "application/pdf", PLANNER_UPLOAD_MAX_BYTES + 1)).toEqual({
      ok: false,
      error: "File must be under 10MB.",
    });
  });

  it("sanitizes file names for storage keys", () => {
    expect(sanitizePlannerFileName(" Module Plan (Final)#1 .pdf ")).toBe("Module-Plan-Final1-.pdf");
  });
});
