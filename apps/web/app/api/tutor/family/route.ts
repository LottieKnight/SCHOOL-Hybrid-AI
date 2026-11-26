import { NextResponse } from "next/server";
import { resolveTutorUserId } from "@/lib/tutor/identity";
import { createFamilyLink } from "@/lib/tutor/persist";

export const runtime = "nodejs";

export async function POST() {
  const user = await resolveTutorUserId();
  if (!user.userId) return NextResponse.json({ error: "Start a tutor session first." }, { status: 401 });
  const link = await createFamilyLink(user.userId);
  return NextResponse.json({ path: `/family/${link.token}`, expiresAt: link.expiresAt });
}
