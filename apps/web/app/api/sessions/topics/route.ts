import { NextRequest, NextResponse } from "next/server";
import { getBackendSessionFromRequest } from "@/lib/server/backendSession";
import { storeTopicSignal } from "@/lib/server/sessionTopics";
import { parseTopicSignalBody } from "@/lib/sessionTopicSignal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = await getBackendSessionFromRequest(request);
  const userId = typeof session?.user?.id === "string" ? session.user.id : "";
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = parseTopicSignalBody(body, userId);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    await storeTopicSignal(parsed.value);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Unable to store topic signal." }, { status: 500 });
  }
}
