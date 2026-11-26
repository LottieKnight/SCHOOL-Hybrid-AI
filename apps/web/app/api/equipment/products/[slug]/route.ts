import { NextRequest, NextResponse } from "next/server";
import { getEquipmentProductBySlug } from "@/lib/equipmentStoreServer";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const params = await context.params;
    const slug = String(params.slug || "").trim().toLowerCase();
    if (!slug) {
      return NextResponse.json({ error: "Missing slug" }, { status: 400 });
    }
    const product = await getEquipmentProductBySlug(slug);
    if (!product) {
      return NextResponse.json({ error: "Equipment product not found" }, { status: 404 });
    }
    return NextResponse.json({ product }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load equipment product" },
      { status: 500 }
    );
  }
}
