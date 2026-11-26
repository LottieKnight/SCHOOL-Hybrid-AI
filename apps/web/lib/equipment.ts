import { EquipmentHttpError, fetchEquipmentJsonOrThrow, type EquipmentSafeJsonNonJson } from "@/lib/equipmentHttp";

export const EQUIPMENT_FULFILLMENT_TYPES = [
  "STOCKED",
  "SHIP_FROM_SUPPLIER",
  "DROPSHIP",
  "AFFILIATE_LINK",
  "QUOTE_REQUIRED",
] as const;

export const EQUIPMENT_PHASES = ["FOUNDATION", "INTERMEDIATE", "SENIOR", "FET"] as const;

export type EquipmentFulfillmentType = (typeof EQUIPMENT_FULFILLMENT_TYPES)[number];
export type EquipmentPhase = (typeof EQUIPMENT_PHASES)[number];
export type EquipmentQuoteStatus = "received" | "answered" | "closed";

export type EquipmentCategory = {
  id: string;
  slug: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
  productCount?: number;
};

export type EquipmentProduct = {
  id: string;
  slug: string;
  title: string;
  description: string;
  brand: string | null;
  sku: string | null;
  categoryId: string;
  category?: EquipmentCategory | null;
  phaseTags: EquipmentPhase[];
  gradeMin: number;
  gradeMax: number;
  subjectTags: string[];
  tags: string[];
  priceCents: number;
  currency: string;
  images: string[];
  fulfillmentType: EquipmentFulfillmentType;
  stockQty: number | null;
  leadTimeDays: number | null;
  attributes: Record<string, unknown>;
  isBundle: boolean;
  bundleItems: Array<{ slug: string; qty: number }> | null;
  bundleItemsExpanded?: Array<{ product: EquipmentProduct; qty: number }>;
  createdAt: string;
  updatedAt: string;
};

export type EquipmentCatalogResponse = {
  products: EquipmentProduct[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

export type EquipmentCartLine = { slug: string; quantity: number };
export type EquipmentValidatedCartItem = {
  product: EquipmentProduct;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
};
export type EquipmentCartValidation = {
  items: EquipmentValidatedCartItem[];
  totals: { subtotalCents: number; totalCents: number; currency: string };
};

export type EquipmentQuoteReceipt = {
  quote: {
    id: string;
    createdAt: string;
    updatedAt?: string;
    status: EquipmentQuoteStatus;
    statusUpdatedAt?: string | null;
    statusUpdatedBy?: string | null;
    currency: string;
    subtotalCents: number;
    totalCents: number;
    requester?: {
      organizationName: string | null;
      contactEmail: string | null;
      province: string | null;
      purpose: "equipment_quote_follow_up";
    };
    items: Array<{
      slug: string;
      title: string;
      quantity: number;
      unitPriceCents: number;
      lineTotalCents: number;
      fulfillmentType: EquipmentFulfillmentType;
      isBundle: boolean;
    }>;
  };
  validated: EquipmentCartValidation;
  message: string;
  affiliateLinks?: Array<{ slug: string; title: string; url: string | null }>;
};

export type EquipmentCatalogFilters = {
  q?: string;
  category?: string;
  phase?: string;
  grade?: number | "";
  subject?: string;
  fulfillment?: string;
  priceType?: "all" | "free" | "paid";
  page?: number;
  pageSize?: number;
  minPriceCents?: number | "";
  maxPriceCents?: number | "";
};

export type AdminEquipmentQuote = {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: EquipmentQuoteStatus;
  statusUpdatedAt: string | null;
  statusUpdatedBy: string | null;
  currency: string;
  subtotalCents: number;
  totalCents: number;
  requester: {
    organizationName: string | null;
    contactEmail: string | null;
    province: string | null;
    purpose: "equipment_quote_follow_up";
  };
  items: Array<{
    slug: string;
    title: string;
    quantity: number;
    unitPriceCents: number;
    lineTotalCents: number;
    fulfillmentType: EquipmentFulfillmentType;
    isBundle: boolean;
  }>;
  notes: Record<string, unknown>;
  antiAbuse: {
    clientHash: string | null;
    source: string;
  };
};

export type AdminEquipmentQuoteListResponse = {
  quotes: AdminEquipmentQuote[];
  totalCount: number;
  retentionDays: number;
  applied: {
    status: EquipmentQuoteStatus | "all";
    from: string | null;
    to: string | null;
    limit: number;
  };
};

const EQUIPMENT_CART_KEY = "saedu.equipment.cart.v1";
const EQUIPMENT_QUOTE_RECEIPT_KEY = "saedu.equipment.quote.receipt.v1";
const LEGACY_EQUIPMENT_CHECKOUT_RECEIPT_KEY = "saedu.equipment.checkout.receipt.v1";

function isNonJson(value: unknown): value is EquipmentSafeJsonNonJson {
  return Boolean(value && typeof value === "object" && "__nonJson" in value);
}

function qs(params: Record<string, string | number | undefined | null>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === "") continue;
    search.set(key, String(value));
  }
  const out = search.toString();
  return out ? `?${out}` : "";
}

function base(baseUrl: string) {
  return baseUrl.replace(/\/+$/, "");
}

function httpErrorMessage(error: unknown, fallback: string) {
  if (error instanceof EquipmentHttpError) {
    const payload = error.payload as any;
    if (payload && typeof payload.error === "string") return payload.error;
    return `${fallback} (HTTP ${error.status})`;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export function getEquipmentHttpErrorMessage(error: unknown, fallback: string) {
  return httpErrorMessage(error, fallback);
}

export async function fetchEquipmentProducts(baseUrl = "/api", filters: EquipmentCatalogFilters = {}) {
  const data = await fetchEquipmentJsonOrThrow<EquipmentCatalogResponse>(
    `${base(baseUrl)}/equipment/products${qs({
      q: filters.q,
      category: filters.category,
      phase: filters.phase,
      grade: filters.grade === "" ? undefined : filters.grade,
      subject: filters.subject,
      fulfillment: filters.fulfillment,
      priceType: filters.priceType || "all",
      page: filters.page || 1,
      pageSize: filters.pageSize || 24,
      minPriceCents: filters.minPriceCents === "" ? undefined : filters.minPriceCents,
      maxPriceCents: filters.maxPriceCents === "" ? undefined : filters.maxPriceCents,
    })}`,
    { cache: "no-store", credentials: "include" }
  );
  if (!data || isNonJson(data)) throw new Error("Equipment catalog response was invalid.");
  return data;
}

export async function fetchEquipmentProduct(baseUrl = "/api", slug: string) {
  const data = await fetchEquipmentJsonOrThrow<{ product: EquipmentProduct }>(
    `${base(baseUrl)}/equipment/products/${encodeURIComponent(slug)}`,
    { cache: "no-store", credentials: "include" }
  );
  if (!data || isNonJson(data) || !(data as any).product) throw new Error("Equipment product response was invalid.");
  return data as { product: EquipmentProduct };
}

export async function fetchEquipmentCategories(baseUrl = "/api") {
  const data = await fetchEquipmentJsonOrThrow<{ categories: EquipmentCategory[] }>(
    `${base(baseUrl)}/equipment/categories`,
    { cache: "no-store", credentials: "include" }
  );
  if (!data || isNonJson(data) || !Array.isArray((data as any).categories)) {
    throw new Error("Equipment categories response was invalid.");
  }
  return (data as { categories: EquipmentCategory[] }).categories;
}

export async function validateEquipmentCartRemote(baseUrl = "/api", items: EquipmentCartLine[]) {
  const data = await fetchEquipmentJsonOrThrow<EquipmentCartValidation>(`${base(baseUrl)}/equipment/cart/validate`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  });
  if (!data || isNonJson(data)) throw new Error("Equipment cart validation response was invalid.");
  return data as EquipmentCartValidation;
}

export async function requestEquipmentQuote(
  baseUrl = "/api",
  input: {
    items: EquipmentCartLine[];
    requester: {
      organizationName?: string | null;
      contactEmail: string;
      province?: string | null;
    };
    notes?: Record<string, unknown>;
    website?: string;
    source?: string;
  }
) {
  const data = await fetchEquipmentJsonOrThrow<EquipmentQuoteReceipt>(`${base(baseUrl)}/equipment/quote`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!data || isNonJson(data) || !(data as any).quote) throw new Error("Equipment quote response was invalid.");
  return data as EquipmentQuoteReceipt;
}

export async function fetchAdminEquipmentCatalog(baseUrl = "/api") {
  const data = await fetchEquipmentJsonOrThrow<{ categories: EquipmentCategory[]; products: EquipmentProduct[] }>(
    `${base(baseUrl)}/admin/equipment/products`,
    { credentials: "include", cache: "no-store" }
  );
  if (!data || isNonJson(data)) throw new Error("Admin equipment response was invalid.");
  return data as { categories: EquipmentCategory[]; products: EquipmentProduct[] };
}

export async function importAdminEquipmentSeed(baseUrl = "/api", csrfToken?: string) {
  const data = await fetchEquipmentJsonOrThrow<{
    inserted: number;
    updated: number;
    failed: Array<{ slug: string; reason: string }>;
    totals?: Record<string, number>;
  }>(`${base(baseUrl)}/admin/equipment/ingest`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
    },
    body: "{}",
  });
  if (!data || isNonJson(data)) throw new Error("Seed import response was invalid.");
  return data as any;
}

export async function saveAdminEquipmentProduct(
  baseUrl = "/api",
  csrfToken: string,
  product: Record<string, unknown>
) {
  const data = await fetchEquipmentJsonOrThrow<{ product: EquipmentProduct; created: boolean }>(
    `${base(baseUrl)}/admin/equipment/products`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
      body: JSON.stringify(product),
    }
  );
  if (!data || isNonJson(data)) throw new Error("Save equipment product response was invalid.");
  return data as { product: EquipmentProduct; created: boolean };
}

export async function deleteAdminEquipmentProduct(baseUrl = "/api", csrfToken: string, slug: string) {
  const data = await fetchEquipmentJsonOrThrow<{ ok: boolean; slug: string }>(
    `${base(baseUrl)}/admin/equipment/products${qs({ slug })}`,
    {
      method: "DELETE",
      credentials: "include",
      headers: { "x-csrf-token": csrfToken },
    }
  );
  if (!data || isNonJson(data)) throw new Error("Delete equipment product response was invalid.");
  return data as { ok: boolean; slug: string };
}

export async function fetchAdminEquipmentQuotes(
  baseUrl = "/api",
  filters: {
    status?: EquipmentQuoteStatus | "all";
    from?: string | null;
    to?: string | null;
    limit?: number;
  } = {}
) {
  const data = await fetchEquipmentJsonOrThrow<AdminEquipmentQuoteListResponse>(
    `${base(baseUrl)}/admin/equipment/quotes${qs({
      status: filters.status || "all",
      from: filters.from || undefined,
      to: filters.to || undefined,
      limit: filters.limit ?? 120,
    })}`,
    { credentials: "include", cache: "no-store" }
  );
  if (!data || isNonJson(data)) throw new Error("Admin equipment quote response was invalid.");
  return data as AdminEquipmentQuoteListResponse;
}

export async function updateAdminEquipmentQuoteStatus(
  baseUrl = "/api",
  csrfToken: string,
  quoteId: string,
  status: EquipmentQuoteStatus
) {
  const data = await fetchEquipmentJsonOrThrow<{ quote: AdminEquipmentQuote }>(
    `${base(baseUrl)}/admin/equipment/quotes/${encodeURIComponent(quoteId)}`,
    {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
      body: JSON.stringify({ status }),
    }
  );
  if (!data || isNonJson(data) || !(data as any).quote) {
    throw new Error("Admin equipment quote update response was invalid.");
  }
  return data as { quote: AdminEquipmentQuote };
}

export async function cleanupAdminEquipmentQuotes(baseUrl = "/api", csrfToken: string, olderThanDays: number) {
  const data = await fetchEquipmentJsonOrThrow<{
    ok: boolean;
    olderThanDays: number;
    removedCount: number;
    remainingCount: number;
  }>(`${base(baseUrl)}/admin/equipment/quotes/cleanup${qs({ olderThanDays })}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
    body: JSON.stringify({ olderThanDays }),
  });
  if (!data || isNonJson(data)) throw new Error("Admin equipment quote cleanup response was invalid.");
  return data as {
    ok: boolean;
    olderThanDays: number;
    removedCount: number;
    remainingCount: number;
  };
}

function readCartRaw(): EquipmentCartLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(EQUIPMENT_CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((line: any) => ({
        slug: typeof line?.slug === "string" ? line.slug : "",
        quantity: Number.isFinite(line?.quantity) ? Math.max(1, Math.min(20, Math.floor(line.quantity))) : 1,
      }))
      .filter((line) => line.slug);
  } catch {
    return [];
  }
}

function writeCart(lines: EquipmentCartLine[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(EQUIPMENT_CART_KEY, JSON.stringify(lines));
}

export function getEquipmentCart() {
  return readCartRaw();
}

export function getEquipmentCartCount(lines = readCartRaw()) {
  return lines.reduce((sum, line) => sum + Math.max(1, line.quantity), 0);
}

export function setEquipmentCart(lines: EquipmentCartLine[]) {
  const normalized = lines
    .map((line) => ({
      slug: String(line.slug || "").trim().toLowerCase(),
      quantity: Math.max(1, Math.min(20, Math.floor(line.quantity || 1))),
    }))
    .filter((line) => line.slug);
  writeCart(normalized);
  return normalized;
}

export function addEquipmentCartItem(slug: string, quantity = 1) {
  const cart = readCartRaw();
  const index = cart.findIndex((line) => line.slug === slug);
  if (index >= 0) {
    cart[index] = { ...cart[index], quantity: Math.min(20, cart[index].quantity + quantity) };
  } else {
    cart.push({ slug, quantity: Math.max(1, Math.min(20, Math.floor(quantity || 1))) });
  }
  writeCart(cart);
  return cart;
}

export function addEquipmentBundleToCart(items: Array<{ slug: string; qty: number }>) {
  let cart = readCartRaw();
  for (const item of items) {
    cart = addEquipmentCartItem(item.slug, item.qty);
  }
  return cart;
}

export function updateEquipmentCartItemQuantity(slug: string, quantity: number) {
  if (quantity <= 0) return removeEquipmentCartItem(slug);
  const cart = readCartRaw().map((line) =>
    line.slug === slug ? { ...line, quantity: Math.max(1, Math.min(20, Math.floor(quantity))) } : line
  );
  writeCart(cart);
  return cart;
}

export function removeEquipmentCartItem(slug: string) {
  const cart = readCartRaw().filter((line) => line.slug !== slug);
  writeCart(cart);
  return cart;
}

export function clearEquipmentCart() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(EQUIPMENT_CART_KEY);
}

export function storeEquipmentQuoteReceipt(receipt: EquipmentQuoteReceipt) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(EQUIPMENT_QUOTE_RECEIPT_KEY, JSON.stringify(receipt));
}

export function readEquipmentQuoteReceipt() {
  if (typeof window === "undefined") return null;
  try {
    const raw =
      window.sessionStorage.getItem(EQUIPMENT_QUOTE_RECEIPT_KEY) ??
      window.sessionStorage.getItem(LEGACY_EQUIPMENT_CHECKOUT_RECEIPT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as EquipmentQuoteReceipt | { order?: EquipmentQuoteReceipt["quote"] };
    if ("quote" in parsed && parsed.quote) return parsed as EquipmentQuoteReceipt;
    if ("order" in parsed && parsed.order) {
      return {
        ...(parsed as Omit<EquipmentQuoteReceipt, "quote">),
        quote: parsed.order,
      } as EquipmentQuoteReceipt;
    }
    return null;
  } catch {
    return null;
  }
}

export function clearEquipmentQuoteReceipt() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(EQUIPMENT_QUOTE_RECEIPT_KEY);
  window.sessionStorage.removeItem(LEGACY_EQUIPMENT_CHECKOUT_RECEIPT_KEY);
}

export function formatEquipmentCurrency(cents: number, currency = "ZAR") {
  try {
    return new Intl.NumberFormat("en-ZA", { style: "currency", currency }).format((cents || 0) / 100);
  } catch {
    return `${currency} ${((cents || 0) / 100).toFixed(2)}`;
  }
}

export function formatEquipmentGradeBand(product: Pick<EquipmentProduct, "gradeMin" | "gradeMax">) {
  const g1 = product.gradeMin === 0 ? "R" : String(product.gradeMin);
  const g2 = product.gradeMax === 0 ? "R" : String(product.gradeMax);
  return g1 === g2 ? `Grade ${g1}` : `Grades ${g1}-${g2}`;
}

export function formatEquipmentFulfillment(value: string) {
  return value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
