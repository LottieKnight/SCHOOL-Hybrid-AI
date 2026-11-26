import { NextRequest, NextResponse } from "next/server";
import { requireAdminWebRoute } from "@/lib/equipmentAdminAuth";
import {
  EQUIPMENT_QUOTE_STATUSES,
  listEquipmentQuotes,
  type EquipmentQuoteStatus,
} from "@/lib/equipmentStoreServer";

function parseStatus(input: string | null): EquipmentQuoteStatus | "all" {
  if (!input || input === "all") return "all";
  return (EQUIPMENT_QUOTE_STATUSES as readonly string[]).includes(input)
    ? (input as EquipmentQuoteStatus)
    : "all";
}

function parseLimit(input: string | null) {
  if (!input) return 120;
  const value = Number(input);
  if (!Number.isFinite(value)) return 120;
  return Math.max(1, Math.min(500, Math.floor(value)));
}

function parseDate(input: string | null) {
  if (!input) return null;
  const parsed = Date.parse(input);
  return Number.isFinite(parsed) ? input : null;
}

export async function GET(request: NextRequest) {
  const auth = await requireAdminWebRoute(request);
  if (!auth.ok) return auth.response;

  try {
    const status = parseStatus(request.nextUrl.searchParams.get("status"));
    const from = parseDate(request.nextUrl.searchParams.get("from"));
    const to = parseDate(request.nextUrl.searchParams.get("to"));
    const limit = parseLimit(request.nextUrl.searchParams.get("limit"));

    const result = await listEquipmentQuotes({ status, from, to, limit });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load equipment quotes" },
      { status: 500 }
    );
  }
}
