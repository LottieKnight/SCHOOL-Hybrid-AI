import { pool } from "../db/pool.js";
import { config } from "../config.js";

type UnpaidSession = {
  id: string;
  tutor_id: string;
  payout_eligible_amount: number;
  completed_at: string;
};

async function runPayouts() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const unpaidResult = await client.query(
      `
        SELECT id, tutor_id, payout_eligible_amount, completed_at
        FROM tutor_sessions
        WHERE status IN ('completed', 'no_show_learner', 'resolved') AND paid_out_at IS NULL
          AND COALESCE(payout_eligible_amount, 0) > 0
        FOR UPDATE
      `
    );

    const unpaidSessions: UnpaidSession[] = unpaidResult.rows;
    if (!unpaidSessions.length) {
      await client.query("COMMIT");
      console.log("No unpaid completed sessions found.");
      return;
    }

    const completedDates = unpaidSessions
      .map((session) => new Date(session.completed_at))
      .sort((a, b) => a.getTime() - b.getTime());
    const periodStart = completedDates[0].toISOString().slice(0, 10);
    const periodEnd = completedDates[completedDates.length - 1].toISOString().slice(0, 10);

    let totalGross = 0;
    let totalCommission = 0;
    let totalNet = 0;

    for (const session of unpaidSessions) {
      const gross = Number(session.payout_eligible_amount);
      const commission = Number((gross * config.commissionRate).toFixed(2));
      const net = Number((gross - commission).toFixed(2));
      totalGross += gross;
      totalCommission += commission;
      totalNet += net;
    }

    const batchResult = await client.query(
      `
        INSERT INTO payout_batches (period_start, period_end, total_gross, total_commission, total_net)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `,
      [periodStart, periodEnd, totalGross, totalCommission, totalNet]
    );

    const batchId = batchResult.rows[0].id;

    for (const session of unpaidSessions) {
      const gross = Number(session.payout_eligible_amount);
      const commission = Number((gross * config.commissionRate).toFixed(2));
      const net = Number((gross - commission).toFixed(2));

      await client.query(
        `
          INSERT INTO commission_records (
            session_id,
            gross_amount,
            commission_rate,
            commission_amount,
            net_amount
          )
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (session_id) DO NOTHING
        `,
        [session.id, gross, config.commissionRate, commission, net]
      );

      await client.query(
        `
          INSERT INTO payout_items (
            payout_batch_id,
            tutor_id,
            session_id,
            gross_amount,
            commission_amount,
            net_amount,
            status,
            paid_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, 'paid', NOW())
        `,
        [batchId, session.tutor_id, session.id, gross, commission, net]
      );
    }

    await client.query(
      `
        UPDATE tutor_sessions
        SET paid_out_at = NOW(), updated_at = NOW()
        WHERE status IN ('completed', 'no_show_learner', 'resolved') AND paid_out_at IS NULL
      `
    );

    await client.query("COMMIT");
    console.log(`Processed payout batch ${batchId} for ${unpaidSessions.length} sessions.`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runPayouts().catch((error) => {
  console.error("Payout run failed:", error);
  process.exit(1);
});
