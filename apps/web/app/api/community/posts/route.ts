import { NextRequest, NextResponse } from "next/server";
import { createCommunityPost } from "@/lib/server/community";
import { getBackendSessionFromRequest } from "@/lib/server/backendSession";
import { getInstitutionContextForUser } from "@/lib/server/institutions";
import { getUserAppPreferences, readAcademicState } from "@/lib/server/userProfileState";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CreatePostBody = {
  moduleCode?: string;
  moduleName?: string;
  content?: string;
  postType?: string;
  isAnonymous?: boolean;
  pollOptions?: string[];
};

const ALLOWED_POST_TYPES = new Set(["general", "question", "resource", "poll"]);

export async function POST(request: NextRequest) {
  const session = await getBackendSessionFromRequest(request);
  const userId = typeof session?.user?.id === "string" ? session.user.id : "";

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as CreatePostBody | null;
  const moduleCode = typeof body?.moduleCode === "string" ? body.moduleCode.trim() : "";
  const moduleName = typeof body?.moduleName === "string" ? body.moduleName.trim() : "";
  const content = typeof body?.content === "string" ? body.content.trim() : "";
  const postType = typeof body?.postType === "string" ? body.postType.trim() : "general";

  if (!moduleCode || !content) {
    return NextResponse.json({ error: "Module code and content are required." }, { status: 400 });
  }

  if (content.length > 4000) {
    return NextResponse.json({ error: "Post content must be 4000 characters or less." }, { status: 400 });
  }

  if (!ALLOWED_POST_TYPES.has(postType)) {
    return NextResponse.json({ error: "Unsupported post type." }, { status: 400 });
  }

  const institutionContext = await getInstitutionContextForUser(userId).catch(() => null);
  const preferences = await getUserAppPreferences(userId).catch(() => ({}));
  const academicState = readAcademicState(preferences);

  const isAnonymous = Boolean(body?.isAnonymous);
  const pollOptions = Array.isArray(body?.pollOptions)
    ? (body.pollOptions as unknown[]).filter((o) => typeof o === "string").map((o) => (o as string).trim()).filter(Boolean)
    : undefined;

  const result = await createCommunityPost({
    userId,
    institutionId: institutionContext?.id ?? academicState.institutionId ?? null,
    institutionName: institutionContext?.name ?? academicState.institution ?? null,
    institutionShortName: institutionContext?.shortName ?? null,
    faculty: institutionContext?.faculty ?? academicState.faculty ?? null,
    moduleCode,
    moduleName: moduleName || null,
    content,
    postType: postType as "general" | "question" | "resource" | "poll",
    isAnonymous,
    pollOptions,
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ post: result.post }, { status: 201 });
}
