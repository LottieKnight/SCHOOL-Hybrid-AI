import { pool } from "./pool.js";

export type ProductEventName =
  | "search"
  | "follow"
  | "onboarding_completed"
  | "onboarding_declined"
  | "billing_admin_upgrade"
  | "billing_webhook_upgrade"
  | "billing_subscribe_intent"
  | "billing_subscribe_activated"
  | "billing_bursary_redeemed"
  | "wallet_topup_created"
  | "wallet_credit_admin"
  | "wallet_credit_topup"
  | "wallet_debit"
  | "past_paper_unlock"
  | "lite_mode_session"
  | "perf_page_load";

export async function createProductEvent(
  userId: string,
  eventName: ProductEventName,
  metadata: Record<string, unknown> = {}
) {
  await pool.query(
    `INSERT INTO product_events (user_id, event_name, metadata)
     VALUES ($1, $2, $3)`,
    [userId, eventName, metadata]
  );
}
