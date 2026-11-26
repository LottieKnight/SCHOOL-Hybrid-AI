import { NextRequest, NextResponse } from "next/server";
import { getBackendSessionFromRequest } from "@/lib/server/backendSession";
import { queryPlannerDb, withPlannerDbClient } from "@/lib/server/plannerDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = await getBackendSessionFromRequest(request);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;
  const body = await request.json();
  const { itemKey } = body;

  if (itemKey !== "streak_freeze") return NextResponse.json({ error: "Invalid item" }, { status: 400 });

  const PRICE = 500; // 500 Scholar Credits

  try {
    await withPlannerDbClient(async (client) => {
      // 1. Check credits
      const walletRes = await client.query<{ balance_credits: number }>(
        `SELECT balance_credits FROM wallet_accounts WHERE user_id = $1`,
        [userId]
      );
      const balance = walletRes.rows[0]?.balance_credits ?? 0;

      if (balance < PRICE) throw new Error("Insufficient credits");

      // 2. Deduct credits
      await client.query(`UPDATE wallet_accounts SET balance_credits = balance_credits - $2 WHERE user_id = $1`, [userId, PRICE]);
      await client.query(
        `INSERT INTO wallet_ledger_entries (user_id, type, amount_credits, reason, ref_type, ref_id)
         VALUES ($1, 'DEBIT', $2, 'Purchased Streak Freeze', 'inventory_purchase', 'streak_freeze')`,
        [userId, PRICE]
      );

      // 3. Add to inventory
      await client.query(
        `INSERT INTO user_inventory (user_id, item_key, quantity) VALUES ($1, $2, 1)
         ON CONFLICT (user_id, item_key) DO UPDATE SET quantity = user_inventory.quantity + 1`,
        [userId, itemKey]
      );
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to purchase" }, { status: 500 });
  }
}
