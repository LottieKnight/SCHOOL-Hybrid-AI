import { NextRequest, NextResponse } from "next/server";
import { resetMemoryPersonalization } from "@/lib/memory";
import { getBackendSessionFromRequest } from "@/lib/server/backendSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ResetBody = {
  concept_key?: unknown;
  module_code?: unknown;
};

export async function POST(request: NextRequest) {
  const session = await getBackendSessionFromRequest(request);
  const userId = typeof session?.user?.id === "string" ? session.user.id : "";
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: ResetBody;
  try {
    body = (await request.json()) as ResetBody;
  } catch {
    body = {};
  }

  const result = await resetMemoryPersonalization(userId, {
    conceptKey: typeof body.concept_key === "string" ? body.concept_key : null,
    moduleCode: typeof body.module_code === "string" ? body.module_code : null,
  });

  if (!result.success) {
    return NextResponse.json({ error: "Unable to reset learning memory." }, { status: 500 });
  }

  return NextResponse.json({ success: true, resetCount: result.resetCount });
}
