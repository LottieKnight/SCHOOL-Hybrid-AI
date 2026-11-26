import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, verifyToken } from "@/lib/server/cookieAuth";
import { queryPlannerDb } from "@/lib/server/plannerDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;

function generateCode() {
  return Array.from(
    { length: CODE_LENGTH },
    () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  ).join("");
}

async function getOrCreateReferralCode(userId: string): Promise<string> {
  const existing = await queryPlannerDb<{ code: string }>(
    "SELECT code FROM referral_codes WHERE user_id = $1",
    [userId]
  );
  if (existing.rows.length > 0) return existing.rows[0].code;

  for (let attempt = 0; attempt < 20; attempt++) {
    const code = generateCode();
    const check = await queryPlannerDb<{ exists: boolean }>(
      "SELECT EXISTS(SELECT 1 FROM referral_codes WHERE code = $1) AS exists",
      [code]
    );
    if (!check.rows[0]?.exists) {
      await queryPlannerDb(
        "INSERT INTO referral_codes (user_id, code) VALUES ($1, $2) ON CONFLICT (user_id) DO NOTHING",
        [userId, code]
      );
      const result = await queryPlannerDb<{ code: string }>(
        "SELECT code FROM referral_codes WHERE user_id = $1",
        [userId]
      );
      return result.rows[0].code;
    }
  }
  throw new Error("Failed to generate unique referral code");
}

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const code = await getOrCreateReferralCode(payload.sub);
    const origin = process.env.NEXT_PUBLIC_APP_URL ?? "https://school.ditshego-ventures.co.za";
    const shareUrl = `${origin}/auth?ref=${encodeURIComponent(code)}`;

    return NextResponse.json({ code, shareUrl });
  } catch (error) {
    console.error("[referrals/my-code]", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
