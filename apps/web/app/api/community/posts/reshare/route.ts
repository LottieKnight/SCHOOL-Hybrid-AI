import { NextRequest, NextResponse } from "next/server";
import { createCommunityPost } from "@/lib/server/community";
import { getBackendSessionFromRequest } from "@/lib/server/backendSession";
import { getInstitutionContextForUser } from "@/lib/server/institutions";
import { getUserAppPreferences, readAcademicState } from "@/lib/server/userProfileState";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeModuleCode(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, "").trim().toUpperCase();
}

export async function POST(request: NextRequest) {
  const session = await getBackendSessionFromRequest(request);
  const userId = typeof session?.user?.id === "string" ? session.user.id : "";
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    moduleCode?: unknown;
    moduleName?: unknown;
    content?: unknown;
    sourceAuthor?: unknown;
  } | null;

  const moduleCode = normalizeModuleCode(typeof body?.moduleCode === "string" ? body.moduleCode : "");
  const moduleName = typeof body?.moduleName === "string" ? body.moduleName.trim() : "";
  const content = typeof body?.content === "string" ? body.content.trim() : "";
  const sourceAuthor = typeof body?.sourceAuthor === "string" ? body.sourceAuthor.trim() : "another student";

  if (!moduleCode || !content) {
    return NextResponse.json({ error: "Module code and content are required." }, { status: 400 });
  }

  const institutionContext = await getInstitutionContextForUser(userId).catch(() => null);
  const preferences = await getUserAppPreferences(userId).catch(() => ({}));
  const academicState = readAcademicState(preferences);
  const resharedContent = `Reshared from ${sourceAuthor} in ${moduleCode}\n\n${content}`;

  const result = await createCommunityPost({
    userId,
    institutionId: institutionContext?.id ?? academicState.institutionId ?? null,
    institutionName: institutionContext?.name ?? academicState.institution ?? null,
    institutionShortName: institutionContext?.shortName ?? null,
    faculty: institutionContext?.faculty ?? academicState.faculty ?? null,
    moduleCode,
    moduleName: moduleName || null,
    content: resharedContent,
    postType: "general",
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ post: result.post }, { status: 201 });
}
