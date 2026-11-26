import { NextRequest, NextResponse } from "next/server";
import { requireAdminWebRoute } from "@/lib/equipmentAdminAuth";
import { cleanupEquipmentQuotes } from "@/lib/equipmentStoreServer";

function parseOlderThanDays(input: unknown) {
  if (input == null) return null;
  const value = Number(input);
  if (!Number.isFinite(value)) return null;
  return Math.floor(value);
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminWebRoute(request);
  if (!auth.ok) return auth.response;

  const queryValue = request.nextUrl.searchParams.get("olderThanDays");
  const body = await request.json().catch(() => ({}));
  const bodyValue = body && typeof body === "object" ? (body as { olderThanDays?: unknown }).olderThanDays : null;
  const parsed = parseOlderThanDays(queryValue ?? bodyValue);

  if (parsed !== null && (parsed < 1 || parsed > 365)) {
    return NextResponse.json(
      { error: "olderThanDays must be between 1 and 365." },
      { status: 400 }
    );
  }

  const result = await cleanupEquipmentQuotes({ olderThanDays: parsed });
  return NextResponse.json(result, { status: 200 });
}

