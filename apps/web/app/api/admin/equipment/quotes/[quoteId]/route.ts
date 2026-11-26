import { NextRequest, NextResponse } from "next/server";
import { requireAdminWebRoute } from "@/lib/equipmentAdminAuth";
import {
  EQUIPMENT_QUOTE_STATUSES,
  updateEquipmentQuoteStatus,
  type EquipmentQuoteStatus,
} from "@/lib/equipmentStoreServer";

type RouteParams = {
  params: Promise<{ quoteId: string }>;
};

function parseStatus(input: unknown): EquipmentQuoteStatus | null {
  if (typeof input !== "string") return null;
  const status = input.trim().toLowerCase();
  return (EQUIPMENT_QUOTE_STATUSES as readonly string[]).includes(status)
    ? (status as EquipmentQuoteStatus)
    : null;
}

export async function PATCH(request: NextRequest, context: RouteParams) {
  const auth = await requireAdminWebRoute(request);
  if (!auth.ok) return auth.response;

  const { quoteId } = await context.params;
  if (!quoteId || typeof quoteId !== "string") {
    return NextResponse.json({ error: "Missing quote id" }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const status = parseStatus(body?.status);
  if (!status) {
    return NextResponse.json(
      {
        error: "Invalid status. Use one of: received, answered, closed.",
      },
      { status: 400 }
    );
  }

  const sessionAny = auth.session as { user?: { id?: unknown; email?: unknown } } | null;
  const updatedBy =
    typeof sessionAny?.user?.id === "string"
      ? sessionAny.user.id
      : typeof sessionAny?.user?.email === "string"
        ? sessionAny.user.email
        : null;

  const quote = await updateEquipmentQuoteStatus({
    quoteId: quoteId.trim(),
    status,
    updatedBy,
  });

  if (!quote) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }

  return NextResponse.json({ quote }, { status: 200 });
}
