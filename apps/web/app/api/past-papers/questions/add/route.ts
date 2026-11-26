import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/pastPapers/db";
import { isAdminSession } from "@/lib/admin";
import { getBackendSessionFromRequest } from "@/lib/server/backendSession";

export async function POST(request: NextRequest) {
  const session = await getBackendSessionFromRequest(request);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdminSession(session)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const pastPaperId = typeof body.pastPaperId === "string" ? body.pastPaperId : null;
  const label = typeof body.label === "string" ? body.label.trim() : "";
  if (!pastPaperId || !label) {
    return NextResponse.json({ error: "Missing pastPaperId or label" }, { status: 400 });
  }

  const count = await db.count("PastPaperQuestion", { pastPaperId });
  const question = await db.create("PastPaperQuestion", {
    pastPaperId,
    qNumber: "Q" + String(count + 1),
    label,
    maxMarks: 5,
    orderIndex: count + 1,
  });

  return NextResponse.json({ question });
}
