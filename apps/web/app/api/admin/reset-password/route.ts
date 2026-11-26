import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { findUserByEmail } from "@/lib/server/authDb";
import { queryPlannerDb } from "@/lib/server/plannerDb";
import { verifyToken, COOKIE_NAME } from "@/lib/server/cookieAuth";

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get(COOKIE_NAME)?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload?.sub || payload.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const email = typeof body?.email === "string" ? body.email.toLowerCase().trim() : "";
    const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";

    if (!email || newPassword.length < 8) {
      return NextResponse.json(
        { error: "email and newPassword (min 8 chars) are required" },
        { status: 400 }
      );
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await queryPlannerDb("UPDATE users SET password_hash = $1 WHERE id = $2", [hash, user.id]);

    console.info("[admin/reset-password] reset password for user", user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[admin/reset-password]", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: "Service temporarily unavailable." }, { status: 503 });
  }
}
