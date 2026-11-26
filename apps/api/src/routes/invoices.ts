// apps/api/src/routes/invoices.ts
//
// Institutional invoice + payment reconciliation endpoints (Phase 2.2).
//
//   POST  /institutions/:id/invoices                  create (optionally issue) an invoice
//   GET   /institutions/:id/invoices                  list an institution's invoices
//   GET   /institutions/:id/invoices/:invoiceId       invoice detail + line items + payments
//   POST  /institutions/:id/invoices/:invoiceId/issue issue a draft invoice
//   POST  /institutions/:id/invoices/:invoiceId/pay   record a cleared EFT/card payment (reconcile)
//   POST  /enterprise/invoices/:invoiceId/payfast     build a PayFast order (redirect host)
//   POST  /enterprise/payfast/itn                     PayFast ITN webhook (open, signature verified)

import { FastifyInstance } from "fastify";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { config } from "../config.js";
import {
  createInvoice,
  issueInvoice,
  applyPayment,
  payFastOrder,
  handlePayFastItn,
  reconcileInvoiceStatuses,
} from "../lib/invoices.js";
import { EnterpriseTier } from "../lib/enterprise-billing.js";

function scopeInstitutionId(request: any): string | null {
  if (request.user?.role === "superadmin") return request.query?.institutionId ?? null;
  return request.user?.institutionId ?? null;
}

const createInvoiceSchema = z.object({
  tier: z.enum(["E1", "E2", "E3", "U1", "U2", "U3", "G1"]),
  cycle: z.enum(["monthly", "semi_annual", "annual", "multi_year", "custom"]).default("annual"),
  years: z.number().int().min(1).max(3).default(1),
  licenseSeats: z.number().int().min(0).optional(),
  description: z.string().optional(),
  paymentMethod: z.enum(["eft", "payfast", "card", "manual"]).default("eft"),
  issueNow: z.boolean().default(true),
  dueInDays: z.number().int().min(0).default(30),
});

const paySchema = z.object({
  amountZar: z.number().positive(),
  method: z.enum(["eft", "payfast", "card", "manual"]),
  reference: z.string().optional(),
});

export async function registerInvoiceRoutes(app: FastifyInstance) {
  const invoiceOwned = async (request: any, reply: any, institutionId: string, invoiceId: string) => {
    const scoped = scopeInstitutionId(request);
    if (request.user.role !== "superadmin" && scoped !== institutionId) {
      reply.code(403).send({ error: "Forbidden - not your institution" });
      return true;
    }
    const row = await pool.query(
      `SELECT id::text FROM invoices WHERE id = $1 AND institution_id = $2`,
      [invoiceId, institutionId]
    );
    if (row.rows.length === 0) {
      reply.code(404).send({ error: "Invoice not found" });
      return true;
    }
    return false;
  };

  // ---------- Invoice CRUD (institution admin) ----------
  app.post("/institutions/:id/invoices", { preHandler: [requireAuth, requireRole("institution_admin")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const scoped = scopeInstitutionId(request);
    if (request.user.role !== "superadmin" && scoped !== id) {
      reply.code(403).send({ error: "Forbidden - not your institution" });
      return;
    }
    const parsed = createInvoiceSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: "Invalid input", details: parsed.error.flatten() });
      return;
    }
    const d = parsed.data;
    const invoice = await createInvoice({
      institutionId: id,
      tier: d.tier as EnterpriseTier,
      cycle: d.cycle,
      years: d.years,
      licenseSeats: d.licenseSeats,
      description: d.description,
      paymentMethod: d.paymentMethod,
      issueNow: d.issueNow,
      dueInDays: d.dueInDays,
    });
    const detail = await pool.query(
      `SELECT i.id::text, i.number, i.tier, i.billing_cycle, i.license_seats, i.description,
              i.net_amount_zar::float8, i.vat_zar::float8, i.gross_amount_zar::float8,
              i.status, i.payment_method, i.issued_at, i.due_at, i.created_at,
              COALESCE(json_agg(l ORDER BY l.net_zar DESC) FILTER (WHERE l.id IS NOT NULL), '[]'::json) AS line_items,
              i.amount_paid_zar::float8
       FROM invoices i
       LEFT JOIN invoice_line_items l ON l.invoice_id = i.id
       WHERE i.id = $1
       GROUP BY i.id`,
      [invoice.id]
    );
    reply.code(201).send({ invoice: detail.rows[0] });
  });

  app.get("/institutions/:id/invoices", { preHandler: [requireAuth, requireRole("institution_admin")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const scoped = scopeInstitutionId(request);
    if (request.user.role !== "superadmin" && scoped !== id) {
      reply.code(403).send({ error: "Forbidden - not your institution" });
      return;
    }
    const result = await pool.query(
      `SELECT id::text, number, tier, billing_cycle, gross_amount_zar::float8, amount_paid_zar::float8,
              status, payment_method, issued_at, due_at, paid_at, created_at
       FROM invoices WHERE institution_id = $1 ORDER BY created_at DESC`,
      [id]
    );
    reply.send({ invoices: result.rows });
  });

  app.get("/institutions/:id/invoices/:invoiceId", { preHandler: [requireAuth, requireRole("institution_admin")] }, async (request, reply) => {
    const { id, invoiceId } = request.params as { id: string; invoiceId: string };
    if (await invoiceOwned(request, reply, id, invoiceId)) return;
    const detail = await pool.query(
      `SELECT i.*,
              COALESCE(json_agg(l ORDER BY l.net_zar DESC) FILTER (WHERE l.id IS NOT NULL), '[]'::json) AS line_items,
              COALESCE(json_agg(p ORDER BY p.created_at ASC) FILTER (WHERE p.id IS NOT NULL), '[]'::json) AS payments
       FROM invoices i
       LEFT JOIN invoice_line_items l ON l.invoice_id = i.id
       LEFT JOIN invoice_payments p ON p.invoice_id = i.id
       WHERE i.id = $1 AND i.institution_id = $2
       GROUP BY i.id`,
      [invoiceId, id]
    );
    if (detail.rows.length === 0) return reply.code(404).send({ error: "Invoice not found" });
    reply.send({ invoice: detail.rows[0] });
  });

  app.post("/institutions/:id/invoices/:invoiceId/issue", { preHandler: [requireAuth, requireRole("institution_admin")] }, async (request, reply) => {
    const { id, invoiceId } = request.params as { id: string; invoiceId: string };
    if (await invoiceOwned(request, reply, id, invoiceId)) return;
    const updated = await issueInvoice(invoiceId, 30);
    reply.send({ invoice: updated });
  });

  // ---------- Reconciliation (record a cleared manual payment) ----------
  app.post("/institutions/:id/invoices/:invoiceId/pay", { preHandler: [requireAuth, requireRole("institution_admin")] }, async (request, reply) => {
    const { id, invoiceId } = request.params as { id: string; invoiceId: string };
    if (await invoiceOwned(request, reply, id, invoiceId)) return;
    const parsed = paySchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid input", details: parsed.error.flatten() });
    const reconciled = await applyPayment(invoiceId, parsed.data.amountZar, parsed.data.method, parsed.data.reference);
    reply.send({ invoice: reconciled });
  });

  // ---------- PayFast ----------
  // POST /enterprise/invoices/:invoiceId/payfast — build a checkout order (returns the gateway
  // URL + signed params the frontend posts/redirects to).
  app.post("/enterprise/invoices/:invoiceId/payfast", { preHandler: [requireAuth, requireRole("institution_admin")] }, async (request, reply) => {
    const { invoiceId } = request.params as { invoiceId: string };
    const instId = scopeInstitutionId(request);
    const owned = await pool.query(`SELECT id::text FROM invoices WHERE id = $1 AND ($2::uuid IS NULL OR institution_id = $2)`, [invoiceId, instId ?? null]);
    if (owned.rows.length === 0) return reply.code(404).send({ error: "Invoice not found" });
    const inv = await pool.query(
      `SELECT id::text, number, tier, description, gross_amount_zar::float8 FROM invoices WHERE id = $1`,
      [invoiceId]
    );
    const order = payFastOrder(
      inv.rows[0],
      `${config.appUrl}/enterprise/payfast/itn`,
      `${config.appUrl}/enterprise/invoices/${invoiceId}?paid=1`,
      `${config.appUrl}/enterprise/invoices/${invoiceId}?cancelled=1`
    );
    reply.send({ url: order.url, form: order.params });
  });

  // POST /enterprise/payfast/itn — PayFast ITN callback. Open (no auth): authenticity is
  // guaranteed by the signed notification params.
  app.post("/enterprise/payfast/itn", async (request, reply) => {
    const body = (request.body ?? {}) as Record<string, string>;
    const result = await handlePayFastItn(body);
    // PayFast expects HTTP 200 to acknowledge a valid ITN; mark processing done.
    // Replies are intentionally not descriptive to a non-signature-verified caller.
    if (!result.ok) {
      reply.code(200).send({ ok: false });
      return;
    }
    reply.send({ ok: true, invoiceId: result.invoiceId, status: result.status });
  });

  // POST /enterprise/invoices/reconcile — housekeeping to flip issued invoices overdue.
  app.post("/enterprise/invoices/reconcile", { preHandler: [requireAuth, requireRole("superadmin")] }, async (_request, reply) => {
    const flipped = await reconcileInvoiceStatuses();
    reply.send({ flipped });
  });
}