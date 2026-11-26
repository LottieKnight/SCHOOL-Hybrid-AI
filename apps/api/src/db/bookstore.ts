import { PoolClient } from "pg";
import { pool } from "./pool.js";
import { deriveLicenseFlags, type SupportedLicense } from "../lib/license_rules.js";

export type BookstoreProductRecord = {
  id: string;
  slug: string;
  title: string;
  description: string;
  phase: string;
  grade_min: number;
  grade_max: number;
  subjects: string[];
  format: string;
  price_cents: number;
  currency: string;
  is_free: boolean;
  license_id: string | null;
  license_type: string;
  adapted_license_type: string | null;
  license_url: string | null;
  attribution_html: string;
  source_url: string | null;
  source_provider: string;
  supplier_id: string | null;
  nd_no_derivatives: boolean;
  nc_noncommercial: boolean;
  sa_sharealike: boolean;
  is_adapted: boolean;
  is_excerpt: boolean;
  is_partial_product: boolean;
  storage_key: string | null;
  delivery_mode: string | null;
  file_type: string | null;
  file_size: number | null;
  checksum: string | null;
  external_download_url: string | null;
  fulfillment_type: string;
  pod_spec_json: Record<string, unknown>;
  pod_base_cost_cents: number | null;
  target_margin_rate: number | null;
  vat_inclusive: boolean;
  shipping_profile_id: string | null;
  stock_qty: number | null;
  tags: string[];
  metadata_json: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type BookstoreProductFilters = {
  phase?: string | null;
  grade?: number | null;
  subject?: string | null;
  format?: string | null;
  priceType?: "all" | "free" | "paid" | null;
  licenseTypes?: string[] | null;
  commercialAllowedOnly?: boolean;
  q?: string | null;
  page?: number;
  pageSize?: number;
};

export type BookstoreProductInput = {
  id?: string | null;
  slug?: string | null;
  title: string;
  description: string;
  phase: string;
  grade_min: number;
  grade_max: number;
  subjects: string[];
  format: string;
  price_cents: number;
  currency?: string;
  license_id?: string | null;
  license_type: string;
  adapted_license_type?: string | null;
  license_url?: string | null;
  attribution_html?: string;
  source_url?: string | null;
  source_provider: string;
  supplier_id?: string | null;
  is_adapted?: boolean;
  is_excerpt?: boolean;
  is_partial_product?: boolean;
  storage_key?: string | null;
  delivery_mode?: "LINK_ONLY" | "FILE_DOWNLOAD" | null;
  file_type?: string | null;
  file_size?: number | null;
  checksum?: string | null;
  external_download_url?: string | null;
  fulfillment_type: string;
  pod_spec_json?: Record<string, unknown>;
  pod_base_cost_cents?: number | null;
  target_margin_rate?: number | null;
  vat_inclusive?: boolean;
  shipping_profile_id?: string | null;
  stock_qty?: number | null;
  tags?: string[];
  metadata_json?: Record<string, unknown>;
  is_active?: boolean;
};

export type BookstoreCartItemInput = {
  productId: string;
  quantity: number;
};

export type ValidatedCartItem = {
  product: BookstoreProductRecord;
  quantity: number;
  unit_price_cents: number;
  line_total_cents: number;
};

export type BookstoreOrderRecord = {
  id: string;
  user_id: string;
  status: string;
  subtotal_cents: number;
  shipping_cents: number;
  tax_cents: number;
  total_cents: number;
  currency: string;
  payment_provider: string | null;
  payment_intent_id: string | null;
  payment_status: string;
  fulfillment_status: string;
  address_json: Record<string, unknown>;
  notes_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type BookstoreOrderItemRecord = {
  id: string;
  order_id: string;
  product_id: string | null;
  product_slug: string | null;
  product_title: string;
  product_license_type: string;
  product_license_url: string | null;
  product_attribution_html: string;
  product_source_url: string | null;
  product_source_provider: string | null;
  fulfillment_type: string;
  quantity: number;
  unit_price_cents: number;
  line_total_cents: number;
  product_snapshot_json: Record<string, unknown>;
  created_at: string;
};

export type BookstoreOrderWithItems = {
  order: BookstoreOrderRecord;
  items: BookstoreOrderItemRecord[];
};

export type BookstoreSupplierType =
  | "OER_PROVIDER"
  | "POD_PRINTER"
  | "WHOLESALER"
  | "PUBLISHER_DIRECT"
  | "PLATFORM_PARTNER";

export type BookstoreSupplierRecord = {
  id: string;
  name: string;
  supplier_type: BookstoreSupplierType;
  provider_code: string;
  contact_email: string | null;
  api_base_url: string | null;
  website: string | null;
  terms_url: string | null;
  notes: string | null;
  metadata_json: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type BookstoreLicenseRecord = {
  id: string;
  type: string;
  url: string | null;
  is_commercial_allowed: boolean;
  is_derivative_allowed: boolean;
  requires_sharealike: boolean;
  requires_attribution: boolean;
  created_at: string;
  updated_at: string;
};

export type BookstoreDownloadTokenRecord = {
  id: string;
  order_id: string;
  product_id: string;
  token: string;
  user_id: string | null;
  expires_at: string;
  max_uses: number;
  used_count: number;
  created_at: string;
  last_used_at: string | null;
};

function normalizeArray(values?: string[] | null) {
  return (values ?? [])
    .map((value) => value.trim())
    .filter(Boolean);
}

async function ensureBookstoreLicense(input: { type: string; url?: string | null }) {
  const licenseType = (input.type || "").trim();
  if (!licenseType) return null;

  const normalizedUrl = input.url?.trim() || null;
  const supported = [
    "CC_BY",
    "CC_BY_SA",
    "CC_BY_ND",
    "CC_BY_NC",
    "CC_BY_NC_SA",
    "CC_BY_NC_ND",
    "PUBLIC_DOMAIN",
    "ALL_RIGHTS_RESERVED",
  ] as const;

  const flags = supported.includes(licenseType as (typeof supported)[number])
    ? deriveLicenseFlags(licenseType as SupportedLicense)
    : {
        isCommercialAllowed: true,
        isDerivativeAllowed: false,
        requiresShareAlike: false,
        requiresAttribution: false,
      };

  const existing = await pool.query<BookstoreLicenseRecord>(
    `SELECT *
     FROM bookstore_licenses
     WHERE type = $1
       AND COALESCE(url, '') = COALESCE($2, '')
     LIMIT 1`,
    [licenseType, normalizedUrl]
  );
  if (existing.rows[0]) {
    const updated = await pool.query<BookstoreLicenseRecord>(
      `UPDATE bookstore_licenses
       SET is_commercial_allowed = $2,
           is_derivative_allowed = $3,
           requires_sharealike = $4,
           requires_attribution = $5,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        existing.rows[0].id,
        flags.isCommercialAllowed,
        flags.isDerivativeAllowed,
        flags.requiresShareAlike,
        flags.requiresAttribution,
      ]
    );
    return updated.rows[0] ?? existing.rows[0];
  }

  const inserted = await pool.query<BookstoreLicenseRecord>(
    `INSERT INTO bookstore_licenses (
       type, url, is_commercial_allowed, is_derivative_allowed, requires_sharealike, requires_attribution, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,NOW())
     ON CONFLICT DO NOTHING
     RETURNING *`,
    [
      licenseType,
      normalizedUrl,
      flags.isCommercialAllowed,
      flags.isDerivativeAllowed,
      flags.requiresShareAlike,
      flags.requiresAttribution,
    ]
  );
  if (inserted.rows[0]) return inserted.rows[0];
  const fallback = await pool.query<BookstoreLicenseRecord>(
    `SELECT *
     FROM bookstore_licenses
     WHERE type = $1
       AND COALESCE(url, '') = COALESCE($2, '')
     LIMIT 1`,
    [licenseType, normalizedUrl]
  );
  return fallback.rows[0] ?? null;
}

export function slugifyProductTitle(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function productColumns(alias = "p") {
  return [
    `${alias}.id`,
    `${alias}.slug`,
    `${alias}.title`,
    `${alias}.description`,
    `${alias}.phase`,
    `${alias}.grade_min`,
    `${alias}.grade_max`,
    `${alias}.subjects`,
    `${alias}.format`,
    `${alias}.price_cents`,
    `${alias}.currency`,
    `${alias}.is_free`,
    `${alias}.license_id`,
    `${alias}.license_type`,
    `${alias}.adapted_license_type`,
    `${alias}.license_url`,
    `${alias}.attribution_html`,
    `${alias}.source_url`,
    `${alias}.source_provider`,
    `${alias}.supplier_id`,
    `${alias}.nd_no_derivatives`,
    `${alias}.nc_noncommercial`,
    `${alias}.sa_sharealike`,
    `${alias}.is_adapted`,
    `${alias}.is_excerpt`,
    `${alias}.is_partial_product`,
    `${alias}.storage_key`,
    `${alias}.delivery_mode`,
    `${alias}.file_type`,
    `${alias}.file_size`,
    `${alias}.checksum`,
    `${alias}.external_download_url`,
    `${alias}.fulfillment_type`,
    `${alias}.pod_spec_json`,
    `${alias}.pod_base_cost_cents`,
    `${alias}.target_margin_rate`,
    `${alias}.vat_inclusive`,
    `${alias}.shipping_profile_id`,
    `${alias}.stock_qty`,
    `${alias}.tags`,
    `${alias}.metadata_json`,
    `${alias}.is_active`,
    `${alias}.created_at`,
    `${alias}.updated_at`,
  ].join(", ");
}

export async function listBookstoreProducts(filters: BookstoreProductFilters) {
  const where: string[] = ["p.is_active = true"];
  const params: unknown[] = [];
  const push = (value: unknown) => {
    params.push(value);
    return `$${params.length}`;
  };

  if (filters.phase) {
    where.push(`p.phase = ${push(filters.phase)}`);
  }
  if (Number.isFinite(filters.grade ?? NaN)) {
    where.push(`p.grade_min <= ${push(filters.grade)} AND p.grade_max >= $${params.length}`);
  }
  if (filters.subject) {
    const placeholder = push(String(filters.subject).trim());
    where.push(
      `EXISTS (SELECT 1 FROM unnest(p.subjects) s WHERE lower(s) = lower(${placeholder}))`
    );
  }
  if (filters.format) {
    where.push(`p.format = ${push(filters.format)}`);
  }
  if (filters.priceType === "free") {
    where.push("p.price_cents = 0");
  } else if (filters.priceType === "paid") {
    where.push("p.price_cents > 0");
  }
  if (filters.licenseTypes?.length) {
    where.push(`p.license_type = ANY(${push(filters.licenseTypes)})`);
  }
  if (filters.commercialAllowedOnly) {
    where.push("p.nc_noncommercial = false");
  }
  if (filters.q && filters.q.trim()) {
    const q = `%${filters.q.trim()}%`;
    const p1 = push(q);
    const p2 = push(q);
    where.push(`(p.title ILIKE ${p1} OR p.description ILIKE ${p2})`);
  }

  const page = Math.max(filters.page ?? 1, 1);
  const pageSize = Math.min(Math.max(filters.pageSize ?? 24, 1), 100);
  const offset = (page - 1) * pageSize;

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const totalResult = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM bookstore_products p ${whereSql}`,
    params
  );
  const total = Number(totalResult.rows[0]?.count ?? 0);

  const rows = await pool.query<BookstoreProductRecord>(
    `SELECT ${productColumns("p")}
     FROM bookstore_products p
     ${whereSql}
     ORDER BY p.title ASC, p.created_at DESC
     LIMIT ${push(pageSize)} OFFSET ${push(offset)}`,
    params
  );

  return {
    products: rows.rows,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}

export async function getBookstoreProductByIdOrSlug(value: string) {
  const result = await pool.query<BookstoreProductRecord>(
    `SELECT ${productColumns("p")}
     FROM bookstore_products p
     WHERE p.id::text = $1 OR p.slug = $1
     LIMIT 1`,
    [value]
  );
  return result.rows[0] ?? null;
}

export async function listBookstoreProductsByIds(ids: string[]) {
  if (!ids.length) return [];
  const result = await pool.query<BookstoreProductRecord>(
    `SELECT ${productColumns("p")}
     FROM bookstore_products p
     WHERE p.id = ANY($1::uuid[])
       AND p.is_active = true`,
    [ids]
  );
  return result.rows;
}

export async function upsertBookstoreProduct(input: BookstoreProductInput) {
  const slug = (input.slug || slugifyProductTitle(input.title) || `product-${Date.now()}`).trim();
  const licenseRecord =
    input.license_type && input.license_type !== "OTHER"
      ? await ensureBookstoreLicense({ type: input.license_type, url: input.license_url ?? null })
      : await ensureBookstoreLicense({ type: input.license_type, url: input.license_url ?? null });
  const inferredDeliveryMode =
    input.delivery_mode ??
    (input.fulfillment_type === "LINK_ONLY"
      ? "LINK_ONLY"
      : input.fulfillment_type === "FILE_DOWNLOAD"
        ? "FILE_DOWNLOAD"
        : null);
  const result = await pool.query<BookstoreProductRecord>(
    `INSERT INTO bookstore_products (
       id, slug, title, description, phase, grade_min, grade_max, subjects, format, price_cents, currency,
       license_id, license_type, adapted_license_type, license_url, attribution_html, source_url, source_provider,
       supplier_id, is_adapted, is_excerpt, is_partial_product,
       storage_key, delivery_mode, file_type, file_size, checksum, external_download_url, fulfillment_type,
       pod_spec_json, pod_base_cost_cents, target_margin_rate, vat_inclusive,
       shipping_profile_id, stock_qty, tags, metadata_json, is_active, updated_at
     ) VALUES (
       COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
       $12, $13, $14, $15, $16, $17, $18,
       $19, $20, $21, $22,
       $23, $24, $25, $26, $27, $28, $29,
       $30, $31, $32, $33,
       $34, $35, $36, $37, $38, NOW()
     )
     ON CONFLICT (slug) DO UPDATE SET
       title = EXCLUDED.title,
       description = EXCLUDED.description,
       phase = EXCLUDED.phase,
       grade_min = EXCLUDED.grade_min,
       grade_max = EXCLUDED.grade_max,
       subjects = EXCLUDED.subjects,
       format = EXCLUDED.format,
       price_cents = EXCLUDED.price_cents,
       currency = EXCLUDED.currency,
       license_id = EXCLUDED.license_id,
       license_type = EXCLUDED.license_type,
       adapted_license_type = EXCLUDED.adapted_license_type,
       license_url = EXCLUDED.license_url,
       attribution_html = EXCLUDED.attribution_html,
       source_url = EXCLUDED.source_url,
       source_provider = EXCLUDED.source_provider,
       supplier_id = EXCLUDED.supplier_id,
       is_adapted = EXCLUDED.is_adapted,
       is_excerpt = EXCLUDED.is_excerpt,
       is_partial_product = EXCLUDED.is_partial_product,
       storage_key = EXCLUDED.storage_key,
       delivery_mode = EXCLUDED.delivery_mode,
       file_type = EXCLUDED.file_type,
       file_size = EXCLUDED.file_size,
       checksum = EXCLUDED.checksum,
       external_download_url = EXCLUDED.external_download_url,
       fulfillment_type = EXCLUDED.fulfillment_type,
       pod_spec_json = EXCLUDED.pod_spec_json,
       pod_base_cost_cents = EXCLUDED.pod_base_cost_cents,
       target_margin_rate = EXCLUDED.target_margin_rate,
       vat_inclusive = EXCLUDED.vat_inclusive,
       shipping_profile_id = EXCLUDED.shipping_profile_id,
       stock_qty = EXCLUDED.stock_qty,
       tags = EXCLUDED.tags,
       metadata_json = EXCLUDED.metadata_json,
       is_active = EXCLUDED.is_active,
       updated_at = NOW()
     RETURNING ${productColumns()}`,
    [
      input.id ?? null,
      slug,
      input.title.trim(),
      input.description ?? "",
      input.phase,
      input.grade_min,
      input.grade_max,
      normalizeArray(input.subjects),
      input.format,
      Math.max(0, Math.floor(input.price_cents ?? 0)),
      (input.currency || "ZAR").trim().toUpperCase(),
      input.license_id ?? licenseRecord?.id ?? null,
      input.license_type,
      input.adapted_license_type ?? null,
      input.license_url ?? null,
      input.attribution_html ?? "",
      input.source_url ?? null,
      input.source_provider,
      input.supplier_id ?? null,
      Boolean(input.is_adapted),
      Boolean(input.is_excerpt),
      Boolean(input.is_partial_product),
      input.storage_key ?? null,
      inferredDeliveryMode,
      input.file_type ?? null,
      input.file_size ?? null,
      input.checksum ?? null,
      input.external_download_url ?? null,
      input.fulfillment_type,
      input.pod_spec_json ?? {},
      input.pod_base_cost_cents ?? null,
      input.target_margin_rate ?? null,
      input.vat_inclusive ?? true,
      input.shipping_profile_id ?? null,
      input.stock_qty ?? null,
      normalizeArray(input.tags),
      input.metadata_json ?? {},
      input.is_active ?? true,
    ]
  );
  return result.rows[0] ?? null;
}

export async function validateBookstoreCart(items: BookstoreCartItemInput[]) {
  const normalized = items
    .map((item) => ({
      productId: item.productId,
      quantity: Math.min(Math.max(Math.floor(item.quantity || 0), 1), 20),
    }))
    .filter((item) => item.productId);
  if (!normalized.length) return { items: [] as ValidatedCartItem[], subtotal_cents: 0, currency: "ZAR" };

  const products = await listBookstoreProductsByIds(normalized.map((item) => item.productId));
  const productMap = new Map(products.map((product) => [product.id, product]));

  const validated: ValidatedCartItem[] = [];
  let subtotal = 0;
  for (const item of normalized) {
    const product = productMap.get(item.productId);
    if (!product) continue;
    const unitPrice = product.price_cents || 0;
    const lineTotal = unitPrice * item.quantity;
    subtotal += lineTotal;
    validated.push({
      product,
      quantity: item.quantity,
      unit_price_cents: unitPrice,
      line_total_cents: lineTotal,
    });
  }

  return {
    items: validated,
    subtotal_cents: subtotal,
    currency: validated[0]?.product.currency || "ZAR",
  };
}

export async function createBookstoreOrder(
  userId: string,
  input: {
    items: ValidatedCartItem[];
    address_json?: Record<string, unknown>;
    notes_json?: Record<string, unknown>;
    status: string;
    payment_status: string;
    fulfillment_status: string;
    payment_provider?: string | null;
    payment_intent_id?: string | null;
    shipping_cents?: number;
    tax_cents?: number;
  }
): Promise<BookstoreOrderWithItems> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const subtotal = input.items.reduce((sum, item) => sum + item.line_total_cents, 0);
    const shipping = Math.max(0, input.shipping_cents ?? 0);
    const tax = Math.max(0, input.tax_cents ?? 0);
    const total = subtotal + shipping + tax;
    const currency = input.items[0]?.product.currency || "ZAR";

    const orderRes = await client.query<BookstoreOrderRecord>(
      `INSERT INTO bookstore_orders (
         user_id, status, subtotal_cents, shipping_cents, tax_cents, total_cents, currency,
         payment_provider, payment_intent_id, payment_status, fulfillment_status, address_json, notes_json
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [
        userId,
        input.status,
        subtotal,
        shipping,
        tax,
        total,
        currency,
        input.payment_provider ?? null,
        input.payment_intent_id ?? null,
        input.payment_status,
        input.fulfillment_status,
        input.address_json ?? {},
        input.notes_json ?? {},
      ]
    );
    const order = orderRes.rows[0];

    const orderItems: BookstoreOrderItemRecord[] = [];
    for (const item of input.items) {
      const snapshot = {
        id: item.product.id,
        slug: item.product.slug,
        title: item.product.title,
        license_type: item.product.license_type,
        adapted_license_type: item.product.adapted_license_type,
        license_url: item.product.license_url,
        attribution_html: item.product.attribution_html,
        source_url: item.product.source_url,
        source_provider: item.product.source_provider,
        subjects: item.product.subjects,
        phase: item.product.phase,
        grade_min: item.product.grade_min,
        grade_max: item.product.grade_max,
        format: item.product.format,
        fulfillment_type: item.product.fulfillment_type,
        is_adapted: item.product.is_adapted,
        sa_sharealike: item.product.sa_sharealike,
        nd_no_derivatives: item.product.nd_no_derivatives,
        nc_noncommercial: item.product.nc_noncommercial,
      };
      const row = await client.query<BookstoreOrderItemRecord>(
        `INSERT INTO bookstore_order_items (
           order_id, product_id, product_slug, product_title, product_license_type, product_license_url,
           product_attribution_html, product_source_url, product_source_provider, fulfillment_type,
           quantity, unit_price_cents, line_total_cents, product_snapshot_json
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         RETURNING *`,
        [
          order.id,
          item.product.id,
          item.product.slug,
          item.product.title,
          item.product.license_type,
          item.product.license_url,
          item.product.attribution_html ?? "",
          item.product.source_url,
          item.product.source_provider,
          item.product.fulfillment_type,
          item.quantity,
          item.unit_price_cents,
          item.line_total_cents,
          snapshot,
        ]
      );
      orderItems.push(row.rows[0]);
    }

    await client.query("COMMIT");
    return { order, items: orderItems };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateBookstoreOrderPayment(
  orderId: string,
  input: { status?: string; payment_status?: string; fulfillment_status?: string; payment_intent_id?: string | null }
) {
  const result = await pool.query<BookstoreOrderRecord>(
    `UPDATE bookstore_orders
     SET status = COALESCE($2, status),
         payment_status = COALESCE($3, payment_status),
         fulfillment_status = COALESCE($4, fulfillment_status),
         payment_intent_id = COALESCE($5, payment_intent_id),
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [orderId, input.status ?? null, input.payment_status ?? null, input.fulfillment_status ?? null, input.payment_intent_id ?? null]
  );
  return result.rows[0] ?? null;
}

export async function updateBookstoreOrderStatus(orderId: string, status: string) {
  const result = await pool.query<BookstoreOrderRecord>(
    `UPDATE bookstore_orders
     SET status = $2, updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [orderId, status]
  );
  return result.rows[0] ?? null;
}

async function listOrderItemsByOrderIds(orderIds: string[]) {
  if (!orderIds.length) return [];
  const result = await pool.query<BookstoreOrderItemRecord>(
    `SELECT *
     FROM bookstore_order_items
     WHERE order_id = ANY($1::uuid[])
     ORDER BY created_at ASC`,
    [orderIds]
  );
  return result.rows;
}

export async function listBookstoreOrdersForUser(userId: string) {
  const orderRes = await pool.query<BookstoreOrderRecord>(
    `SELECT *
     FROM bookstore_orders
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 100`,
    [userId]
  );
  const items = await listOrderItemsByOrderIds(orderRes.rows.map((row) => row.id));
  const itemsByOrder = new Map<string, BookstoreOrderItemRecord[]>();
  for (const item of items) {
    const list = itemsByOrder.get(item.order_id) ?? [];
    list.push(item);
    itemsByOrder.set(item.order_id, list);
  }
  return orderRes.rows.map((order) => ({ order, items: itemsByOrder.get(order.id) ?? [] }));
}

export async function listBookstoreOrdersForAdmin(limit = 200) {
  const bounded = Math.min(Math.max(limit, 1), 500);
  const orderRes = await pool.query<BookstoreOrderRecord & { user_email: string | null }>(
    `SELECT o.*, u.email AS user_email
     FROM bookstore_orders o
     LEFT JOIN users u ON u.id = o.user_id
     ORDER BY o.created_at DESC
     LIMIT $1`,
    [bounded]
  );
  const items = await listOrderItemsByOrderIds(orderRes.rows.map((row) => row.id));
  const itemsByOrder = new Map<string, BookstoreOrderItemRecord[]>();
  for (const item of items) {
    const list = itemsByOrder.get(item.order_id) ?? [];
    list.push(item);
    itemsByOrder.set(item.order_id, list);
  }
  return orderRes.rows.map((order) => ({
    ...order,
    items: itemsByOrder.get(order.id) ?? [],
  }));
}

export async function getBookstoreOrderForUser(orderId: string, userId: string) {
  const orderRes = await pool.query<BookstoreOrderRecord>(
    `SELECT * FROM bookstore_orders WHERE id = $1 AND user_id = $2 LIMIT 1`,
    [orderId, userId]
  );
  const order = orderRes.rows[0];
  if (!order) return null;
  const itemsRes = await pool.query<BookstoreOrderItemRecord>(
    `SELECT * FROM bookstore_order_items WHERE order_id = $1 ORDER BY created_at ASC`,
    [orderId]
  );
  return { order, items: itemsRes.rows };
}

export async function getBookstoreOrderForAdmin(orderId: string) {
  const orderRes = await pool.query<BookstoreOrderRecord>(
    `SELECT * FROM bookstore_orders WHERE id = $1 LIMIT 1`,
    [orderId]
  );
  const order = orderRes.rows[0];
  if (!order) return null;
  const itemsRes = await pool.query<BookstoreOrderItemRecord>(
    `SELECT * FROM bookstore_order_items WHERE order_id = $1 ORDER BY created_at ASC`,
    [orderId]
  );
  return { order, items: itemsRes.rows };
}

export async function recordBookstoreDownloadEvent(input: {
  productId: string;
  orderId?: string | null;
  userId?: string | null;
  eventType?: string;
  metadata?: Record<string, unknown>;
}) {
  const result = await pool.query(
    `INSERT INTO bookstore_download_events (order_id, product_id, user_id, event_type, metadata_json)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [input.orderId ?? null, input.productId, input.userId ?? null, input.eventType ?? "download", input.metadata ?? {}]
  );
  return result.rows[0] ?? null;
}

export async function createBookstoreDownloadToken(input: {
  orderId: string;
  productId: string;
  token: string;
  userId?: string | null;
  expiresAt: string | Date;
  maxUses?: number;
}) {
  const result = await pool.query<BookstoreDownloadTokenRecord>(
    `INSERT INTO bookstore_download_tokens (
       order_id, product_id, token, user_id, expires_at, max_uses
     ) VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      input.orderId,
      input.productId,
      input.token,
      input.userId ?? null,
      input.expiresAt instanceof Date ? input.expiresAt.toISOString() : input.expiresAt,
      Math.max(1, Math.floor(input.maxUses ?? 1)),
    ]
  );
  return result.rows[0] ?? null;
}

export async function getBookstoreDownloadToken(token: string) {
  const result = await pool.query<BookstoreDownloadTokenRecord>(
    `SELECT *
     FROM bookstore_download_tokens
     WHERE token = $1
     LIMIT 1`,
    [token]
  );
  return result.rows[0] ?? null;
}

export async function consumeBookstoreDownloadToken(token: string) {
  const result = await pool.query<BookstoreDownloadTokenRecord>(
    `UPDATE bookstore_download_tokens
     SET used_count = used_count + 1,
         last_used_at = NOW()
     WHERE token = $1
       AND expires_at > NOW()
       AND used_count < max_uses
     RETURNING *`,
    [token]
  );
  return result.rows[0] ?? null;
}

export async function createBookstoreIngestJob(input: {
  jobType: string;
  source: string;
  status: string;
  result: Record<string, unknown>;
  createdBy?: string | null;
}) {
  const result = await pool.query(
    `INSERT INTO bookstore_ingest_jobs (job_type, source, status, result_json, created_by)
     VALUES ($1,$2,$3,$4,$5)
     RETURNING *`,
    [input.jobType, input.source, input.status, input.result, input.createdBy ?? null]
  );
  return result.rows[0] ?? null;
}

export async function listBookstoreIngestJobs(limit = 50) {
  const bounded = Math.min(Math.max(limit, 1), 200);
  const result = await pool.query(
    `SELECT *
     FROM bookstore_ingest_jobs
     ORDER BY created_at DESC
     LIMIT $1`,
    [bounded]
  );
  return result.rows;
}

export async function listBookstoreSuppliers(limit = 100) {
  const bounded = Math.min(Math.max(limit, 1), 500);
  const result = await pool.query<BookstoreSupplierRecord>(
    `SELECT *
     FROM bookstore_suppliers
     ORDER BY supplier_type ASC, name ASC
     LIMIT $1`,
    [bounded]
  );
  return result.rows;
}

export async function upsertBookstoreSupplier(input: {
  id?: string | null;
  name: string;
  supplier_type: BookstoreSupplierType;
  provider_code: string;
  contact_email?: string | null;
  api_base_url?: string | null;
  website?: string | null;
  terms_url?: string | null;
  notes?: string | null;
  metadata_json?: Record<string, unknown>;
  is_active?: boolean;
}) {
  const result = await pool.query<BookstoreSupplierRecord>(
    `INSERT INTO bookstore_suppliers (
       id, name, supplier_type, provider_code, contact_email, api_base_url, website, terms_url, notes,
       metadata_json, is_active, updated_at
     ) VALUES (
       COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW()
     )
     ON CONFLICT (provider_code) DO UPDATE SET
       name = EXCLUDED.name,
       supplier_type = EXCLUDED.supplier_type,
       contact_email = EXCLUDED.contact_email,
       api_base_url = EXCLUDED.api_base_url,
       website = EXCLUDED.website,
       terms_url = EXCLUDED.terms_url,
       notes = EXCLUDED.notes,
       metadata_json = EXCLUDED.metadata_json,
       is_active = EXCLUDED.is_active,
       updated_at = NOW()
     RETURNING *`,
    [
      input.id ?? null,
      input.name.trim(),
      input.supplier_type,
      input.provider_code.trim(),
      input.contact_email ?? null,
      input.api_base_url ?? null,
      input.website ?? null,
      input.terms_url ?? null,
      input.notes ?? null,
      input.metadata_json ?? {},
      input.is_active ?? true,
    ]
  );
  return result.rows[0] ?? null;
}

export async function createBookstoreSupplierImportJob(input: {
  supplierId?: string | null;
  supplierType: string;
  importFormat: "CSV" | "ONIX" | "MANUAL";
  status: "queued" | "running" | "completed" | "failed";
  sourceRef?: string | null;
  result?: Record<string, unknown>;
  createdBy?: string | null;
  startedAt?: string | Date | null;
  finishedAt?: string | Date | null;
}) {
  const result = await pool.query(
    `INSERT INTO bookstore_supplier_import_jobs (
       supplier_id, supplier_type, import_format, status, source_ref, result_json, created_by, started_at, finished_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [
      input.supplierId ?? null,
      input.supplierType,
      input.importFormat,
      input.status,
      input.sourceRef ?? null,
      input.result ?? {},
      input.createdBy ?? null,
      input.startedAt instanceof Date ? input.startedAt.toISOString() : (input.startedAt ?? null),
      input.finishedAt instanceof Date ? input.finishedAt.toISOString() : (input.finishedAt ?? null),
    ]
  );
  return result.rows[0] ?? null;
}

export async function withBookstoreTransaction<T>(fn: (client: PoolClient) => Promise<T>) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
