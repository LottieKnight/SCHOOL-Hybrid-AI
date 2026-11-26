import { NextRequest, NextResponse } from "next/server";
import { validateEquipmentCart } from "@/lib/equipmentStoreServer";

export async function POST(request: NextRequest) {
  try {
    const text = await request.text().catch(() => "");
    const body = text ? JSON.parse(text) : {};
    const result = await validateEquipmentCart(Array.isArray(body?.items) ? body.items : []);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to validate equipment quote basket" },
      { status: 400 }
    );
  }
}
