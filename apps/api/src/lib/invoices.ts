// apps/api/src/lib/invoices.ts
//
// Institutional invoice + payment-reconciliation engine (Phase 2.2).
//
// Converts an enterprise tier (E1..G1) into a line-itemed invoice with SA VAT
// (15%), generates sequential invoice numbers, and reconciles EFT / PayFast
// payments against the invoice ledger. PayFast integration follows the
// standard Order Request (redirect to checkout) and ITN (server-to-server
// notification) flows using PAYFAST_* config; accounts default to sandbox when
// not configured.

import { pool } from "../db/pool.js";
import { config } from "../config.js";
import { ENTERPRISE_TIERS, EnterpriseTier } from "./enterprise-billing.js";
import { createHmac, randomBytes } from "node:crypto";

export const VAT_RATE = 0.15;

export const INVOICE_STATUSES = ["draft", "issued", "partially_paid", "paid", "overdue", "cancelled"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export type PaymentMethod = "eft" | "payfast" | "card" | "manual";

export interface InvoiceInput {
  institutionId: string;
  tier: EnterpriseTier;
  cycle?: "monthly" | "annual" | "multi_year" | "semi_annual" | "custom";
  years?: number;
  licenseSeats?: number;
  description?: string;
  paymentMethod?: PaymentMethod;
  issueNow?: boolean;
  dueInDays?: number;
}

function grossFrom(vat: number, net: number): number {
  return Math.round((net + vat) * 100) / 100;
}

/** Next sequential invoice number: SCH-YYYY-NNNN globally unique. */
export async function nextInvoiceNumber(now = new Date()): Promise<string> {
  const year = now.getFullYear();
  const result = await pool.query(
    `SELECT count(*)::int AS n FROM invoices WHERE EXTRACT(YEAR FROM created_at) = $1`,
    [year]
  );
  const n = result.rows[0].n + 1;
  return `SCH-${year}-${String(n).padStart(4, "0")}`;
}

/** Create an invoice (draft by default) from an enterprise tier. */
export async function createInvoice(input: InvoiceInput) {
  const def = ENTERPRISE_TIERS[input.tier];
  const number = await nextInvoiceNumber();

  // annual sticker; monthly applies the x12 (undiscounted) price; multi-year
  // reuses the quoting engine for consistency with the sales calculator.
  let net: number;
  if (input.cycle === "multi_year") {
    net = def.annualPriceZar * (1 - ((input.years ?? 1) >= 3 ? 0.2 : 0.15));
  } else if (input.cycle === "monthly") {
    net = def.annualPriceZar * 1.1111;
  } else {
    net = def.annualPriceZar;
  }
  const vat = Math.round(net * VAT_RATE * 100) / 100;
  const gross = grossFrom(vat, net);

  const issuedAt = input.issueNow ? new Date() : null;
  const dueAt = input.issueNow ? new Date(Date.now() + (input.dueInDays ?? 30) * 86400000) : null;

  const result = await pool.query(
    `INSERT INTO invoices (
        institution_id, number, tier, billing_cycle, license_seats, description,
        net_amount_zar, vat_zar, gross_amount_zar, payment_method, issued_at, due_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING id::text, number, tier, billing_cycle, license_seats, description,
               net_amount_zar::float8, vat_zar::float8, gross_amount_zar::float8,
               status, payment_method, issued_at, due_at, created_at`,
    [
      input.institutionId, number, input.tier, input.cycle ?? "annual",
      input.licenseSeats ?? def.maxLearners ?? 0, input.description ?? "",
      net, vat, gross, input.paymentMethod ?? "eft", issuedAt, dueAt,
    ]
  );
  const invoice = result.rows[0];

  await pool.query(
    `INSERT INTO invoice_line_items (invoice_id, description, quantity, unit_price_zar, net_zar, vat_rate)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [invoice.id, `${def.name} - ${def.market} licence (${input.tier})`, 1, net, net, VAT_RATE]
  );

  return invoice;
}

/** Issue a draft invoice (status -> issued, set issued_at + due_at). */
export async function issueInvoice(invoiceId: string, dueInDays = 30) {
  const result = await pool.query(
    `UPDATE invoices
        SET status = 'issued', issued_at = COALESCE(issued_at, now()),
            due_at = COALESCE(due_at, now() + $2 * INTERVAL '1 day'), updated_at = now()
      WHERE id = $1
      RETURNING id::text, number, status, issued_at, due_at`,
    [invoiceId, dueInDays]
  );
  return result.rows[0] ?? null;
}

/** Apply a cleared payment to an invoice and recompute status. */
export async function applyPayment(invoiceId: string, amountZar: number, method: PaymentMethod, reference?: string, providerRef?: string) {
  const result = await pool.query(
    `INSERT INTO invoice_payments (invoice_id, amount_zar, method, reference, provider_ref, status, received_at)
     VALUES ($1, $2, $3, $4, $5, 'cleared', now())`,
    [invoiceId, amountZar, method, reference ?? null, providerRef ?? null]
  );
  if (result.rowCount === 0) return null;
  await pool.query(`SELECT reconcile_invoice($1)`, [invoiceId]);
  const inv = await pool.query(`SELECT id::text, status, amount_paid_zar::float8, gross_amount_zar::float8, paid_at FROM invoices WHERE id = $1`, [invoiceId]);
  return inv.rows[0] ?? null;
}

/** Reconcile all invoices that may now be due/overdue. */
export async function reconcileInvoiceStatuses() {
  const due = await pool.query(
    `SELECT id FROM invoices WHERE status IN ('issued','partially_paid') AND due_at IS NOT NULL AND due_at < now()`
  );
  for (const row of due.rows) {
    await pool.query(`SELECT reconcile_invoice($1)`, [row.id]);
  }
  return due.rows.length;
}

// ---------------- PayFast integration ----------------

export interface PayFastOrder {
  merchant_id: string;
  merchant_key: string;
  amount: string;
  item_name: string;
  item_description: string;
  return_url: string;
  cancel_url: string;
  notify_url: string;
  email_address?: string;
  merchant_id_ref?: string;
  custom_str1?: string;
}

/** Build the PayFast gateway POST URL + signed parameters for an invoice. */
export function payFastOrder(invoice: any, notifyUrl: string, returnUrl: string, cancelUrl: string) {
  // Never substitute placeholder credentials: a checkout built with them looks
  // legitimate to the caller but is rejected by the gateway at the worst moment.
  if (!config.payfastConfigured) {
    throw new Error(
      "PayFast is not configured. Set PAYFAST_MERCHANT_ID, PAYFAST_MERCHANT_KEY and " +
        "PAYFAST_PASSPHRASE before issuing a payment link.",
    );
  }
  const merchantId = config.payfastMerchantId;
  const merchantKey = config.payfastMerchantKey;
  const base = config.payfastSandbox
    ? "https://sandbox.payfast.co.za/eng/process"
    : "https://www.payfast.co.za/eng/process";

  const params: Record<string, string> = {
    merchant_id: merchantId,
    merchant_key: merchantKey,
    amount: Number(invoice.gross_amount_zar).toFixed(2),
    item_name: `SCHOOL ${invoice.tier} licence`,
    item_description: invoice.description || `Invoice ${invoice.number}`,
    return_url: returnUrl,
    cancel_url: cancelUrl,
    notify_url: notifyUrl,
    merchant_id_ref: invoice.number,
    custom_str1: invoice.id,
  };

  // signature over the params (excluding signature itself), with passphrase
  const body = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v)).replace(/%20/g, "+")}`)
    .join("&");
  let toSign = body;
  if (config.payfastPassphrase) toSign += `&passphrase=${encodeURIComponent(config.payfastPassphrase)}`;
  params["signature"] = createHmac("md5", config.payfastPassphrase || "").update(toSign).digest("hex");

  return { url: base, params };
}

/**
 * Verify a PayFast ITN callback and reconcile the referenced invoice.
 * Returns a reconciliation result, or null when the signature fails / invoice
 * cannot be matched. (Real deployments SHOULD additionally re-validate against
 * PayFast's ITN in query-string on payment_cancelled path is not required.)
 */
export async function handlePayFastItn(body: Record<string, string>): Promise<{ ok: boolean; invoiceId?: string; status?: string; detail?: string }> {
  const signature = body["signature"];
  if (!signature) return { ok: false, detail: "missing signature" };

  const params = { ...body };
  delete params["signature"];
  const query = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v)).replace(/%20/g, "+")}`)
    .sort()
    .join("&");
  const expected = params
    ? createHmac("md5", config.payfastPassphrase || "")
        .update(query + (config.payfastPassphrase ? `&passphrase=${encodeURIComponent(config.payfastPassphrase)}` : ""))
        .digest("hex")
    : "";
  if (expected !== signature) return { ok: false, detail: "invalid signature" };
  if (body["payment_status"] !== "COMPLETE") return { ok: false, detail: `status ${body["payment_status"]}` };

  const invoice = await pool.query(
    `SELECT id::text FROM invoices WHERE number = $1 OR id = $2`,
    [body["merchant_id_ref"], body["custom_str1"]]
  );
  if (invoice.rows.length === 0) return { ok: false, detail: "invoice not found" };

  const amount = Number(body["amount_gross"] || body["amount"]);
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, detail: "bad amount" };

  const reconciled = await applyPayment(invoice.rows[0].id, amount, "payfast", body["pf_payment_id"], body["pf_payment_id"]);
  return { ok: true, invoiceId: invoice.rows[0].id, status: reconciled?.status };
}

/** Generate a cryptographically random invoice id for idempotent confirmation links. */
export function invoiceConfirmationToken(): string {
  return randomBytes(16).toString("hex");
}