import { NextResponse } from "next/server";
import { loadModuleDetail } from "@/lib/server/moduleContent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ moduleCode: string }> }) {
  const { moduleCode } = await params;
  const moduleData = loadModuleDetail(moduleCode.trim().toUpperCase());

  if (!moduleData) {
    return NextResponse.json({ error: "Module not found" }, { status: 404 });
  }

  return NextResponse.json(moduleData);
}
