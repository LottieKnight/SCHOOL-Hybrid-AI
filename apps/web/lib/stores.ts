import { getApiErrorMessage } from "@/lib/apiBase";
import { HttpResponseError, safeJson } from "@/lib/http";

export type StoreVendor = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  accent: string;
  badge: string;
  iconKey: string;
  config: Record<string, unknown>;
  isActive: boolean;
  sortOrder: number;
};

export type StoreCategory = {
  id: string;
  slug: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
};

export type StoreProduct = {
  id: string;
  storeId: string;
  categoryId: string | null;
  slug: string;
  title: string;
  description: string;
  priceCents: number;
  currency: string;
  images: string[];
  variants: Array<Record<string, unknown>>;
  attributes: Record<string, unknown>;
  fulfillmentType: string;
  stockQty: number | null;
  tags: string[];
  isActive: boolean;
};

export type StoreCatalogResponse = {
  store: StoreVendor;
  products: StoreProduct[];
  categories: StoreCategory[];
  pagination: { page: number; pageSize: number; total: number };
};

export type StoreCartLine = {
  productId: string;
  quantity: number;
};

export type StoreCartValidation = {
  items: Array<{
    product: StoreProduct;
    store: StoreVendor;
    quantity: number;
    unit_price_cents: number;
    line_total_cents: number;
  }>;
  totals: {
    subtotal_cents: number;
    shipping_cents: number;
    tax_cents: number;
    total_cents: number;
    currency: string;
  };
};

export type StoreOrderEnvelope = {
  order: Record<string, unknown>;
  items: Array<Record<string, unknown>>;
};

export type StoreCheckoutResult = {
  order: Record<string, unknown>;
  items: Array<Record<string, unknown>>;
  payment:
    | {
        provider: string;
        paymentIntentId: string;
        clientSecret: string | null;
        amountCents: number;
        currency: string;
        status: string;
        checkoutUrl?: string | null;
        checkoutSessionId?: string | null;
        providerMetadata?: Record<string, unknown>;
      }
    | null;
  message?: string;
};

export type StoreConfirmResult = {
  provider?: string;
  order?: Record<string, unknown>;
  items?: Array<Record<string, unknown>>;
  payment?: {
    sessionId?: string | null;
    status?: string;
    paymentStatus?: string;
    paid?: boolean;
  };
};

export type StoreCatalogFilters = {
  category?: string;
  priceType?: string;
  tag?: string;
  q?: string;
  page?: number;
  pageSize?: number;
};

const CART_STORAGE_KEY = "saedu.store.cart.v1";

export function formatZarCents(cents: number, currency = "ZAR") {
  const amount = Number.isFinite(cents) ? cents / 100 : 0;
  try {
    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency: currency || "ZAR",
      currencyDisplay: "symbol",
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency || "ZAR"} ${amount.toFixed(2)}`;
  }
}

export function formatStoreLabel(value: string) {
  return value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function isNonJson(payload: unknown): boolean {
  return Boolean(
    payload &&
      typeof payload === "object" &&
      "__nonJson" in (payload as Record<string, unknown>)
  );
}

export function getHttpErrorMessage(error: unknown, fallback: string) {
  if (error instanceof HttpResponseError) {
    const payload = error.payload as Record<string, unknown> | null;
    if (payload && typeof payload?.error === "string" && payload.error.trim()) {
      return payload.error;
    }
    return `${fallback} (HTTP ${error.status})`;
  }
  return getApiErrorMessage(error, fallback);
}

function buildQueryString(params: Record<string, string | number | boolean | undefined | null>) {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === "") continue;
    qs.set(key, String(value));
  }
  const value = qs.toString();
  return value ? `?${value}` : "";
}

async function fetchJsonOrThrow<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: "include", ...init });
  const payload = await safeJson<T>(response);
  if (!response.ok) {
    throw new HttpResponseError(response, payload);
  }
  if (payload == null || isNonJson(payload)) {
    throw new Error("Invalid response from store service.");
  }
  return payload as T;
}

export async function fetchStores(baseUrl = "/api") {
  const data = await fetchJsonOrThrow<{ stores: StoreVendor[] }>(`${baseUrl}/stores`, {
    cache: "no-store",
  });
  return data.stores;
}

export async function fetchStore(baseUrl = "/api", slug: string) {
  const data = await fetchJsonOrThrow<{ store: StoreVendor }>(
    `${baseUrl}/stores/${encodeURIComponent(slug)}`,
    { cache: "no-store" }
  );
  return data.store;
}

export async function fetchStoreCatalog(
  baseUrl = "/api",
  slug: string,
  filters: StoreCatalogFilters = {}
) {
  const data = await fetchJsonOrThrow<StoreCatalogResponse>(
    `${baseUrl}/stores/${encodeURIComponent(slug)}/products${buildQueryString({
      category: filters.category,
      priceType: filters.priceType || "all",
      tag: filters.tag,
      q: filters.q,
      page: filters.page || 1,
      pageSize: filters.pageSize || 24,
    })}`,
    { cache: "no-store" }
  );
  return data;
}

export async function fetchStoreProduct(baseUrl = "/api", slug: string, productSlug: string) {
  const data = await fetchJsonOrThrow<{ store: StoreVendor; product: StoreProduct }>(
    `${baseUrl}/stores/${encodeURIComponent(slug)}/products/${encodeURIComponent(productSlug)}`,
    { cache: "no-store" }
  );
  return data;
}

export async function validateStoreCartRemote(
  baseUrl = "/api",
  items: StoreCartLine[]
): Promise<StoreCartValidation> {
  return fetchJsonOrThrow<StoreCartValidation>(`${baseUrl}/store/cart`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  });
}

export async function createStoreCheckout(
  baseUrl = "/api",
  input: {
    items: StoreCartLine[];
    csrfToken?: string;
    address?: Record<string, unknown>;
    notes?: Record<string, unknown>;
  }
): Promise<StoreCheckoutResult> {
  return fetchJsonOrThrow<StoreCheckoutResult>(`${baseUrl}/store/checkout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(input.csrfToken ? { "x-csrf-token": input.csrfToken } : {}),
    },
    body: JSON.stringify({
      items: input.items,
      address: input.address ?? {},
      notes: input.notes ?? {},
    }),
  });
}

export async function confirmStoreCheckout(
  baseUrl = "/api",
  query: { provider: string; orderId: string; sessionId?: string }
): Promise<StoreConfirmResult> {
  const data = await fetchJsonOrThrow<StoreConfirmResult>(
    `${baseUrl}/store/checkout/confirm${buildQueryString(query)}`,
    { cache: "no-store" }
  );
  return data;
}

export async function fetchStoreOrders(baseUrl = "/api") {
  const data = await fetchJsonOrThrow<{ orders: StoreOrderEnvelope[] }>(`${baseUrl}/store/orders`, {
    cache: "no-store",
  });
  return data.orders;
}

export async function submitStoreQuote(
  baseUrl = "/api",
  slug: string,
  input: {
    items: StoreCartLine[];
    name?: string;
    email?: string;
    phone?: string;
    notes?: string;
  }
) {
  const data = await fetchJsonOrThrow<{ quote: Record<string, unknown> }>(
    `${baseUrl}/stores/${encodeURIComponent(slug)}/quotes`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }
  );
  return data.quote;
}

function readCartRaw(): StoreCartLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((row) => ({
        productId: typeof row?.productId === "string" ? row.productId : "",
        quantity:
          Number.isFinite(row?.quantity) ? Math.max(1, Math.min(20, Math.floor(row.quantity))) : 1,
      }))
      .filter((row) => row.productId);
  } catch {
    return [];
  }
}

function persistCart(lines: StoreCartLine[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(lines));
}

export function getStoreCart() {
  return readCartRaw();
}

export function setStoreCart(lines: StoreCartLine[]) {
  const normalized = lines
    .map((line) => ({
      productId: line.productId,
      quantity: Math.max(1, Math.min(20, Math.floor(line.quantity || 1))),
    }))
    .filter((line) => line.productId);
  persistCart(normalized);
  return normalized;
}

export function clearStoreCart() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(CART_STORAGE_KEY);
}

export function addStoreCartItem(productId: string, quantity = 1) {
  const cart = readCartRaw();
  const next = [...cart];
  const index = next.findIndex((row) => row.productId === productId);
  if (index >= 0) {
    next[index] = {
      ...next[index],
      quantity: Math.max(1, Math.min(20, next[index].quantity + quantity)),
    };
  } else {
    next.push({ productId, quantity: Math.max(1, Math.min(20, Math.floor(quantity || 1))) });
  }
  persistCart(next);
  return next;
}

export function removeStoreCartItem(productId: string) {
  const next = readCartRaw().filter((line) => line.productId !== productId);
  persistCart(next);
  return next;
}

export function updateStoreCartItemQuantity(productId: string, quantity: number) {
  if (quantity <= 0) {
    return removeStoreCartItem(productId);
  }
  const next = readCartRaw().map((line) =>
    line.productId === productId
      ? { ...line, quantity: Math.max(1, Math.min(20, Math.floor(quantity))) }
      : line
  );
  persistCart(next);
  return next;
}

export function getStoreCartItemCount(lines = readCartRaw()) {
  return lines.reduce((sum, row) => sum + Math.max(1, row.quantity), 0);
}

// ---- Verified calculator bridges (school_*.py) ----

export type LocalBreakevenProduct = {
  name: string;
  source: number;
  pack: number;
  courier: number;
  landed: number;
  retail: number;
  contrib: number;
  gm_pct: number;
  mix_pct: number;
};

export type LocalBreakeven = {
  fixed: number;
  products: LocalBreakevenProduct[];
  blended_contrib: number;
  breakeven_units: number;
  per_product_split: Array<{ name: string; units_mo: number }>;
  source: string;
};

export type DropshipResult = {
  retail: number;
  wholesale: number;
  courier: number;
  gateway_pct: number;
  gateway_fixed: number;
  gateway_fee: number;
  outlay: number;
  margin: number;
  margin_pct: number;
  monthly_profit: number;
  orders_mo: number;
  buffer_need: number;
  profitable: boolean;
  source: string;
};

export type DdpMarketRow = {
  market: string;
  landed: number;
  source: number;
  freight: number;
  duty: number;
  lastmile: number;
  margin: number;
  pct: number;
  loss_lane: boolean;
};

export type DdpQuote = {
  domestic: boolean;
  source?: number;
  pack?: number;
  retail?: number;
  packc?: number;
  selected?: DdpMarketRow | null;
  markets: DdpMarketRow[];
  worst_lane?: { market: string; landed: number } | null;
  priceIncludes?: string;
  note?: string;
  sourceScript?: string;
};

export async function fetchLocalBreakeven(baseUrl = "/api"): Promise<LocalBreakeven> {
  return fetchJsonOrThrow<LocalBreakeven>(`${baseUrl}/store/breakeven`, { cache: "no-store" });
}

export async function fetchDropshipMath(
  baseUrl = "/api",
  params: { product?: string; retail?: number; wholesale?: number; courier?: number }
): Promise<DropshipResult> {
  return fetchJsonOrThrow<DropshipResult>(
    `${baseUrl}/store/dropship${buildQueryString({
      product: params.product,
      retail: params.retail,
      wholesale: params.wholesale,
      courier: params.courier,
    })}`,
    { cache: "no-store" }
  );
}

export async function fetchDdpQuote(
  baseUrl = "/api",
  params: { product?: string; market?: string; store?: string; source?: number; pack?: number; retail?: number }
): Promise<DdpQuote> {
  return fetchJsonOrThrow<DdpQuote>(
    `${baseUrl}/store/ddp${buildQueryString({
      product: params.product,
      market: params.market,
      store: params.store,
      source: params.source,
      pack: params.pack,
      retail: params.retail,
    })}`,
    { cache: "no-store" }
  );
}
