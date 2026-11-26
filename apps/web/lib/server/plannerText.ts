import "server-only";

import { isPlannerImageUploadKind, type PlannerUploadFileKind } from "@/lib/plannerUploadValidation";

const OPENAI_API_BASE =
  process.env.OPENAI_API_BASE && process.env.OPENAI_API_BASE.trim().length > 0
    ? process.env.OPENAI_API_BASE.replace(/\/+$/, "")
    : "https://api.openai.com/v1";

const OPENAI_MODEL =
  process.env.OPENAI_MODEL && process.env.OPENAI_MODEL.trim().length > 0
    ? process.env.OPENAI_MODEL
    : "gpt-4o-mini";

const IMAGE_OCR_NO_TEXT_SENTINEL = "NO_TEXT";

type OpenAIChatResponse = {
  choices?: Array<{
    message?: {
      content?:
        | string
        | Array<{
            type?: string;
            text?: string;
          }>;
    };
  }>;
};

type OpenAIMessageContent = string | Array<{ type?: string; text?: string }> | undefined;

export class PlannerTextExtractionError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "PlannerTextExtractionError";
    this.status = status;
  }
}

export function isPlannerTextExtractionError(error: unknown): error is PlannerTextExtractionError {
  return error instanceof PlannerTextExtractionError;
}

function extractMessageText(content: OpenAIMessageContent) {
  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => (part && typeof part.text === "string" ? part.text : ""))
      .join("\n")
      .trim();
  }

  return "";
}

async function extractTextFromImage(buffer: Buffer, mimeType: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new PlannerTextExtractionError(
      "Image uploads need OPENAI_API_KEY configured on the server so SCHOOL can read text from the image.",
      500
    );
  }

  let response: Response;
  try {
    response = await fetch(`${OPENAI_API_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: 0,
        max_tokens: 1600,
        messages: [
          {
            role: "system",
            content:
              "You extract text from academic planner documents. Return only the readable text from the image, preserving line breaks where helpful. If the image does not contain readable text, return exactly NO_TEXT.",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  "Transcribe all readable academic-planner text from this image. Do not summarize. Do not explain. Return only the extracted text. If you cannot read any useful text, return exactly NO_TEXT.",
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${buffer.toString("base64")}`,
                },
              },
            ],
          },
        ],
      }),
    });
  } catch {
    throw new PlannerTextExtractionError("Image text extraction is temporarily unavailable. Please try again.", 502);
  }

  if (!response.ok) {
    throw new PlannerTextExtractionError(
      "Image text extraction failed at the AI provider. Please try again with a clearer image or use PDF, DOCX, or TXT.",
      502
    );
  }

  const payload = (await response.json().catch(() => ({}))) as OpenAIChatResponse;
  const extractedText = extractMessageText(payload.choices?.[0]?.message?.content).trim();

  if (!extractedText || extractedText === IMAGE_OCR_NO_TEXT_SENTINEL) {
    return "";
  }

  return extractedText;
}

export async function extractPlannerText(kind: PlannerUploadFileKind, buffer: Buffer, mimeType = "") {
  if (kind === "txt") {
    return buffer.toString("utf8").trim();
  }

  if (kind === "pdf") {
    const pdfModule = await import("pdf-parse");
    const pdfParse = pdfModule.default;
    const result = await pdfParse(buffer);
    return result.text.trim();
  }

  if (kind === "docx") {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return result.value.trim();
  }

  if (isPlannerImageUploadKind(kind)) {
    return extractTextFromImage(buffer, mimeType || "image/png");
  }

  return "";
}
