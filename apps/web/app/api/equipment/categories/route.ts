import { NextResponse } from "next/server";
import { listEquipmentCategories } from "@/lib/equipmentStoreServer";

export async function GET() {
  try {
    const categories = await listEquipmentCategories();
    return NextResponse.json({ categories }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load equipment categories" },
      { status: 500 }
    );
  }
}

