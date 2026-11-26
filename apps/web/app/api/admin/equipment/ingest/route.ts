import { NextRequest, NextResponse } from "next/server";
import { requireAdminWebRoute } from "@/lib/equipmentAdminAuth";
import { ingestEquipmentSeed } from "@/lib/equipmentStoreServer";

export async function POST(request: NextRequest) {
  const auth = await requireAdminWebRoute(request);
  if (!auth.ok) return auth.response;

  try {
    const result = await ingestEquipmentSeed();
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Equipment seed import failed" },
      { status: 500 }
    );
  }
}

