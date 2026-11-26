export const PLANNER_UPLOAD_MAX_BYTES = 10 * 1024 * 1024;

export const PLANNER_UPLOAD_ACCEPT_ATTR = ".pdf,.docx,.txt,.png,.jpg,.jpeg,.webp";
export const PLANNER_UPLOAD_FORMAT_PILLS = ["PDF", "DOCX", "TXT", "PNG", "JPG", "WEBP"] as const;
export const PLANNER_UPLOAD_HELPER_TEXT =
  "Accepts PDF, Word (.docx), plain text (.txt), or image files (.png, .jpg, .jpeg, .webp) - Max 10MB";
export const PLANNER_UPLOAD_INVALID_TYPE_ERROR = "Only PDF, Word, text, or image files are accepted.";
export const PLANNER_UPLOAD_MISSING_FILE_ERROR = "Please upload a PDF, Word, text, or image file.";

export const PLANNER_UPLOAD_TYPES = {
  pdf: {
    extensions: [".pdf"],
    mimeTypes: ["application/pdf"],
  },
  docx: {
    extensions: [".docx"],
    mimeTypes: [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/octet-stream",
      "",
    ],
  },
  txt: {
    extensions: [".txt"],
    mimeTypes: ["text/plain", "application/octet-stream", ""],
  },
  image: {
    extensions: [".png", ".jpg", ".jpeg", ".webp"],
    mimeTypes: ["image/png", "image/jpeg", "image/webp"],
  },
} as const;

export type PlannerUploadFileKind = keyof typeof PLANNER_UPLOAD_TYPES;

export type PlannerUploadValidation =
  | {
      ok: true;
      kind: PlannerUploadFileKind;
      extension: string;
      mimeType: string;
    }
  | {
      ok: false;
      error: string;
    };

export function getFileExtension(fileName: string) {
  const normalized = fileName.trim().toLowerCase();
  const index = normalized.lastIndexOf(".");
  return index >= 0 ? normalized.slice(index) : "";
}

export function sanitizePlannerFileName(fileName: string) {
  return fileName
    .trim()
    .replace(/[^\w.\- ]+/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
}

export function isPlannerImageUploadKind(kind: PlannerUploadFileKind) {
  return kind === "image";
}

const MIME_BY_EXTENSION: Record<string, string> = {
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".txt": "text/plain",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

export function validatePlannerUploadFile(fileName: string, mimeType: string, size: number): PlannerUploadValidation {
  if (size > PLANNER_UPLOAD_MAX_BYTES) {
    return {
      ok: false,
      error: "File must be under 10MB.",
    };
  }

  const extension = getFileExtension(fileName);
  const normalizedMime = mimeType.trim().toLowerCase();

  const match = (Object.entries(PLANNER_UPLOAD_TYPES) as Array<
    [PlannerUploadFileKind, (typeof PLANNER_UPLOAD_TYPES)[PlannerUploadFileKind]]
  >).find(([, config]) => {
    return (config.extensions as readonly string[]).includes(extension) ||
      (config.mimeTypes as readonly string[]).includes(normalizedMime);
  });

  if (!match) {
    return {
      ok: false,
      error: PLANNER_UPLOAD_INVALID_TYPE_ERROR,
    };
  }

  return {
    ok: true,
    kind: match[0],
    extension: extension || match[1].extensions[0],
    mimeType: normalizedMime || MIME_BY_EXTENSION[extension] || MIME_BY_EXTENSION[match[1].extensions[0]] || "",
  };
}
