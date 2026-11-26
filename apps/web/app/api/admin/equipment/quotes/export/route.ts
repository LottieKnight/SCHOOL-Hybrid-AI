import { NextRequest, NextResponse } from "next/server";
import { requireAdminWebRoute } from "@/lib/equipmentAdminAuth";
import {
  EQUIPMENT_QUOTE_STATUSES,
  listEquipmentQuotes,
  type EquipmentQuoteStatus,
} from "@/lib/equipmentStoreServer";

function parseStatus(input: string | null): EquipmentQuoteStatus | "all" {
  if (!input || input === "all") return "all";
  return (EQUIPMENT_QUOTE_STATUSES as readonly string[]).includes(input)
    ? (input as EquipmentQuoteStatus)
    : "all";
}

function parseLimit(input: string | null) {
  if (!input) return 500;
  const value = Number(input);
  if (!Number.isFinite(value)) return 500;
  return Math.max(1, Math.min(1000, Math.floor(value)));
}

function parseDate(input: string | null) {
  if (!input) return null;
  const parsed = Date.parse(input);
  return Number.isFinite(parsed) ? input : null;
}

function escapeCsvCell(value: unknown) {
  const text = value == null ? "" : String(value);
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replace(/"/g, "\"\"")}"`;
}

function toCsv(rows: string[][]) {
  return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n");
}

export async function GET(request: NextRequest) {
  const auth = await requireAdminWebRoute(request);
  if (!auth.ok) return auth.response;

  try {
    const status = parseStatus(request.nextUrl.searchParams.get("status"));
    const from = parseDate(request.nextUrl.searchParams.get("from"));
    const to = parseDate(request.nextUrl.searchParams.get("to"));
    const limit = parseLimit(request.nextUrl.searchParams.get("limit"));

    const result = await listEquipmentQuotes({ status, from, to, limit });
    const rows: string[][] = [
      [
        "quote_id",
        "created_at",
        "status",
        "status_updated_at",
        "status_updated_by",
        "organization_name",
        "contact_email",
        "province",
        "currency",
        "subtotal_cents",
        "total_cents",
        "item_count",
        "item_slugs",
      ],
      ...result.quotes.map((quote) => [
        quote.id,
        quote.createdAt,
        quote.status,
        quote.statusUpdatedAt ?? "",
        quote.statusUpdatedBy ?? "",
        quote.requester.organizationName ?? "",
        quote.requester.contactEmail ?? "",
        quote.requester.province ?? "",
        quote.currency,
        String(quote.subtotalCents),
        String(quote.totalCents),
        String(quote.items.length),
        quote.items.map((item) => item.slug).join(";"),
      ]),
    ];

    const filename = `equipment-quotes-${new Date().toISOString().slice(0, 10)}.csv`;
    return new NextResponse(toCsv(rows), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to export equipment quotes" },
      { status: 500 }
    );
  }
}
