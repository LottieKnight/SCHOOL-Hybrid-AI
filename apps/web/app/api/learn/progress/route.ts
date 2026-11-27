import { NextRequest, NextResponse } from "next/server";
import { mergeProgressStores, parseProgressStore } from "@/lib/lessons/progress";
import { getBackendSessionFromRequest } from "@/lib/server/backendSession";
import { getUserAppPreferences, patchUserAppPreferences } from "@/lib/server/userProfileState";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 350_000;

async function requireUserId(request: NextRequest) {
  const session = await getBackendSessionFromRequest(request);
  return session?.user?.id || null;
}

export async function GET(request: NextRequest) {
  const userId = await requireUserId(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const preferences = await getUserAppPreferences(userId);
    return NextResponse.json({ store: parseProgressStore(preferences.learnProgress) });
  } catch {
    return NextResponse.json({ error: "Progress store unavailable" }, { status: 503 });
  }
}

export async function PUT(request: NextRequest) {
  const userId = await requireUserId(request);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const raw = body && typeof body === "object" && "store" in body ? (body as { store?: unknown }).store : null;
  if (!raw || typeof raw !== "object") {
    return NextResponse.json({ error: "Expected a progress store" }, { status: 400 });
  }
  if (JSON.stringify(raw).length > MAX_BYTES) {
    return NextResponse.json({ error: "Progress payload is too large" }, { status: 413 });
  }

  const incoming = parseProgressStore(raw);
  try {
    const preferences = await getUserAppPreferences(userId);
    const store = mergeProgressStores(parseProgressStore(preferences.learnProgress), incoming);
    await patchUserAppPreferences(userId, { learnProgress: store });
    return NextResponse.json({ store });
  } catch {
    return NextResponse.json({ error: "Progress store unavailable" }, { status: 503 });
  }
}
