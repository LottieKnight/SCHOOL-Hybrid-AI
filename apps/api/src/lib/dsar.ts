// apps/api/src/lib/dsar.ts
//
// POPIA §§23–24 Subject Access Request (DSAR) workflow.
//
//   §23 access:   a data subject may request a copy of their personal data.
//   §24 erasure:  a data subject may request deletion / correction of data.
//
// Every request is journaled to subject_access_requests with a 30-day statutory
// response clock. Access is fulfilled by staging a snapshot (the same §23 package
// produced for GET /profile/data-export) and recording its location. Erasure
// anonymises + suspends the account (mirroring softDeleteUser) and journals the
// outcome — financial/audit ledgers keyed by user_id are retained under a legal
// obligation, so "erasure" here means identity is purged while immutable records
// stay intact (documented residual-keys policy).

import { pool } from "../db/pool.js";
import { softDeleteUser, findUserById } from "../db/users.js";
import { createUserSuspension } from "../db/platform.js";
import { randomUUID, createHash } from "node:crypto";

export type DsarType = "access" | "erasure";
export type DsarStatus = "pending" | "in_progress" | "fulfilled" | "rejected" | "erased";

export const DSAR_SLA_DAYS = 30;

export interface DsarRecord {
  id: string;
  requestor_user_id: string;
  institution_id: string | null;
  request_type: DsarType;
  status: DsarStatus;
  details: string | null;
  channel: string;
  sla_due_at: string;
  snapshot_path: string | null;
  fulfilled_at: string | null;
  fulfilled_by: string | null;
  fulfilled_notes: string | null;
  erased_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function lodgeSubjectAccessRequest(input: {
  requestorUserId: string;
  institutionId?: string | null;
  requestType: DsarType;
  details?: string | null;
  channel?: string;
}): Promise<DsarRecord> {
  const id = randomUUID();
  const result = await pool.query<DsarRecord>(
    `INSERT INTO subject_access_requests
       (id, requestor_user_id, institution_id, request_type, details, channel, sla_due_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW() + make_interval(days => $7))
     RETURNING id, requestor_user_id, institution_id, request_type, status, details, channel,
               sla_due_at, snapshot_path, fulfilled_at, fulfilled_by, fulfilled_notes,
               erased_at, created_at, updated_at`,
    [id, input.requestorUserId, input.institutionId ?? null, input.requestType, input.details ?? null,
     input.channel ?? "self-service", DSAR_SLA_DAYS]
  );
  return result.rows[0];
}

export async function listOwnSubjectAccessRequests(userId: string): Promise<DsarRecord[]> {
  const result = await pool.query<DsarRecord>(
    `SELECT id, requestor_user_id, institution_id, request_type, status, details, channel,
            sla_due_at, snapshot_path, fulfilled_at, fulfilled_by, fulfilled_notes,
            erased_at, created_at, updated_at
     FROM subject_access_requests
     WHERE requestor_user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );
  return result.rows;
}

export async function listAllSubjectAccessRequests(opts: {
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<{ rows: DsarRecord[]; total: number }> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let i = 1;
  if (opts.status) { conditions.push(`status = $${i}`); params.push(opts.status); i++; }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = Math.min(opts.limit ?? 50, 200);
  const offset = opts.offset ?? 0;

  const [data, count] = await Promise.all([
    pool.query<DsarRecord>(
      `SELECT id, requestor_user_id, institution_id, request_type, status, details, channel,
              sla_due_at, snapshot_path, fulfilled_at, fulfilled_by, fulfilled_notes,
              erased_at, created_at, updated_at
       FROM subject_access_requests ${where}
       ORDER BY sla_due_at ASC LIMIT $${i} OFFSET $${i + 1}`,
      [...params, limit, offset]
    ),
    pool.query<{ count: string }>(`SELECT COUNT(*) AS count FROM subject_access_requests ${where}`, params),
  ]);

  return { rows: data.rows, total: parseInt(count.rows[0]?.count ?? "0", 10) };
}

// Mark an access request fulfilled. The operator has staged the package and
// records where it lives + notes; the requestor is notified out-of-band.
export async function fulfillSubjectAccessRequest(input: {
  id: string;
  fulfilledBy: string;
  snapshotPath?: string | null;
  notes?: string | null;
}): Promise<DsarRecord | null> {
  const result = await pool.query<DsarRecord>(
    `UPDATE subject_access_requests
     SET status = 'fulfilled',
         fulfilled_at = NOW(),
         fulfilled_by = $2,
         snapshot_path = COALESCE($3, snapshot_path),
         fulfilled_notes = COALESCE($4, fulfilled_notes),
         updated_at = NOW()
     WHERE id = $1 AND request_type = 'access'
     RETURNING id, requestor_user_id, institution_id, request_type, status, details, channel,
               sla_due_at, snapshot_path, fulfilled_at, fulfilled_by, fulfilled_notes,
               erased_at, created_at, updated_at`,
    [input.id, input.fulfilledBy, input.snapshotPath ?? null, input.notes ?? null]
  );
  return result.rows[0] ?? null;
}

export async function rejectSubjectAccessRequest(input: {
  id: string;
  fulfilledBy: string;
  notes: string | null;
}): Promise<DsarRecord | null> {
  const result = await pool.query<DsarRecord>(
    `UPDATE subject_access_requests
     SET status = 'rejected',
         fulfilled_at = NOW(),
         fulfilled_by = $2,
         fulfilled_notes = COALESCE($3, fulfilled_notes),
         updated_at = NOW()
     WHERE id = $1
     RETURNING id, requestor_user_id, institution_id, request_type, status, details, channel,
               sla_due_at, snapshot_path, fulfilled_at, fulfilled_by, fulfilled_notes,
               erased_at, created_at, updated_at`,
    [input.id, input.fulfilledBy, input.notes ?? null]
  );
  return result.rows[0] ?? null;
}

// Erasure envelope: anonymise the account (email + names + phone, unguessable
// password), suspend it permanently, and journal the DSAR as 'erased'. Identity
// PII is purged; immutable financial/audit ledger rows keyed by user_id are kept
// under a legal-obligation retention policy (documented residual keys).
export async function eraseSubjectData(input: {
  id: string;
  userId: string;
  erasedBy: string;
  notes?: string | null;
}): Promise<DsarRecord | null> {
  const anonymisedEmail = `erased_${input.userId.replace(/-/g, "")}@erased.invalid`;
  const unguessableHash = createHash("sha256").update(`erased:${input.userId}:${randomUUID()}`).digest("hex");

  await softDeleteUser(input.userId, anonymisedEmail, unguessableHash);
  await pool.query(`UPDATE users SET anonymized_at = NOW() WHERE id = $1`, [input.userId]);
  await createUserSuspension({ userId: input.userId, reason: "Erased via POPIA §24 DSAR", suspendedBy: input.erasedBy, endsAt: null });

  const result = await pool.query<DsarRecord>(
    `UPDATE subject_access_requests
     SET status = 'erased',
         erased_at = NOW(),
         fulfilled_at = NOW(),
         fulfilled_by = $2,
         fulfilled_notes = COALESCE($3, fulfilled_notes),
         updated_at = NOW()
     WHERE id = $1
       AND request_type = 'erasure'
     RETURNING id, requestor_user_id, institution_id, request_type, status, details, channel,
               sla_due_at, snapshot_path, fulfilled_at, fulfilled_by, fulfilled_notes,
               erased_at, created_at, updated_at`,
    [input.id, input.erasedBy, input.notes ?? null]
  );
  return result.rows[0] ?? null;
}

export async function getSubjectAccessRequest(id: string): Promise<DsarRecord | null> {
  const result = await pool.query<DsarRecord>(
    `SELECT id, requestor_user_id, institution_id, request_type, status, details, channel,
            sla_due_at, snapshot_path, fulfilled_at, fulfilled_by, fulfilled_notes,
            erased_at, created_at, updated_at
     FROM subject_access_requests WHERE id = $1`,
    [id]
  );
  return result.rows[0] ?? null;
}

export async function requireRequestorUser(requestorUserId: string): Promise<{ id: string; institution_id: string | null } | null> {
  const u = await findUserById(requestorUserId);
  return u ? { id: u.id, institution_id: u.institution_id } : null;
}