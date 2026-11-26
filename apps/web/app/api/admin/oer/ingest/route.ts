import { NextRequest, NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/csrf";

function getApiBase() {
  return process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }

  const bodyText = await request.text().catch(() => "");
  const response = await fetch(`${getApiBase()}/admin/oer/ingest`, {
    method: "POST",
    headers: {
      "content-type": request.headers.get("content-type") || "application/json",
      cookie: request.headers.get("cookie") || "",
      "x-csrf-token": request.headers.get("x-csrf-token") || "",
    },
    body: bodyText || "{}",
    cache: "no-store",
  }).catch(() => null);

  if (!response) {
    return NextResponse.json({ error: "Unable to reach API" }, { status: 502 });
  }

  const text = await response.text().catch(() => "");
  const contentType = response.headers.get("content-type") || "application/json";
  return new NextResponse(text || "{}", {
    status: response.status,
    headers: {
      "content-type": contentType,
    },
  });
}
