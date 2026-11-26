import { NextRequest, NextResponse } from "next/server";
import { getBackendSessionFromRequest } from "@/lib/server/backendSession";
import { queryPlannerDb, withPlannerDbClient } from "@/lib/server/plannerDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = await getBackendSessionFromRequest(request);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const body = await request.json();
  const { postId, amount } = body;

  if (!postId || typeof amount !== "number" || amount <= 0) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    await withPlannerDbClient(async (client) => {
      // 1. Check wallet balance
      const walletRes = await client.query<{ balance_credits: number }>(
        `SELECT balance_credits FROM wallet_accounts WHERE user_id = $1`,
        [userId]
      );
      const balance = walletRes.rows[0]?.balance_credits ?? 0;

      if (balance < amount) {
        throw new Error("Insufficient credits");
      }

      // 2. Escrow credits (Deduct from wallet)
      await client.query(
        `UPDATE wallet_accounts SET balance_credits = balance_credits - $2 WHERE user_id = $1`,
        [userId, amount]
      );

      await client.query(
        `INSERT INTO wallet_ledger_entries (user_id, type, amount_credits, reason, ref_type, ref_id)
         VALUES ($1, 'DEBIT', $2, $3, 'knowledge_bounty', $4)`,
        [userId, amount, `Knowledge Bounty for post ${postId}`, postId]
      );

      // 3. Record bounty
      await client.query(
        `INSERT INTO knowledge_bounties (post_id, user_id, amount_credits) VALUES ($1, $2, $3)
         ON CONFLICT (post_id) DO UPDATE SET amount_credits = knowledge_bounties.amount_credits + EXCLUDED.amount_credits`,
        [postId, userId, amount]
      );
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to place bounty:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
