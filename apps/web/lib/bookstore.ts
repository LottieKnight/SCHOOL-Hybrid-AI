import sanitizeHtml from "sanitize-html";
import { HttpResponseError, fetchJsonOrThrow, safeJson, type SafeJsonNonJson } from "@/lib/http";

export const BOOKSTORE_PHASES = ["FOUNDATION", "INTERMEDIATE", "SENIOR", "FET"] as const;
export const BOOKSTORE_FORMATS = ["DIGITAL", "HARDCOPY", "BUNDLE"] as const;
export const BOOKSTORE_PRICE_TYPES = ["all", "free", "paid"] as const;
export const BOOKSTORE_FULFILLMENT_TYPES = [
  "LINK_ONLY",
  "FILE_DOWNLOAD",
  "PRINT_ON_DEMAND",
  "SHIP_FROM_SUPPLIER",
] as const;
export const BOOKSTORE_LICENSE_TYPES = [
  "CC_BY",
  "CC_BY_SA",
  "CC_BY_ND",
  "CC_BY_NC",
  "CC_BY_NC_SA",
  "CC_BY_NC_ND",
  "PUBLIC_DOMAIN",
  "ALL_RIGHTS_RESERVED",
  "OTHER",
] as const;
export const BOOKSTORE_SOURCE_PROVIDERS = [
  "SIYAVULA",
  "AFRICAN_STORYBOOK",
  "STORYWEAVER",
  "OPENSTAX",
  "WHOLESALER",
  "PUBLISHER_DIRECT",
  "MANUAL",
] as const;

export type BookstorePhase = (typeof BOOKSTORE_PHASES)[number];
export type BookstoreFormat = (typeof BOOKSTORE_FORMATS)[number];
export type BookstorePriceType = (typeof BOOKSTORE_PRICE_TYPES)[number];
export type BookstoreFulfillmentType = (typeof BOOKSTORE_FULFILLMENT_TYPES)[number];
export type BookstoreLicenseType = (typeof BOOKSTORE_LICENSE_TYPES)[number];
export type BookstoreSourceProvider = (typeof BOOKSTORE_SOURCE_PROVIDERS)[number];
export type InstitutionResourceScope = "institution" | "universal" | "all";

export type BookstoreLicenseFlags = {
  nd_no_derivatives: boolean;
  nc_noncommercial: boolean;
  sa_sharealike: boolean;
};

export type BookstoreDigitalAsset = {
  storage_key?: string | null;
  file_type?: string | null;
  file_size?: number | null;
  checksum?: string | null;
} | null;

export type BookstoreProduct = {
  id: string;
  slug: string;
  title: string;
  description: string;
  phase: BookstorePhase;
  grade_min: number;
  grade_max: number;
  subjects: string[];
  format: BookstoreFormat;
  price_cents: number;
  currency: string;
  is_free: boolean;
  license_type: BookstoreLicenseType;
  adapted_license_type?: BookstoreLicenseType | null;
  license_url?: string | null;
  attribution_html?: string;
  source_url?: string | null;
  source_provider: BookstoreSourceProvider;
  supplier_id?: string | null;
  nd_no_derivatives: boolean;
  nc_noncommercial: boolean;
  sa_sharealike: boolean;
  is_adapted: boolean;
  is_excerpt?: boolean;
  is_partial_product?: boolean;
  delivery_mode?: "LINK_ONLY" | "FILE_DOWNLOAD" | null;
  external_download_url?: string | null;
  fulfillment_type: BookstoreFulfillmentType;
  pod_spec_json?: Record<string, unknown>;
  pod_base_cost_cents?: number | null;
  target_margin_rate?: number | null;
  vat_inclusive?: boolean;
  shipping_profile_id?: string | null;
  stock_qty?: number | null;
  tags?: string[];
  concepts?: string[];
  metadata_json?: Record<string, unknown>;
  institution_id?: string | null;
  institution_name?: string | null;
  memory_relevance?: number | null;
  recommendation_reason?: string | null;
  memory_bucket?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  license_flags?: BookstoreLicenseFlags;
  license_capabilities?: {
    isCommercialAllowed: boolean;
    isDerivativeAllowed: boolean;
    requiresShareAlike: boolean;
    requiresAttribution: boolean;
  };
  digital_asset?: BookstoreDigitalAsset;
};

export type BookstoreCatalogResponse = {
  products: BookstoreProduct[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export type BookstoreProductResponse = {
  product: BookstoreProduct;
  licensing?: {
    warnings?: string[];
    notes?: string[];
  };
};

export type BookstoreCartLine = {
  productId: string;
  quantity: number;
};

export type BookstoreValidatedCartItem = {
  product: BookstoreProduct;
  quantity: number;
  unit_price_cents: number;
  line_total_cents: number;
};

export type BookstoreCartValidation = {
  items: BookstoreValidatedCartItem[];
  totals: {
    subtotal_cents: number;
    shipping_cents: number;
    tax_cents: number;
    total_cents: number;
    currency: string;
  };
};

export type BookstoreOrder = {
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

export type BookstoreOrderItem = {
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

export type BookstoreOrderEnvelope = {
  order: BookstoreOrder;
  items: BookstoreOrderItem[];
};

export type BookstoreCheckoutResult = {
  order: BookstoreOrder;
  items: BookstoreOrderItem[];
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

export type BookstoreAdminDashboard = {
  products: BookstoreProduct[];
  pagination?: BookstoreCatalogResponse["pagination"];
  orders: Array<Record<string, unknown>>;
  ingestJobs: Array<Record<string, unknown>>;
};

export type BookstoreOerIngestResult = {
  title: string;
  slug: string;
  source_file: string;
  source_provider: string;
  status: "upserted" | "failed";
  warnings?: string[];
  error?: string;
};

const CART_STORAGE_KEY = "saedu.bookstore.cart.v1";

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

export function phaseLabel(phase: string) {
  switch (phase) {
    case "FOUNDATION":
      return "Foundation";
    case "INTERMEDIATE":
      return "Intermediate";
    case "SENIOR":
      return "Senior";
    case "FET":
      return "FET";
    default:
      return phase || "Unknown";
  }
}

export function formatLabel(value: string) {
  return value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatGradeRange(product: Pick<BookstoreProduct, "grade_min" | "grade_max">) {
  const start = product.grade_min === 0 ? "R" : String(product.grade_min);
  const end = product.grade_max === 0 ? "R" : String(product.grade_max);
  return start === end ? `Grade ${start}` : `Grades ${start}-${end}`;
}

function readCartRaw(): BookstoreCartLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((row) => ({
        productId: typeof row?.productId === "string" ? row.productId : "",
        quantity: Number.isFinite(row?.quantity) ? Math.max(1, Math.min(20, Math.floor(row.quantity))) : 1,
      }))
      .filter((row) => row.productId);
  } catch {
    return [];
  }
}

export function getBookstoreCart() {
  return readCartRaw();
}

function persistCart(lines: BookstoreCartLine[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(lines));
}

export function setBookstoreCart(lines: BookstoreCartLine[]) {
  const normalized = lines
    .map((line) => ({
      productId: line.productId,
      quantity: Math.max(1, Math.min(20, Math.floor(line.quantity || 1))),
    }))
    .filter((line) => line.productId);
  persistCart(normalized);
  return normalized;
}

export function clearBookstoreCart() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(CART_STORAGE_KEY);
}

export function addBookstoreCartItem(productId: string, quantity = 1) {
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

export function removeBookstoreCartItem(productId: string) {
  const next = readCartRaw().filter((line) => line.productId !== productId);
  persistCart(next);
  return next;
}

export function updateBookstoreCartItemQuantity(productId: string, quantity: number) {
  if (quantity <= 0) {
    return removeBookstoreCartItem(productId);
  }
  const next = readCartRaw().map((line) =>
    line.productId === productId
      ? { ...line, quantity: Math.max(1, Math.min(20, Math.floor(quantity))) }
      : line
  );
  persistCart(next);
  return next;
}

export function getCartItemCount(lines = readCartRaw()) {
  return lines.reduce((sum, row) => sum + Math.max(1, row.quantity), 0);
}

export function sanitizeAttributionHtml(html: string | null | undefined) {
  return sanitizeHtml(html || "", {
    allowedTags: ["a", "b", "strong", "em", "i", "span", "br", "p", "ul", "ol", "li", "code"],
    allowedAttributes: {
      a: ["href", "target", "rel"],
      span: ["class"],
      code: ["class"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: (_tagName: string, attribs: Record<string, string>) => ({
        tagName: "a",
        attribs: {
          ...attribs,
          target: "_blank",
          rel: "noopener noreferrer nofollow",
        },
      }),
    },
  });
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

function extractPayloadError(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const maybe = payload as Record<string, unknown>;
  if (typeof maybe.error === "string" && maybe.error.trim()) return maybe.error;
  if ("details" in maybe) {
    try {
      return JSON.stringify(maybe).slice(0, 240);
    } catch {
      return null;
    }
  }
  return null;
}

export function getHttpErrorMessage(error: unknown, fallback: string) {
  if (error instanceof HttpResponseError) {
    const payloadMessage = extractPayloadError(error.payload);
    return payloadMessage || `${fallback} (HTTP ${error.status})`;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

export type BookstoreCatalogFilters = {
  phase?: string;
  grade?: number | "";
  subject?: string;
  format?: string;
  priceType?: string;
  license?: string;
  commercialAllowedOnly?: boolean;
  q?: string;
  page?: number;
  pageSize?: number;
};

export type InstitutionResourceCatalogResponse = BookstoreCatalogResponse & {
  institution?: {
    id: string;
    name: string;
    shortName?: string | null;
  } | null;
  institutionScope?: InstitutionResourceScope;
  sections?: Array<{
    id: string;
    title: string;
    description: string;
    items: BookstoreProduct[];
  }>;
};

export async function fetchBookstoreProducts(apiBase: string, filters: BookstoreCatalogFilters = {}) {
  const query = buildQueryString({
    phase: filters.phase,
    grade: filters.grade === "" ? undefined : filters.grade,
    subject: filters.subject,
    format: filters.format,
    priceType: filters.priceType,
    license: filters.license,
    commercialAllowedOnly: filters.commercialAllowedOnly ? "true" : undefined,
    q: filters.q,
    page: filters.page,
    pageSize: filters.pageSize,
  });
  const { data } = await fetchJsonOrThrow<BookstoreCatalogResponse>(`${apiBase}/bookstore/products${query}`, {
    credentials: "include",
    cache: "no-store",
  });
  if (!data || isNonJson(data)) {
    throw new Error("Catalog response was empty or invalid.");
  }
  return data;
}

export async function fetchInstitutionResourceLibrary(
  filters: BookstoreCatalogFilters & { institutionScope?: InstitutionResourceScope } = {}
) {
  const query = buildQueryString({
    phase: filters.phase,
    grade: filters.grade === "" ? undefined : filters.grade,
    subject: filters.subject,
    format: filters.format,
    priceType: filters.priceType,
    license: filters.license,
    commercialAllowedOnly: filters.commercialAllowedOnly ? "true" : undefined,
    q: filters.q,
    page: filters.page,
    pageSize: filters.pageSize,
    institutionScope: filters.institutionScope,
  });
  const { data } = await fetchJsonOrThrow<InstitutionResourceCatalogResponse>(`/api/resources/library${query}`, {
    credentials: "include",
    cache: "no-store",
  });
  if (!data || isNonJson(data)) {
    throw new Error("Institution resource response was empty or invalid.");
  }
  return data;
}

export async function fetchBookstoreProduct(apiBase: string, idOrSlug: string) {
  const { data } = await fetchJsonOrThrow<BookstoreProductResponse>(
    `${apiBase}/bookstore/products/${encodeURIComponent(idOrSlug)}`,
    { credentials: "include", cache: "no-store" }
  );
  if (!data || isNonJson(data) || !(data as BookstoreProductResponse).product) {
    throw new Error("Product response was empty or invalid.");
  }
  return data as BookstoreProductResponse;
}

export async function validateBookstoreCartRemote(apiBase: string, items: BookstoreCartLine[]) {
  const { data } = await fetchJsonOrThrow<BookstoreCartValidation>(`${apiBase}/cart`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  });
  if (!data || isNonJson(data)) {
    throw new Error("Cart validation returned an invalid response.");
  }
  return data;
}

export async function checkoutBookstore(
  apiBase: string,
  input: {
    items: BookstoreCartLine[];
    csrfToken: string;
    address?: Record<string, unknown>;
    notes?: Record<string, unknown>;
  }
) {
  const { data } = await fetchJsonOrThrow<BookstoreCheckoutResult>(`${apiBase}/checkout`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "x-csrf-token": input.csrfToken,
    },
    body: JSON.stringify({
      items: input.items,
      address: input.address ?? {},
      notes: input.notes ?? {},
    }),
  });
  if (!data || isNonJson(data)) {
    throw new Error("Checkout returned an invalid response.");
  }
  return data as BookstoreCheckoutResult;
}

export async function confirmBookstoreCheckout(
  apiBase: string,
  input: { provider: "stripe" | "payfast"; orderId: string; sessionId?: string }
) {
  const query = new URLSearchParams({
    provider: input.provider,
    orderId: input.orderId,
  });
  if (input.sessionId) query.set("sessionId", input.sessionId);
  const { data } = await fetchJsonOrThrow<{
    order: BookstoreOrder;
    items: BookstoreOrderItem[];
    payment?: {
      sessionId?: string;
      status?: string;
      paymentStatus?: string;
      paid?: boolean;
    };
    provider?: string;
  }>(`${apiBase}/checkout/confirm?${query.toString()}`, {
    credentials: "include",
    cache: "no-store",
  });
  if (!data || isNonJson(data)) {
    throw new Error("Checkout confirmation returned an invalid response.");
  }
  return data;
}

export async function fetchUserBookstoreOrders(apiBase: string) {
  const { data } = await fetchJsonOrThrow<{ orders: BookstoreOrderEnvelope[] }>(`${apiBase}/orders`, {
    credentials: "include",
    cache: "no-store",
  });
  if (!data || isNonJson(data)) {
    throw new Error("Orders response was empty or invalid.");
  }
  return data.orders ?? [];
}

export async function prepareBookstoreDownload(
  apiBase: string,
  orderId: string,
  productId: string
): Promise<{ mode: "redirect"; url: string } | { mode: "json"; url: string; expiresAt?: string | null }> {
  const response = await fetch(`${apiBase}/download/${encodeURIComponent(orderId)}/${encodeURIComponent(productId)}`, {
    credentials: "include",
  });

  // If the API responded with a redirect, fetch() may have followed it and changed the URL.
  if (response.redirected && response.url && !response.url.includes(`/download/${orderId}/${productId}`)) {
    return { mode: "redirect", url: response.url };
  }

  const payload = await safeJson(response);
  if (!response.ok) {
    throw new HttpResponseError(response, payload);
  }
  if (!payload || isNonJson(payload)) {
    throw new Error("Download response was empty or invalid.");
  }
  const data = payload as { download_url?: string; expires_at?: string };
  if (!data.download_url) {
    throw new Error("No download URL returned.");
  }
  const resolvedUrl =
    /^https?:\/\//i.test(data.download_url) || data.download_url.startsWith("blob:")
      ? data.download_url
      : `${apiBase.replace(/\/+$/, "")}/${data.download_url.replace(/^\/+/, "")}`;
  return { mode: "json", url: resolvedUrl, expiresAt: data.expires_at ?? null };
}

export function buildPublicBookstoreDownloadUrl(apiBase: string, productId: string) {
  return `${apiBase}/download/public/${encodeURIComponent(productId)}`;
}

export async function fetchAdminBookstoreDashboard(apiBase: string) {
  const { data } = await fetchJsonOrThrow<BookstoreAdminDashboard>(`${apiBase}/admin/bookstore/products`, {
    credentials: "include",
    cache: "no-store",
  });
  if (!data || isNonJson(data)) {
    throw new Error("Admin bookstore response was invalid.");
  }
  return data;
}

export type AdminBookstoreProductInput = {
  id?: string;
  slug?: string;
  title: string;
  description: string;
  phase: BookstorePhase;
  grade_min: number;
  grade_max: number;
  subjects: string[];
  format: BookstoreFormat;
  price_cents: number;
  currency: string;
  license_type: BookstoreLicenseType;
  license_url?: string;
  attribution_html?: string;
  source_url?: string;
  source_provider: BookstoreSourceProvider;
  supplier_id?: string;
  is_adapted?: boolean;
  is_excerpt?: boolean;
  is_partial_product?: boolean;
  storage_key?: string;
  delivery_mode?: "LINK_ONLY" | "FILE_DOWNLOAD";
  file_type?: "PDF" | "EPUB" | "ZIP" | "LINK_ONLY";
  file_size?: number;
  checksum?: string;
  external_download_url?: string;
  fulfillment_type: BookstoreFulfillmentType;
  pod_spec_json?: Record<string, unknown>;
  pod_base_cost_cents?: number | null;
  target_margin_rate?: number | null;
  vat_inclusive?: boolean;
  shipping_profile_id?: string;
  stock_qty?: number | null;
  tags?: string[];
  metadata_json?: Record<string, unknown>;
  is_active?: boolean;
};

export async function saveAdminBookstoreProduct(
  apiBase: string,
  csrfToken: string,
  input: AdminBookstoreProductInput
) {
  const { data } = await fetchJsonOrThrow<{ product?: BookstoreProduct; warnings?: string[]; notes?: string[] }>(
    `${apiBase}/admin/bookstore/products`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": csrfToken,
      },
      body: JSON.stringify(input),
    }
  );
  if (!data || isNonJson(data)) {
    throw new Error("Save response was invalid.");
  }
  return data;
}

export async function runBookstoreOerIngest(
  apiBase: string,
  csrfToken: string,
  options?: { seedFormat?: "json" | "csv" | "all" }
) {
  const { data } = await fetchJsonOrThrow<{
    ok: boolean;
    imported: number;
    failed?: number;
    warnings?: string[];
    results?: BookstoreOerIngestResult[];
    sources?: string[];
    seedFormat?: "json" | "csv" | "all";
  }>(
    `${apiBase}/admin/bookstore/ingest/oer`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": csrfToken,
      },
      body: JSON.stringify({ seedFormat: options?.seedFormat || "all" }),
    }
  );
  if (!data || isNonJson(data)) {
    throw new Error("Ingest response was invalid.");
  }
  return data;
}

export async function recommendPodBookstorePrice(
  apiBase: string,
  csrfToken: string,
  input: {
    printCostCents: number;
    shippingCostCents?: number;
    fixedFeesCents?: number;
    paymentFeeRate?: number;
    riskBufferRate?: number;
    targetMarginRate?: number;
    productKind?: "workbook" | "textbook" | "color";
    vatRate?: number;
    vatInclusive?: boolean;
    roundingStepCents?: number;
  }
) {
  const { data } = await fetchJsonOrThrow<{
    ok: boolean;
    recommendedPriceCents: number;
    targetMarginRate: number;
    breakdown: Record<string, unknown>;
    vatDisplayMode: "inclusive" | "exclusive";
  }>(`${apiBase}/admin/bookstore/pod/recommend-price`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "x-csrf-token": csrfToken,
    },
    body: JSON.stringify(input),
  });
  if (!data || isNonJson(data)) {
    throw new Error("POD pricing response was invalid.");
  }
  return data;
}

export async function runBookstoreSupplierSync(
  apiBase: string,
  csrfToken: string,
  provider: "WHOLESALER" | "PUBLISHER_DIRECT" = "WHOLESALER"
) {
  const { data } = await fetchJsonOrThrow<{ ok: boolean; message?: string }>(
    `${apiBase}/admin/bookstore/suppliers/sync`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": csrfToken,
      },
      body: JSON.stringify({ provider }),
    }
  );
  if (!data || isNonJson(data)) {
    throw new Error("Supplier sync response was invalid.");
  }
  return data;
}

export async function updateAdminBookstoreOrderStatus(
  apiBase: string,
  csrfToken: string,
  orderId: string,
  status: string
) {
  const { data } = await fetchJsonOrThrow<{ order?: Record<string, unknown> }>(
    `${apiBase}/admin/bookstore/orders/${encodeURIComponent(orderId)}/status`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": csrfToken,
      },
      body: JSON.stringify({ status }),
    }
  );
  if (!data || isNonJson(data)) {
    throw new Error("Order update response was invalid.");
  }
  return data;
}

function isNonJson(value: unknown): value is SafeJsonNonJson {
  return Boolean(value && typeof value === "object" && "__nonJson" in value);
}

export function getLicenseBadgeLabel(product: Pick<BookstoreProduct, "license_type">) {
  const label = formatLabel(product.license_type);
  return label.replace("Cc ", "CC ").replace("Sa", "SA").replace("Nd", "ND").replace("Nc", "NC");
}

export function licenseBlocksCommercialSales(product: Pick<BookstoreProduct, "nc_noncommercial" | "price_cents">) {
  return Boolean(product.nc_noncommercial && product.price_cents > 0);
}

export function isCommerciallyAllowedForProduct(
  product: Pick<BookstoreProduct, "nc_noncommercial" | "license_capabilities">
) {
  if (typeof product.license_capabilities?.isCommercialAllowed === "boolean") {
    return product.license_capabilities.isCommercialAllowed;
  }
  return !Boolean(product.nc_noncommercial);
}

export function productHasDownload(product: Pick<BookstoreProduct, "fulfillment_type" | "external_download_url" | "digital_asset">) {
  return (
    product.fulfillment_type === "LINK_ONLY" ||
    product.fulfillment_type === "FILE_DOWNLOAD" ||
    Boolean(product.external_download_url || product.digital_asset?.storage_key)
  );
}
