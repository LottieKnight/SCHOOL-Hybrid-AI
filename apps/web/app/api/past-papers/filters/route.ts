import { NextResponse } from "next/server";
import { getCatalogFilterOptions } from "@/lib/pastPapers/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const filters = await getCatalogFilterOptions();
  return NextResponse.json(filters);
}
