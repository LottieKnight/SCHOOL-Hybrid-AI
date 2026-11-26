import { Queue, Worker } from "bullmq";
import { config } from "../config.js";
import { pool } from "../db/pool.js";
import { getRetentionYears } from "../lib/retention.js";

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? "";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://school.ac.za";
const EMAIL_FROM = process.env.EMAIL_FROM ?? "SCHOOL <notifications@school.ac.za>";

async function sendWeeklyEmail(to: string, firstName: string, posts: number, comments: number, reactions: number, credits: number): Promise<void> {
  if (!RESEND_API_KEY) return;
  const total = posts + comments + reactions;
  const subject = total === 0 ? "Your campus misses you — weekly summary" : "Your weekly SCHOOL summary";
  const rows = [
    ["Posts created", posts],
    ["Answers posted", comments],
    ["Reactions received", reactions],
    ["Scholar Credits earned", `+${credits} 🪙`],
  ];
  const tableRows = rows.map(([label, val]) =>
    `<tr><td style="padding:8px 12px;color:#a3a3a3;font-size:13px;border:1px solid #2a2a2a;">${label}</td><td style="padding:8px 12px;color:#fafafa;font-weight:700;border:1px solid #2a2a2a;text-align:right;">${val}</td></tr>`
  ).join("");
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/><style>body{margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,sans-serif;color:#e5e5e5}.wrap{max-width:540px;margin:40px auto;padding:0 16px}.card{background:#141414;border:1px solid #2a2a2a;border-radius:12px;padding:32px}h1{font-size:20px;font-weight:700;margin:0 0 16px;color:#fafafa}p{font-size:14px;line-height:1.65;color:#a3a3a3;margin:0 0 16px}.btn{display:inline-block;padding:12px 24px;background:#fafafa;color:#0a0a0a;font-weight:700;font-size:14px;text-decoration:none;border-radius:8px;margin-top:20px}.footer{font-size:11px;color:#525252;text-align:center;margin-top:20px}</style></head><body>
  <div class="wrap"><div class="card">
    <div style="font-size:13px;font-weight:800;letter-spacing:0.1em;color:#a3a3a3;margin-bottom:24px;">SCHOOL</div>
    <h1>Hi ${firstName || "there"} — here's your week</h1>
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">${tableRows}</table>
    ${total === 0 ? "<p>Open questions in your module rooms are waiting for you to answer them.</p>" : "<p>Thanks for being active. Every answer you post helps a classmate pass.</p>"}
    <a href="${SITE_URL}/community" class="btn">Open SCHOOL →</a>
  </div>
  <div class="footer">DITSHEGO VENTURES (Pty) Ltd t/a SCHOOL</div></div>
  </body></html>`;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: EMAIL_FROM, to, subject, html }),
  }).catch(() => null);
}

const redisUrl = new URL(config.redisUrl);
const connection = {
  host: redisUrl.hostname,
  port: Number(redisUrl.port || "6379"),
  password: redisUrl.password || undefined,
  // In tests there is no Redis service; without this the connection
  // retries forever and the open handle keeps the test process alive.
  ...(config.env === "test"
    ? { retryStrategy: () => null, enableOfflineQueue: false }
    : {}),
};

export const taskQueue = new Queue("saedu-tasks", { connection });

async function ensureNotificationsTableExists(): Promise<void> {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id uuid NOT NULL,
        type text NOT NULL,
        ref_id text,
        message text NOT NULL,
        read_at timestamptz,
        created_at timestamptz DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON notifications (user_id);
    `);
  } catch { /* ignore */ }
}

async function runWeeklyWrap(): Promise<void> {
  const hasLedger = await pool
    .query(`SELECT to_regclass('public.wallet_ledger_entries')::text AS r`)
    .then((r) => Boolean(r.rows[0]?.r))
    .catch(() => false);

  if (!hasLedger) return;

  await ensureNotificationsTableExists();

  const activeUsers = await pool.query<{ user_id: string; email: string; first_name: string; posts: string; comments: string; reactions: string; accepted: string; credits: string }>(`
    SELECT
      w.user_id::text,
      u.email,
      u.first_name,
      COUNT(CASE WHEN w.ref_type = 'community_post_created' THEN 1 END)::text AS posts,
      COUNT(CASE WHEN w.ref_type = 'community_comment_posted' THEN 1 END)::text AS comments,
      COUNT(CASE WHEN w.ref_type = 'community_reaction_on_post' THEN 1 END)::text AS reactions,
      COUNT(CASE WHEN w.ref_type = 'community_comment_accepted' THEN 1 END)::text AS accepted,
      COALESCE(SUM(w.amount_credits), 0)::text AS credits
    FROM wallet_ledger_entries w
    JOIN users u ON u.id = w.user_id
    WHERE w.created_at >= NOW() - INTERVAL '7 days'
      AND w.ref_type IN ('community_post_created', 'community_comment_posted', 'community_reaction_on_post', 'community_comment_accepted')
    GROUP BY w.user_id, u.email, u.first_name
    HAVING COUNT(*) > 0
  `);

  for (const row of activeUsers.rows) {
    const posts = parseInt(row.posts, 10);
    const comments = parseInt(row.comments, 10);
    const reactions = parseInt(row.reactions, 10);
    const accepted = parseInt(row.accepted, 10);
    const credits = parseInt(row.credits, 10);

    if (posts === 0 && comments === 0) continue;

    const parts: string[] = [];
    if (posts > 0) parts.push(`${posts} post${posts !== 1 ? "s" : ""}`);
    if (comments > 0) parts.push(`${comments} answer${comments !== 1 ? "s" : ""}`);
    if (reactions > 0) parts.push(`${reactions} reaction${reactions !== 1 ? "s" : ""} received`);
    if (accepted > 0) parts.push(`${accepted} accepted answer${accepted !== 1 ? "s" : ""}`);

    const message = `Last week: ${parts.join(", ")}. Keep contributing — your campus needs you!`;

    await pool
      .query(
        `INSERT INTO notifications (user_id, type, message) VALUES ($1, 'weekly_wrap', $2)`,
        [row.user_id, message]
      )
      .catch(() => { /* non-critical */ });

    if (row.email) {
      void sendWeeklyEmail(row.email, row.first_name ?? "", posts, comments, reactions, credits).catch(() => null);
    }
  }
}

async function runDataRetention(): Promise<void> {
  // Retention windows come from the operator-managed registry (POPIA §14) with
  // documented defaults when unset.
  const anonymizeYears = await getRetentionYears("account.inactivity_anonymize_years");
  const cleanupYears = await getRetentionYears("account.unverified_cleanup_years");

  // Anonymise verified accounts with no login activity for anonymizeYears+.
  const anonymised = await pool.query(`
    UPDATE users
    SET
      email             = 'anon-' || id::text || '@deleted.school.ac.za',
      first_name        = 'Deleted',
      last_name         = 'Account',
      phone             = '',
      phone_number      = NULL,
      phone_number_hash = NULL,
      date_of_birth     = NULL,
      password_hash     = '',
      anonymized_at     = NOW()
    WHERE
      anonymized_at IS NULL
      AND is_email_verified = TRUE
      AND COALESCE(last_active_at, created_at) < NOW() - make_interval(years => $1)
    RETURNING id
  `, [anonymizeYears]);

  // Hard-delete accounts that were never email-verified after cleanupYears (no user data attached).
  const deleted = await pool.query(`
    DELETE FROM users
    WHERE
      is_email_verified = FALSE
      AND created_at < NOW() - make_interval(years => $1)
      AND anonymized_at IS NULL
    RETURNING id
  `, [cleanupYears]);

  if (anonymised.rowCount || deleted.rowCount) {
    process.stdout.write(
      `[data-retention] anonymised=${anonymised.rowCount ?? 0} deleted=${deleted.rowCount ?? 0}\n`
    );
  }
}

async function runWebhookDelivery(job: any): Promise<void> {
  const { endpointId, url, envelope } = job.data;
  const payloadBody = JSON.stringify(envelope);
  const signature = envelope.signature;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-SCHOOL-Event": envelope.event,
      "X-SCHOOL-Hmac-SHA256": signature,
      "X-SCHOOL-Delivery": envelope.id,
      "User-Agent": "SCHOOL-Webhooks/1.0",
    },
    body: payloadBody,
    signal: AbortSignal.timeout(10000),
  });

  const responseBody = await res.text().catch(() => "");
  const success = res.status >= 200 && res.status < 300;

  await pool
    .query(
      `UPDATE webhook_deliveries
       SET attempt = attempt + $2, status_code = $3, response_body = $4, success = $5, delivered_at = NOW()
       WHERE id = (
         SELECT id FROM webhook_deliveries
         WHERE endpoint_id = $1
         ORDER BY delivered_at DESC LIMIT 1
       )`,
      [endpointId, job.attemptsMade ?? 0, res.status, responseBody.slice(0, 2000), success]
    )
    .catch(() => null);

  await pool
    .query(
      `UPDATE webhook_endpoints
       SET last_delivered_at = NOW(), last_status_code = $2
       WHERE id = $1`,
      [endpointId, res.status]
    )
    .catch(() => null);

  if (!success) {
    throw new Error(`Webhook to ${url} returned ${res.status}`);
  }
}

export function startWorker() {
  const worker = new Worker(
    "saedu-tasks",
    async (job) => {
      if (job.name === "ping") {
        return { ok: true };
      }
      if (job.name === "weekly-wrap") {
        await runWeeklyWrap();
        return { ok: true };
      }
      if (job.name === "data-retention") {
        await runDataRetention();
        return { ok: true };
      }
      if (job.name === "webhook-deliver") {
        await runWebhookDelivery(job);
        return { ok: true };
      }
      return { ok: false };
    },
    { connection }
  );

  worker.on("failed", (job, err) => {
    console.error(`Job ${job?.id} failed`, err);
  });

  return worker;
}

export async function scheduleWeeklyWrap(): Promise<void> {
  try {
    await taskQueue.add(
      "weekly-wrap",
      {},
      {
        repeat: { pattern: "0 8 * * 1" }, // Monday 08:00 UTC
        jobId: "weekly-wrap-singleton",
        removeOnComplete: true,
        removeOnFail: false,
      }
    );
  } catch (err) {
    console.error("Failed to schedule weekly wrap:", err);
  }
}

export async function scheduleDataRetention(): Promise<void> {
  try {
    await taskQueue.add(
      "data-retention",
      {},
      {
        repeat: { pattern: "0 3 1 * *" }, // 03:00 UTC on the 1st of each month
        jobId: "data-retention-singleton",
        removeOnComplete: true,
        removeOnFail: false,
      }
    );
  } catch (err) {
    console.error("Failed to schedule data-retention job:", err);
  }
}

export async function enqueueExampleJob() {
  return taskQueue.add("ping", { createdAt: new Date().toISOString() });
}
