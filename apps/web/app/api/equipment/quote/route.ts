import { NextRequest, NextResponse } from "next/server";
import { createEquipmentQuoteRequest } from "@/lib/equipmentStoreServer";
import { parseAndGuardEquipmentQuoteRequest } from "@/lib/equipmentQuoteGuard";

export async function POST(request: NextRequest) {
  try {
    const guarded = await parseAndGuardEquipmentQuoteRequest(request);
    if (!guarded.ok) return guarded.response;

    const result = await createEquipmentQuoteRequest({
      items: guarded.payload.items,
      notes: guarded.payload.notes,
      requester: guarded.payload.requester,
      client: {
        ip: guarded.client.ip,
        userAgent: guarded.client.userAgent,
        source: guarded.payload.source || "web-quote-request",
      },
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to capture quote request" },
      { status: 400 }
    );
  }
}
