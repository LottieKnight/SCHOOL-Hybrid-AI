import { pool } from "./pool.js";

export type AuditAction =
  | "auth.register"
  | "auth.login"
  | "auth.logout"
  | "auth.login_failed"
  | "auth.sessions_revoked"
  | "auth.session_revoked"
  | "auth.email_verification_sent"
  | "auth.email_verified"
  | "auth.password_reset_requested"
  | "auth.password_reset"
  | "auth.password_changed"
  | "auth.email_change_requested"
  | "auth.email_changed"
  | "auth.account_deleted"
  | "auth.totp_enabled"
  | "auth.totp_disabled"
  | "auth.totp_verified"
  | "auth.parental_consent_email_sent"
  | "auth.parental_consent_given"
  | "audit.export"
  | "admin.action";

export const AUDIT_EXPORT_ACTIONS: readonly AuditAction[] = [
  "auth.register", "auth.login", "auth.logout", "auth.login_failed",
  "auth.sessions_revoked", "auth.session_revoked", "auth.email_verification_sent",
  "auth.email_verified", "auth.password_reset_requested", "auth.password_reset",
  "auth.password_changed", "auth.email_change_requested", "auth.email_changed",
  "auth.account_deleted", "auth.totp_enabled", "auth.totp_disabled",
  "auth.totp_verified", "auth.parental_consent_email_sent", "auth.parental_consent_given",
  "audit.export", "admin.action",
];

interface AuditEntry {
  userId?: string | null;
  actorId?: string | null;
  action: AuditAction;
  resourceType?: string | null;
  resourceId?: string | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export type AuditLogRow = {
  id: string;
  user_id: string | null;
  actor_id: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
};

export async function listAuditLog(opts: {
  userId?: string;
  action?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}): Promise<{ rows: AuditLogRow[]; total: number }> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let i = 1;

  if (opts.userId) { conditions.push(`(user_id = $${i} OR actor_id = $${i})`); params.push(opts.userId); i++; }
  if (opts.action) { conditions.push(`action = $${i}`); params.push(opts.action); i++; }
  if (opts.from) { conditions.push(`created_at >= $${i}`); params.push(opts.from); i++; }
  if (opts.to) { conditions.push(`created_at <= $${i}`); params.push(opts.to); i++; }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = Math.min(opts.limit ?? 50, 200);
  const offset = opts.offset ?? 0;

  const [dataResult, countResult] = await Promise.all([
    pool.query<AuditLogRow>(
      `SELECT id, user_id, actor_id, action, resource_type, resource_id, metadata, ip_address, user_agent, created_at
       FROM audit_log ${where} ORDER BY created_at DESC LIMIT $${i} OFFSET $${i + 1}`,
      [...params, limit, offset]
    ),
    pool.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM audit_log ${where}`,
      params
    ),
  ]);

  return {
    rows: dataResult.rows,
    total: parseInt(countResult.rows[0]?.count ?? "0", 10),
  };
}

// Regulator / auditor export: unbounded (SSL-app streaming) listing for POPIA §6
// accountability evidence. Default window backs off to 30 days to bound payload.
export async function exportAuditLog(opts: {
  from?: string;
  to?: string;
  action?: string;
  userId?: string;
  limit?: number;
}): Promise<{ rows: AuditLogRow[]; exportedAt: string }> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let i = 1;

  if (opts.from) { conditions.push(`created_at >= $${i}`); params.push(opts.from); i++; }
  if (opts.to) { conditions.push(`created_at <= $${i}`); params.push(opts.to); i++; }
  if (opts.action) { conditions.push(`action = $${i}`); params.push(opts.action); i++; }
  if (opts.userId) { conditions.push(`(user_id = $${i} OR actor_id = $${i})`); params.push(opts.userId); i++; }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const fallback = conditions.length ? "" : "WHERE created_at >= NOW() - interval '30 days'";
  const limit = Math.min(opts.limit ?? 5000, 50000);

  const result = await pool.query<AuditLogRow>(
    `SELECT id, user_id, actor_id, action, resource_type, resource_id, metadata, ip_address, user_agent, created_at
     FROM audit_log ${where} ${fallback}
     ORDER BY created_at ASC LIMIT $${i}`,
    [...params, limit]
  );

  return { rows: result.rows, exportedAt: new Date().toISOString() };
}

export function auditLogRowsToCsv(rows: AuditLogRow[]): string {
  const esc = (v: unknown): string => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "string" ? v : JSON.stringify(v);
    return `"${s.replace(/"/g, '""')}"`;
  };
  const header = "id,user_id,actor_id,action,resource_type,resource_id,metadata,ip_address,user_agent,created_at";
  const lines = rows.map((r) =>
    [
      esc(r.id), esc(r.user_id), esc(r.actor_id), esc(r.action), esc(r.resource_type),
      esc(r.resource_id), esc(r.metadata ? JSON.stringify(r.metadata) : null), esc(r.ip_address),
      esc(r.user_agent), esc(r.created_at),
    ].join(",")
  );
  return [header, ...lines].join("\n");
}

export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO audit_log (user_id, actor_id, action, resource_type, resource_id, metadata, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        entry.userId ?? null,
        entry.actorId ?? null,
        entry.action,
        entry.resourceType ?? null,
        entry.resourceId ?? null,
        entry.metadata ? JSON.stringify(entry.metadata) : null,
        entry.ipAddress ?? null,
        entry.userAgent ?? null,
      ]
    );
  } catch (err) {
    // Audit failures must never crash the main flow.
    // Non-fatal — use stderr directly to avoid circular dependency on request context.
    process.stderr.write(`[audit] write failed: ${err instanceof Error ? err.message : String(err)}\n`);
  }
}
