import { NextRequest, NextResponse } from "next/server";
import { listEquipmentProducts } from "@/lib/equipmentStoreServer";

function parseIntParam(value: string | null, fallback?: number) {
  if (value == null || value === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? Math.floor(n) : fallback;
}

export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.get("q") || undefined;
    const category = request.nextUrl.searchParams.get("category") || undefined;
    const phase = request.nextUrl.searchParams.get("phase") || undefined;
    const subject = request.nextUrl.searchParams.get("subject") || undefined;
    const fulfillment = request.nextUrl.searchParams.get("fulfillment") || undefined;
    const priceType = (request.nextUrl.searchParams.get("priceType") as "all" | "free" | "paid" | null) || "all";
    const slugs = (request.nextUrl.searchParams.get("slugs") || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    const result = await listEquipmentProducts({
      q,
      category,
      phase,
      subject,
      fulfillment,
      priceType,
      grade: parseIntParam(request.nextUrl.searchParams.get("grade"), undefined),
      minPriceCents: parseIntParam(request.nextUrl.searchParams.get("minPriceCents"), undefined),
      maxPriceCents: parseIntParam(request.nextUrl.searchParams.get("maxPriceCents"), undefined),
      page: parseIntParam(request.nextUrl.searchParams.get("page"), 1),
      pageSize: parseIntParam(request.nextUrl.searchParams.get("pageSize"), 24),
      slugs: slugs.length ? slugs : undefined,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load equipment catalog" },
      { status: 500 }
    );
  }
}

