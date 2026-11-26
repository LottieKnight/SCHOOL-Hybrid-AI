import { NextResponse } from "next/server";
import { listModuleSummaries } from "@/lib/server/moduleContent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  const modules = listModuleSummaries();
  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    modules,
  });
}
