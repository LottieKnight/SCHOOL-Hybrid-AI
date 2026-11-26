import { pool } from "./pool.js";

export type StoreVendorRecord = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  accent: string;
  badge: string;
  icon_key: string;
  config_json: Record<string, unknown>;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type StoreCategoryRecord = {
  id: string;
  store_id: string;
  slug: string;
  name: string;
  parent_id: string | null;
  sort_order: number;
};

export type StoreProductRecord = {
  id: string;
  store_id: string;
  category_id: string | null;
  slug: string;
  title: string;
  description: string;
  price_cents: number;
  source_cost_cents: number;
  courier_cents: number;
  currency: string;
  images: string[];
  variants_json: Record<string, unknown>[];
  attributes_json: Record<string, unknown>;
  fulfillment_type: string;
  stock_qty: number | null;
  tags: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type StoreCartItemInput = {
  productId: string;
  quantity: number;
};

export type ValidatedStoreCartItem = {
  product: StoreProductRecord;
  store: StoreVendorRecord;
  quantity: number;
  unit_price_cents: number;
  line_total_cents: number;
};

export type StoreOrderRecord = {
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

export type StoreOrderItemRecord = {
  id: string;
  order_id: string;
  store_id: string | null;
  product_id: string | null;
  product_slug: string | null;
  product_title: string;
  quantity: number;
  unit_price_cents: number;
  line_total_cents: number;
  variant_choice_json: Record<string, unknown>;
  product_snapshot_json: Record<string, unknown>;
  created_at: string;
};

export type StoreOrderWithItems = {
  order: StoreOrderRecord;
  items: StoreOrderItemRecord[];
};

export type StoreProductFilters = {
  category?: string | null;
  q?: string | null;
  priceType?: "all" | "free" | "paid" | null;
  tag?: string | null;
  page?: number | null;
  pageSize?: number | null;
};

function rowToVendor(row: StoreVendorRecord): StoreVendorRecord {
  return { ...row };
}

function rowToProduct(row: StoreProductRecord): StoreProductRecord {
  return { ...row };
}

export async function listStores(includeInactive = false): Promise<StoreVendorRecord[]> {
  const result = await pool.query<StoreVendorRecord>(
    `SELECT * FROM store_vendors
     WHERE is_active = TRUE OR $1
     ORDER BY sort_order, name`,
    [includeInactive]
  );
  return result.rows.map(rowToVendor);
}

export async function getStoreBySlug(slug: string): Promise<StoreVendorRecord | null> {
  const result = await pool.query<StoreVendorRecord>(
    `SELECT * FROM store_vendors WHERE slug = $1 LIMIT 1`,
    [slug]
  );
  return result.rows[0] ? rowToVendor(result.rows[0]) : null;
}

export async function getStoreById(id: string): Promise<StoreVendorRecord | null> {
  const result = await pool.query<StoreVendorRecord>(
    `SELECT * FROM store_vendors WHERE id = $1 LIMIT 1`,
    [id]
  );
  return result.rows[0] ? rowToVendor(result.rows[0]) : null;
}

export async function listStoreCategories(storeId: string): Promise<StoreCategoryRecord[]> {
  const result = await pool.query<StoreCategoryRecord>(
    `SELECT * FROM store_categories
     WHERE store_id = $1
     ORDER BY sort_order, name`,
    [storeId]
  );
  return result.rows;
}

export async function listStoreProducts(
  storeId: string,
  filters: StoreProductFilters = {}
): Promise<{ products: StoreProductRecord[]; total: number; categories: StoreCategoryRecord[] }> {
  const where: string[] = ["store_id = $1", "is_active = TRUE"];
  const params: unknown[] = [storeId];
  const push = (value: unknown) => {
    params.push(value);
    return `$${params.length}`;
  };

  if (filters.category) {
    where.push(`category_id = ${push(filters.category)}`);
  }
  if (filters.q?.trim()) {
    const q = `%${filters.q.trim()}%`;
    where.push(`(title ILIKE ${push(q)} OR description ILIKE ${push(q)})`);
  }
  if (filters.tag) {
    where.push(`${push(filters.tag)} = ANY(tags)`);
  }
  if (filters.priceType === "free") {
    where.push("price_cents = 0");
  } else if (filters.priceType === "paid") {
    where.push("price_cents > 0");
  }

  const page = Math.max(filters.page ?? 1, 1);
  const pageSize = Math.min(Math.max(filters.pageSize ?? 24, 1), 100);
  const offset = (page - 1) * pageSize;
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const totalResult = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM store_products ${whereSql}`,
    params
  );
  const total = Number(totalResult.rows[0]?.count ?? 0);

  const rows = await pool.query<StoreProductRecord>(
    `SELECT * FROM store_products ${whereSql}
     ORDER BY created_at DESC
     LIMIT ${pageSize} OFFSET ${offset}`,
    params
  );
  const categories = await listStoreCategories(storeId);

  return {
    products: rows.rows.map(rowToProduct),
    total,
    categories,
  };
}

export async function getStoreProductBySlug(
  storeId: string,
  slug: string
): Promise<StoreProductRecord | null> {
  const result = await pool.query<StoreProductRecord>(
    `SELECT * FROM store_products
     WHERE store_id = $1 AND slug = $2 AND is_active = TRUE
     LIMIT 1`,
    [storeId, slug]
  );
  return result.rows[0] ? rowToProduct(result.rows[0]) : null;
}

export async function getStoreProductById(id: string): Promise<StoreProductRecord | null> {
  const result = await pool.query<StoreProductRecord>(
    `SELECT * FROM store_products WHERE id = $1 LIMIT 1`,
    [id]
  );
  return result.rows[0] ? rowToProduct(result.rows[0]) : null;
}

export async function listStoreProductsByIds(ids: string[]): Promise<StoreProductRecord[]> {
  if (!ids.length) return [];
  const result = await pool.query<StoreProductRecord>(
    `SELECT * FROM store_products WHERE id = ANY($1::uuid[])`,
    [ids]
  );
  return result.rows.map(rowToProduct);
}

export async function listStoresByIds(ids: string[]): Promise<StoreVendorRecord[]> {
  if (!ids.length) return [];
  const result = await pool.query<StoreVendorRecord>(
    `SELECT * FROM store_vendors WHERE id = ANY($1::uuid[])`,
    [ids]
  );
  return result.rows.map(rowToVendor);
}

export async function validateStoreCart(items: StoreCartItemInput[]) {
  const normalized = items
    .map((item) => ({
      productId: item.productId,
      quantity: Math.min(Math.max(Math.floor(item.quantity || 0), 1), 20),
    }))
    .filter((item) => item.productId);
  if (!normalized.length) {
    return { items: [] as ValidatedStoreCartItem[], subtotal_cents: 0, currency: "ZAR" };
  }

  const products = await listStoreProductsByIds(normalized.map((item) => item.productId));
  const productMap = new Map(products.map((product) => [product.id, product]));
  const storeIds = [...new Set(products.map((product) => product.store_id))];
  const stores = await listStoresByIds(storeIds);
  const storeMap = new Map(stores.map((store) => [store.id, store]));

  const validated: ValidatedStoreCartItem[] = [];
  let subtotal = 0;
  for (const item of normalized) {
    const product = productMap.get(item.productId);
    if (!product || !product.is_active) continue;
    const store = storeMap.get(product.store_id);
    if (!store) continue;
    const unitPrice = product.price_cents || 0;
    const lineTotal = unitPrice * item.quantity;
    subtotal += lineTotal;
    validated.push({
      product,
      store,
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

export async function createStoreOrder(
  userId: string,
  input: {
    items: ValidatedStoreCartItem[];
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
): Promise<StoreOrderWithItems> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const subtotal = input.items.reduce((sum, item) => sum + item.line_total_cents, 0);
    const shipping = Math.max(0, input.shipping_cents ?? 0);
    const tax = Math.max(0, input.tax_cents ?? 0);
    const total = subtotal + shipping + tax;
    const currency = input.items[0]?.product.currency || "ZAR";

    const orderRes = await client.query<StoreOrderRecord>(
      `INSERT INTO store_orders (
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

    const orderItems: StoreOrderItemRecord[] = [];
    for (const item of input.items) {
      const snapshot = {
        id: item.product.id,
        slug: item.product.slug,
        title: item.product.title,
        price_cents: item.product.price_cents,
        currency: item.product.currency,
        images: item.product.images,
        variants: item.product.variants_json,
        attributes: item.product.attributes_json,
        fulfillment_type: item.product.fulfillment_type,
      };
      const row = await client.query<StoreOrderItemRecord>(
        `INSERT INTO store_order_items (
           order_id, store_id, product_id, product_slug, product_title, quantity,
           unit_price_cents, line_total_cents, variant_choice_json, product_snapshot_json
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         RETURNING *`,
        [
          order.id,
          item.store.id,
          item.product.id,
          item.product.slug,
          item.product.title,
          item.quantity,
          item.unit_price_cents,
          item.line_total_cents,
          {},
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

export async function updateStoreOrderPayment(
  orderId: string,
  input: {
    payment_intent_id?: string | null;
    status?: string;
    payment_status?: string;
    fulfillment_status?: string;
  }
): Promise<StoreOrderRecord | null> {
  const result = await pool.query<StoreOrderRecord>(
    `UPDATE store_orders SET
       payment_intent_id = COALESCE($2, payment_intent_id),
       status = COALESCE($3, status),
       payment_status = COALESCE($4, payment_status),
       fulfillment_status = COALESCE($5, fulfillment_status),
       updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [
      orderId,
      input.payment_intent_id ?? null,
      input.status ?? null,
      input.payment_status ?? null,
      input.fulfillment_status ?? null,
    ]
  );
  return result.rows[0] ?? null;
}

export async function getStoreOrderForUser(
  orderId: string,
  userId: string
): Promise<StoreOrderWithItems | null> {
  const orderRes = await pool.query<StoreOrderRecord>(
    `SELECT * FROM store_orders WHERE id = $1 AND user_id = $2 LIMIT 1`,
    [orderId, userId]
  );
  const order = orderRes.rows[0];
  if (!order) return null;
  const itemsRes = await pool.query<StoreOrderItemRecord>(
    `SELECT * FROM store_order_items WHERE order_id = $1 ORDER BY created_at`,
    [orderId]
  );
  return { order, items: itemsRes.rows };
}

export async function getStoreOrderForAdmin(orderId: string): Promise<StoreOrderWithItems | null> {
  const orderRes = await pool.query<StoreOrderRecord>(
    `SELECT * FROM store_orders WHERE id = $1 LIMIT 1`,
    [orderId]
  );
  const order = orderRes.rows[0];
  if (!order) return null;
  const itemsRes = await pool.query<StoreOrderItemRecord>(
    `SELECT * FROM store_order_items WHERE order_id = $1 ORDER BY created_at`,
    [orderId]
  );
  return { order, items: itemsRes.rows };
}

export async function listStoreOrdersForUser(userId: string): Promise<StoreOrderWithItems[]> {
  const ordersRes = await pool.query<StoreOrderRecord>(
    `SELECT * FROM store_orders WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );
  const itemsRes = await pool.query<StoreOrderItemRecord>(
    `SELECT * FROM store_order_items WHERE order_id = ANY($1::uuid[]) ORDER BY created_at`,
    [ordersRes.rows.map((row) => row.id)]
  );
  const itemsByOrder = new Map<string, StoreOrderItemRecord[]>();
  for (const item of itemsRes.rows) {
    const list = itemsByOrder.get(item.order_id) ?? [];
    list.push(item);
    itemsByOrder.set(item.order_id, list);
  }
  return ordersRes.rows.map((order) => ({
    order,
    items: itemsByOrder.get(order.id) ?? [],
  }));
}

export async function listStoreOrdersForAdmin(
  storeId?: string
): Promise<StoreOrderWithItems[]> {
  const ordersRes = await pool.query<StoreOrderRecord>(
    `SELECT * FROM store_orders ORDER BY created_at DESC LIMIT 200`
  );
  if (!ordersRes.rows.length) return [];

  const itemsRes = await pool.query<StoreOrderItemRecord>(
    `SELECT * FROM store_order_items
     WHERE order_id = ANY($1::uuid[])
       AND ($2::uuid IS NULL OR store_id = $2)
     ORDER BY created_at`,
    [ordersRes.rows.map((row) => row.id), storeId ?? null]
  );
  const itemsByOrder = new Map<string, StoreOrderItemRecord[]>();
  for (const item of itemsRes.rows) {
    const list = itemsByOrder.get(item.order_id) ?? [];
    list.push(item);
    itemsByOrder.set(item.order_id, list);
  }
  return ordersRes.rows
    .map((order) => ({
      order,
      items: itemsByOrder.get(order.id) ?? [],
    }))
    .filter((entry) => !storeId || entry.items.length > 0);
}

export async function upsertStoreProduct(
  input: {
    store_id: string;
    category_id?: string | null;
    slug: string;
    title: string;
    description?: string;
    price_cents: number;
    currency?: string;
    images?: string[];
    variants_json?: Record<string, unknown>[];
    attributes_json?: Record<string, unknown>;
    fulfillment_type?: string;
    stock_qty?: number | null;
    tags?: string[];
    is_active?: boolean;
  }
): Promise<StoreProductRecord> {
  const slug = (input.slug || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const result = await pool.query<StoreProductRecord>(
    `INSERT INTO store_products (
       store_id, category_id, slug, title, description, price_cents, currency, images,
       variants_json, attributes_json, fulfillment_type, stock_qty, tags, is_active
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     ON CONFLICT (store_id, slug) DO UPDATE SET
       title = EXCLUDED.title,
       description = EXCLUDED.description,
       price_cents = EXCLUDED.price_cents,
       currency = EXCLUDED.currency,
       images = EXCLUDED.images,
       variants_json = EXCLUDED.variants_json,
       attributes_json = EXCLUDED.attributes_json,
       fulfillment_type = EXCLUDED.fulfillment_type,
       stock_qty = EXCLUDED.stock_qty,
       tags = EXCLUDED.tags,
       is_active = EXCLUDED.is_active,
       updated_at = NOW()
     RETURNING *`,
    [
      input.store_id,
      input.category_id ?? null,
      slug,
      input.title,
      input.description ?? "",
      input.price_cents,
      input.currency ?? "ZAR",
      input.images ?? [],
      JSON.stringify(input.variants_json ?? []),
      JSON.stringify(input.attributes_json ?? {}),
      input.fulfillment_type ?? "SHIP_FROM_SUPPLIER",
      input.stock_qty ?? null,
      input.tags ?? [],
      input.is_active ?? true,
    ]
  );
  return result.rows[0];
}

export async function upsertStoreVendor(
  input: {
    slug: string;
    name: string;
    tagline?: string;
    description?: string;
    accent?: string;
    badge?: string;
    icon_key?: string;
    config_json?: Record<string, unknown>;
    is_active?: boolean;
    sort_order?: number;
  }
): Promise<StoreVendorRecord> {
  const result = await pool.query<StoreVendorRecord>(
    `INSERT INTO store_vendors (
       slug, name, tagline, description, accent, badge, icon_key, config_json, is_active, sort_order
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (slug) DO UPDATE SET
       name = EXCLUDED.name,
       tagline = EXCLUDED.tagline,
       description = EXCLUDED.description,
       accent = EXCLUDED.accent,
       badge = EXCLUDED.badge,
       icon_key = EXCLUDED.icon_key,
       config_json = EXCLUDED.config_json,
       is_active = EXCLUDED.is_active,
       sort_order = EXCLUDED.sort_order,
       updated_at = NOW()
     RETURNING *`,
    [
      input.slug,
      input.name,
      input.tagline ?? "",
      input.description ?? "",
      input.accent ?? "#C9A24B",
      input.badge ?? "",
      input.icon_key ?? "store",
      input.config_json ?? {},
      input.is_active ?? true,
      input.sort_order ?? 0,
    ]
  );
  return result.rows[0];
}

export async function upsertStoreCategory(
  input: {
    store_id: string;
    slug: string;
    name: string;
    parent_id?: string | null;
    sort_order?: number;
  }
): Promise<StoreCategoryRecord> {
  const result = await pool.query<StoreCategoryRecord>(
    `INSERT INTO store_categories (store_id, slug, name, parent_id, sort_order)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (store_id, slug) DO UPDATE SET
       name = EXCLUDED.name,
       parent_id = EXCLUDED.parent_id,
       sort_order = EXCLUDED.sort_order,
       updated_at = NOW()
     RETURNING *`,
    [input.store_id, input.slug, input.name, input.parent_id ?? null, input.sort_order ?? 0]
  );
  return result.rows[0];
}

export async function createStoreQuoteRequest(
  input: {
    store_id: string;
    user_id?: string | null;
    items_json: unknown;
    customer_json?: Record<string, unknown>;
    notes?: string;
  }
): Promise<{ id: string; store_id: string; status: string; created_at: string }> {
  const result = await pool.query(
    `INSERT INTO store_quote_requests (store_id, user_id, items_json, customer_json, notes)
     VALUES ($1,$2,$3,$4,$5)
     RETURNING id, store_id, status, created_at`,
    [
      input.store_id,
      input.user_id ?? null,
      JSON.stringify(input.items_json),
      input.customer_json ?? {},
      input.notes ?? "",
    ]
  );
  return result.rows[0];
}

export async function listStoreQuoteRequests(
  storeId: string
): Promise<Array<{ id: string; store_id: string; user_id: string | null; status: string; created_at: string }>> {
  const result = await pool.query(
    `SELECT id, store_id, user_id, status, created_at
     FROM store_quote_requests
     WHERE store_id = $1
     ORDER BY created_at DESC`,
    [storeId]
  );
  return result.rows;
}
