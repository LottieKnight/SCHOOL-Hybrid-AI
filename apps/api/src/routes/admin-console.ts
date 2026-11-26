// apps/api/src/routes/admin-console.ts
//
// Phase 3.2 — Tenant-wide admin console aggregation for the SCHOOL operator.
// Superadmin only. Gives a single-pane overview of the whole book of business:
// institutions, seats, billing exposure, integrations health (SSO/SCIM/webhooks/
// LTI), and platform activity — the numbers sales/finance/ops need to run the
// E1..G1 portfolio.
//
//   GET /admin/console/overview        platform-wide headline + by-tier counts
//   GET /admin/console/integrations    integration health across institutions
//   GET /admin/console/finance         invoice exposure + aging summary

import { FastifyInstance } from "fastify";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { getPlatformOverview } from "../lib/usage.js";
import { pool } from "../db/pool.js";

export async function registerAdminConsoleRoutes(app: FastifyInstance) {
  // GET /admin/console/overview
  app.get("/admin/console/overview", { preHandler: [requireAuth, requireAdmin] }, async (_request, reply) => {
    const overview = await getPlatformOverview();
    reply.send(overview);
  });

  // GET /admin/console/integrations — health counts, per type.
  app.get("/admin/console/integrations", { preHandler: [requireAuth, requireAdmin] }, async (_request, reply) => {
    const sso = await pool.query(
      `SELECT
         sso_provider, count(*)::int AS institutions
       FROM institution_settings
       WHERE sso_enabled = TRUE AND sso_provider IS NOT NULL
       GROUP BY sso_provider ORDER BY sso_provider`
    );
    const webhooks = await pool.query(`SELECT count(*)::int AS endpoints FROM webhook_endpoints WHERE status = 'active'`);
    const lti = await pool.query(`SELECT count(*)::int AS registrations FROM lti_registrations`);
    const ltiLaunches = await pool.query(`SELECT count(*)::int AS launches FROM lti_launch_events`);
    const scimGroups = await pool.query(`SELECT count(*)::int AS groups FROM scim_groups`);
    reply.send({
      sso: sso.rows,
      webhookEndpoints: webhooks.rows[0].endpoints,
      lti: { registrations: lti.rows[0].registrations, launches: ltiLaunches.rows[0].launches },
      scimGroups: scimGroups.rows[0].groups,
    });
  });

  // GET /admin/console/finance — invoice exposure + aging.
  app.get("/admin/console/finance", { preHandler: [requireAuth, requireAdmin] }, async (_request, reply) => {
    const summary = await pool.query(
      `SELECT status, count(*)::int AS count,
              COALESCE(sum(gross_amount_zar),0)::numeric AS gross,
              COALESCE(sum(gross_amount_zar - amount_paid_zar),0)::numeric AS outstanding
       FROM invoices GROUP BY status ORDER BY status`
    );
    reply.send({ invoices: summary.rows });
  });
}