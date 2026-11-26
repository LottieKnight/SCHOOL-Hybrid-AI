import { getGrowthSnapshot } from "@/lib/server/growthDb";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Public read-only endpoint — numbers are safe to expose (no PII, only aggregates).
export async function GET() {
  try {
    const snapshot = await getGrowthSnapshot();
    return NextResponse.json(snapshot, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
      },
    });
  } catch {
    return NextResponse.json({ error: "Growth data unavailable." }, { status: 500 });
  }
}
