// apps/api/src/routes/institution-import.ts
//
// Bulk user provisioning for enterprise institutions.
//
//   POST /institutions/:id/users/import
//
// Accepts a CSV file upload (field name "file") with a header row containing
// at least `email`. Optional columns: first_name, last_name, role, group.
//
// Roles are restricted to learner / parent / educator for bulk import.
// Users who already exist are linked to the institution; new users are created
// with a randomly generated (unknown) password so they can reset via email.
//
// The import runs in a single DB transaction and reports per-row outcomes.

import { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { pool } from "../db/pool.js";
import { createUser, findUserByEmail } from "../db/users.js";
import { ensureProfile } from "../db/profile.js";
import { writeAuditLog } from "../db/audit-log.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { parseCsv } from "../lib/csv.js";

const ALLOWED_ROLES = new Set(["learner", "parent", "educator"]);
const MAX_ROWS = 5000;

function normalizeRole(role: string | undefined): string {
  const r = (role ?? "").trim().toLowerCase();
  if (ALLOWED_ROLES.has(r)) return r;
  if (r === "teacher") return "educator";
  if (r === "guardian") return "parent";
  if (r === "student" || r === "pupil") return "learner";
  return "learner";
}

export async function registerInstitutionImportRoutes(app: FastifyInstance) {
  const guard = [requireAuth, requireRole("institution_admin")];

  app.post("/institutions/:id/users/import", { preHandler: guard }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const scoped = request.user.institutionId;
    if (request.user.role !== "superadmin" && scoped !== id) {
      reply.code(403).send({ error: "Forbidden - not your institution" });
      return;
    }

    const file = await request.file();
    if (!file) {
      reply.code(400).send({ error: "No file uploaded (multipart field 'file')" });
      return;
    }
    if (file.mimetype && !/text\/csv|csv|application\/octet-stream/i.test(file.mimetype)) {
      file.file.resume();
      reply.code(400).send({ error: "Unsupported file type - expected CSV" });
      return;
    }

    let text = "";
    for await (const chunk of file.file) {
      text += chunk.toString("utf-8");
      if (text.length > 10 * 1024 * 1024) {
        file.file.destroy();
        reply.code(413).send({ error: "File too large (max 10MB)" });
        return;
      }
    }

    let parsed;
    try {
      parsed = parseCsv(text);
    } catch (e: any) {
      reply.code(400).send({ error: "Failed to parse CSV", detail: e?.message });
      return;
    }

    const { headers, rows } = parsed;
    if (!headers.includes("email")) {
      reply.code(400).send({ error: "CSV must include an 'email' column" });
      return;
    }
    if (rows.length === 0) {
      reply.code(400).send({ error: "CSV contains no data rows" });
      return;
    }
    if (rows.length > MAX_ROWS) {
      reply.code(400).send({ error: `Too many rows (max ${MAX_ROWS})` });
      return;
    }

    const results: Array<Record<string, string>> = [];
    let created = 0;
    let linked = 0;
    let failed = 0;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const row of rows) {
        const email = (row.email ?? "").trim().toLowerCase();
        const firstName = (row.first_name ?? row.firstname ?? "").trim();
        const lastName = (row.last_name ?? row.lastname ?? "").trim();
        const role = normalizeRole(row.role);

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          results.push({ email: email || "(missing)", status: "error", reason: "Invalid email" });
          failed++;
          continue;
        }

        try {
          let dbUser = await findUserByEmail(email);
          if (!dbUser) {
            // unknown password: user must reset via "forgot password" email
            dbUser = await createUser(email, randomUUID(), firstName || email.split("@")[0], lastName || "User", "", role);
            await client.query(
              `UPDATE users SET institution_id = $2, is_email_verified = FALSE WHERE id = $1`,
              [dbUser.id, id]
            );
            await ensureProfile(dbUser.id, email.split("@")[0]).catch(() => null);
            results.push({ email, status: "created", role });
            created++;
          } else {
            await client.query(
              `UPDATE users SET institution_id = $2 WHERE id = $1 AND (institution_id IS NULL OR institution_id = $2)`,
              [dbUser.id, id]
            );
            results.push({ email, status: "linked", role: dbUser.role ?? role });
            linked++;
          }
        } catch (e: any) {
          results.push({ email, status: "error", reason: e?.message ?? "DB error" });
          failed++;
        }
      }
      await client.query("COMMIT");
    } catch (e: any) {
      await client.query("ROLLBACK");
      app.log.error({ err: e }, "Bulk import transaction failed");
      reply.code(500).send({ error: "Import failed", detail: e?.message });
      return;
    } finally {
      client.release();
    }

    void writeAuditLog({
      userId: request.user.sub,
      actorId: request.user.sub,
      action: "admin.action",
      resourceType: "institution",
      resourceId: id,
      metadata: { action: "bulk_user_import", rows: rows.length, created, linked, failed },
      ipAddress: request.ip ?? null,
      userAgent: request.headers["user-agent"] ?? null,
    });

    reply.send({ summary: { total: rows.length, created, linked, failed }, results });
  });
}
