import { NextRequest, NextResponse } from "next/server";
import { requireAdminWebRoute } from "@/lib/equipmentAdminAuth";
import {
  deleteAdminEquipmentProductBySlug,
  listAdminEquipmentProducts,
  upsertAdminEquipmentProduct,
} from "@/lib/equipmentStoreServer";

async function readJsonBody(request: NextRequest) {
  const text = await request.text().catch(() => "");
  if (!text) return {};
  return JSON.parse(text);
}

export async function GET(request: NextRequest) {
  const auth = await requireAdminWebRoute(request);
  if (!auth.ok) return auth.response;

  try {
    const data = await listAdminEquipmentProducts();
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load equipment admin catalog" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminWebRoute(request);
  if (!auth.ok) return auth.response;
  try {
    const body = await readJsonBody(request);
    const result = await upsertAdminEquipmentProduct(body);
    return NextResponse.json(result, { status: result.created ? 201 : 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save equipment product" },
      { status: 400 }
    );
  }
}

export async function PUT(request: NextRequest) {
  return POST(request);
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdminWebRoute(request);
  if (!auth.ok) return auth.response;
  try {
    const slugFromQuery = request.nextUrl.searchParams.get("slug");
    const body = slugFromQuery ? {} : await readJsonBody(request);
    const slug = String(slugFromQuery || body?.slug || "")
      .trim()
      .toLowerCase();
    if (!slug) {
      return NextResponse.json({ error: "Missing slug" }, { status: 400 });
    }
    const deleted = await deleteAdminEquipmentProductBySlug(slug);
    if (!deleted) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, slug }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to delete equipment product" },
      { status: 400 }
    );
  }
}

