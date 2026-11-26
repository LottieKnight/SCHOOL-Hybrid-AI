import { NextRequest, NextResponse } from "next/server";
import { checkAiRateLimit } from "@/lib/aiRateLimit";
import { getBackendSessionFromRequest } from "@/lib/server/backendSession";
import { extractPlannerText, isPlannerTextExtractionError } from "@/lib/server/plannerText";
import {
  PLANNER_UPLOAD_MISSING_FILE_ERROR,
  validatePlannerUploadFile,
} from "@/lib/plannerUploadValidation";
import { clampExtractedText } from "@/lib/studyAttachment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function buildPreview(text: string) {
  return text.replace(/\s+/g, " ").trim().slice(0, 280);
}

// Accepts an uploaded image or PDF (plus DOCX/TXT) of study material and
// returns the readable text so it can be fed into the study assistant. The
// heavy lifting — validation, PDF parsing, and image OCR — reuses the same
// pipeline the planner uploader already relies on.
export async function POST(request: NextRequest) {
  const session = await getBackendSessionFromRequest(request);
  const userId = typeof session?.user?.id === "string" ? session.user.id : "";

  if (!userId) {
    return NextResponse.json(
      { error: "Sign in to attach files to your study session." },
      { status: 401 }
    );
  }

  const rateCheck = await checkAiRateLimit(userId);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment before uploading again." },
      { status: 429, headers: { "Retry-After": String(rateCheck.retryAfter) } }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid upload payload." }, { status: 400 });
  }

  const fileValue = formData.get("file");
  if (!(fileValue instanceof File)) {
    return NextResponse.json({ error: PLANNER_UPLOAD_MISSING_FILE_ERROR }, { status: 400 });
  }

  const validation = validatePlannerUploadFile(fileValue.name, fileValue.type, fileValue.size);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await fileValue.arrayBuffer());
    const extractedText = await extractPlannerText(validation.kind, buffer, validation.mimeType);
    if (!extractedText) {
      return NextResponse.json(
        { error: "We couldn't read any text from that file. Try a clearer image or a text-based PDF." },
        { status: 400 }
      );
    }

    const text = clampExtractedText(extractedText);
    return NextResponse.json({
      success: true,
      fileName: fileValue.name,
      kind: validation.kind,
      text,
      preview: buildPreview(text),
    });
  } catch (error) {
    if (isPlannerTextExtractionError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Couldn't process that file. Please try again." }, { status: 500 });
  }
}
