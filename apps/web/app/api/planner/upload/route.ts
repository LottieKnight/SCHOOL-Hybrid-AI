import { NextRequest, NextResponse } from "next/server";
import { getBackendSessionFromRequest } from "@/lib/server/backendSession";
import { getLatestUniversityPlanForUser, insertUniversityPlan } from "@/lib/server/plannerDb";
import { storePlannerFile } from "@/lib/server/plannerStorage";
import { extractPlannerText, isPlannerTextExtractionError } from "@/lib/server/plannerText";
import {
  PLANNER_UPLOAD_MISSING_FILE_ERROR,
  sanitizePlannerFileName,
  validatePlannerUploadFile,
} from "@/lib/plannerUploadValidation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function buildPreview(text: string) {
  return text.replace(/\s+/g, " ").trim().slice(0, 500);
}

function normalizePlanResponse(plan: Awaited<ReturnType<typeof getLatestUniversityPlanForUser>>) {
  if (!plan) return null;
  return {
    id: plan.id,
    fileName: plan.fileName,
    fileKey: plan.fileKey,
    extractedText: plan.extractedText,
    uploadedAt: plan.uploadedAt,
    updatedAt: plan.updatedAt,
    preview: buildPreview(plan.extractedText),
  };
}

export async function GET(request: NextRequest) {
  const session = await getBackendSessionFromRequest(request);
  const userId = typeof session?.user?.id === "string" ? session.user.id : "";

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const plan = await getLatestUniversityPlanForUser(userId);
    return NextResponse.json({ success: true, plan: normalizePlanResponse(plan) });
  } catch {
    return NextResponse.json({ error: "Unable to load planner data." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getBackendSessionFromRequest(request);
  const userId = typeof session?.user?.id === "string" ? session.user.id : "";

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid upload payload." }, { status: 400 });
  }

  const manualTextValue = formData.get("manualText");
  const manualNameValue = formData.get("fileName");
  const fileValue = formData.get("file");

  const manualText = typeof manualTextValue === "string" ? manualTextValue.trim() : "";
  const manualName = typeof manualNameValue === "string" ? manualNameValue.trim() : "";

  try {
    if (manualText) {
      const plan = await insertUniversityPlan({
        userId,
        fileName: manualName || "Manual Plan",
        fileKey: null,
        extractedText: manualText,
      });

      return NextResponse.json({
        success: true,
        planId: plan.id,
        preview: buildPreview(plan.extractedText),
        plan: normalizePlanResponse(plan),
      });
    }

    if (!(fileValue instanceof File)) {
      return NextResponse.json({ error: PLANNER_UPLOAD_MISSING_FILE_ERROR }, { status: 400 });
    }

    const validation = validatePlannerUploadFile(fileValue.name, fileValue.type, fileValue.size);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const buffer = Buffer.from(await fileValue.arrayBuffer());
    const extractedText = await extractPlannerText(validation.kind, buffer, validation.mimeType);
    if (!extractedText) {
      return NextResponse.json({ error: "The uploaded file did not contain readable text." }, { status: 400 });
    }

    const stored = await storePlannerFile({
      userId,
      fileName: sanitizePlannerFileName(fileValue.name) || "planner-upload",
      contentType: validation.mimeType || fileValue.type || "application/octet-stream",
      body: buffer,
    });

    const plan = await insertUniversityPlan({
      userId,
      fileName: fileValue.name,
      fileKey: stored.key,
      extractedText,
    });

    return NextResponse.json({
      success: true,
      planId: plan.id,
      preview: buildPreview(plan.extractedText),
      plan: normalizePlanResponse(plan),
    });
  } catch (error) {
    if (isPlannerTextExtractionError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }
}
