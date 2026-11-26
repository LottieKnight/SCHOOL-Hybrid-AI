import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { z } from "zod";

export const EQUIPMENT_PHASES = ["FOUNDATION", "INTERMEDIATE", "SENIOR", "FET"] as const;
export const EQUIPMENT_SUBJECTS = [
  "Maths",
  "Science",
  "EGD",
  "Sport",
  "ICT",
  "Art",
  "General",
] as const;
export const EQUIPMENT_FULFILLMENT_TYPES = [
  "STOCKED",
  "SHIP_FROM_SUPPLIER",
  "DROPSHIP",
  "AFFILIATE_LINK",
  "QUOTE_REQUIRED",
] as const;

export type EquipmentPhase = (typeof EQUIPMENT_PHASES)[number];
export type EquipmentSubject = (typeof EQUIPMENT_SUBJECTS)[number];
export type EquipmentFulfillmentType = (typeof EQUIPMENT_FULFILLMENT_TYPES)[number];

export type EquipmentCategory = {
  id: string;
  slug: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type EquipmentProduct = {
  id: string;
  slug: string;
  title: string;
  description: string;
  brand: string | null;
  sku: string | null;
  categoryId: string;
  phaseTags: EquipmentPhase[];
  gradeMin: number;
  gradeMax: number;
  subjectTags: EquipmentSubject[];
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
  createdAt: string;
  updatedAt: string;
};

export type EquipmentCatalogDb = {
  version: 1;
  updatedAt: string;
  categories: EquipmentCategory[];
  products: EquipmentProduct[];
};

type SeedCategory = {
  slug: string;
  name: string;
  parentSlug?: string | null;
  sortOrder?: number;
};

type SeedProduct = {
  slug: string;
  title: string;
  description: string;
  brand?: string | null;
  sku?: string | null;
  categorySlug: string;
  phaseTags: string[];
  gradeMin: number;
  gradeMax: number;
  subjectTags: string[];
  tags?: string[];
  priceCents: number;
  currency?: string;
  images?: string[];
  fulfillmentType: string;
  stockQty?: number | null;
  leadTimeDays?: number | null;
  attributes?: Record<string, unknown>;
  isBundle?: boolean;
  bundleItems?: Array<{ slug: string; qty: number }> | null;
};

const seedCategorySchema = z.object({
  slug: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(240),
  parentSlug: z.string().trim().max(120).nullable().optional(),
  sortOrder: z.coerce.number().int().optional(),
});

const seedProductSchema = z.object({
  slug: z.string().trim().min(1).max(140),
  title: z.string().trim().min(1).max(240),
  description: z.string().trim().min(1).max(5000),
  brand: z.string().trim().max(120).nullable().optional(),
  sku: z.string().trim().max(120).nullable().optional(),
  categorySlug: z.string().trim().min(1).max(120),
  phaseTags: z.array(z.enum(EQUIPMENT_PHASES)).min(1),
  gradeMin: z.coerce.number().int().min(0).max(12),
  gradeMax: z.coerce.number().int().min(0).max(12),
  subjectTags: z.array(z.enum(EQUIPMENT_SUBJECTS)).min(1),
  tags: z.array(z.string().trim().min(1).max(80)).optional().default([]),
  priceCents: z.coerce.number().int().min(0).max(100000000),
  currency: z.string().trim().min(3).max(3).optional().default("ZAR"),
  images: z.array(z.string().trim().min(1).max(500)).optional().default([]),
  fulfillmentType: z.enum(EQUIPMENT_FULFILLMENT_TYPES),
  stockQty: z.coerce.number().int().min(0).nullable().optional(),
  leadTimeDays: z.coerce.number().int().min(0).nullable().optional(),
  attributes: z.record(z.unknown()).optional().default({}),
  isBundle: z.boolean().optional().default(false),
  bundleItems: z
    .array(
      z.object({
        slug: z.string().trim().min(1).max(140),
        qty: z.coerce.number().int().min(1).max(100),
      })
    )
    .nullable()
    .optional(),
});

const seedFileSchema = z.object({
  version: z.coerce.number().optional(),
  generatedAt: z.string().optional(),
  categories: z.array(seedCategorySchema).min(1),
  products: z.array(seedProductSchema).min(1),
});

const adminProductSchema = seedProductSchema.extend({
  id: z.string().trim().min(1).optional(),
});

type EquipmentListFilters = {
  q?: string;
  category?: string;
  phase?: string;
  grade?: number | null;
  subject?: string;
  fulfillment?: string;
  priceType?: "all" | "free" | "paid";
  minPriceCents?: number | null;
  maxPriceCents?: number | null;
  page?: number;
  pageSize?: number;
  slugs?: string[];
};

type EquipmentCartLine = {
  slug: string;
  quantity: number;
};

export type EquipmentValidatedCartItem = {
  product: EquipmentProduct;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
};

function normalizeSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 140);
}

function repoRootCandidates() {
  const cwd = process.cwd();
  return [cwd, path.join(cwd, ".."), path.join(cwd, "..", "..")];
}

function resolveWebDataDir() {
  for (const candidate of repoRootCandidates()) {
    const direct = path.join(candidate, "data");
    if (existsSync(path.join(direct, "equipment_seed.json"))) return direct;
    const nested = path.join(candidate, "apps", "web", "data");
    if (existsSync(path.join(nested, "equipment_seed.json")) || existsSync(path.join(candidate, "apps", "web"))) {
      return nested;
    }
  }
  return path.join(process.cwd(), "data");
}

function seedPath() {
  return path.join(resolveWebDataDir(), "equipment_seed.json");
}

function dbPath() {
  return path.join(resolveWebDataDir(), "equipment_catalog_db.json");
}

function quotesPath() {
  return path.join(resolveWebDataDir(), "equipment_quotes.json");
}

async function ensureDataDir() {
  await fs.mkdir(resolveWebDataDir(), { recursive: true });
}

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function writeJsonFile(filePath: string, value: unknown) {
  await ensureDataDir();
  const tmp = `${filePath}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(value, null, 2), "utf8");
  await fs.rename(tmp, filePath);
}

function withTimestamps<T extends object>(value: T, existing?: { createdAt?: string }) {
  const now = new Date().toISOString();
  return {
    ...value,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}

export async function readEquipmentSeed() {
  const raw = await fs.readFile(seedPath(), "utf8");
  const parsed = seedFileSchema.parse(JSON.parse(raw));
  return parsed as { categories: SeedCategory[]; products: SeedProduct[]; version?: number; generatedAt?: string };
}

async function readCatalogDb(): Promise<EquipmentCatalogDb> {
  const current = await readJsonFile<EquipmentCatalogDb>(dbPath());
  if (current && current.version === 1 && Array.isArray(current.categories) && Array.isArray(current.products)) {
    return current;
  }
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    categories: [],
    products: [],
  };
}

async function writeCatalogDb(db: EquipmentCatalogDb) {
  await writeJsonFile(dbPath(), {
    ...db,
    version: 1,
    updatedAt: new Date().toISOString(),
  });
}

export async function listEquipmentCategories() {
  const db = await readCatalogDb();
  const countByCategoryId = new Map<string, number>();
  for (const product of db.products) {
    countByCategoryId.set(product.categoryId, (countByCategoryId.get(product.categoryId) ?? 0) + 1);
  }
  return db.categories
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
    .map((category) => ({
      ...category,
      productCount: countByCategoryId.get(category.id) ?? 0,
    }));
}

export async function listEquipmentProducts(filters: EquipmentListFilters) {
  const db = await readCatalogDb();
  const categoriesById = new Map(db.categories.map((category) => [category.id, category]));
  const categoriesBySlug = new Map(db.categories.map((category) => [category.slug, category]));

  let items = db.products.filter((product) => {
    if (filters.slugs?.length) {
      return filters.slugs.includes(product.slug);
    }
    if (filters.category) {
      const selected = categoriesBySlug.get(filters.category);
      if (!selected) return false;
      const childIds = new Set(
        db.categories
          .filter((c) => c.id === selected.id || c.parentId === selected.id)
          .map((c) => c.id)
      );
      if (!childIds.has(product.categoryId)) return false;
    }
    if (filters.phase && !product.phaseTags.includes(filters.phase as EquipmentPhase)) return false;
    if (filters.subject && !product.subjectTags.some((tag) => tag.toLowerCase() === filters.subject!.toLowerCase())) {
      return false;
    }
    if (filters.fulfillment && product.fulfillmentType !== filters.fulfillment) return false;
    if (Number.isFinite(filters.grade ?? NaN)) {
      const grade = Number(filters.grade);
      if (product.gradeMin > grade || product.gradeMax < grade) return false;
    }
    if (filters.priceType === "free" && product.priceCents > 0) return false;
    if (filters.priceType === "paid" && product.priceCents <= 0) return false;
    if (Number.isFinite(filters.minPriceCents ?? NaN) && product.priceCents < Number(filters.minPriceCents)) {
      return false;
    }
    if (Number.isFinite(filters.maxPriceCents ?? NaN) && product.priceCents > Number(filters.maxPriceCents)) {
      return false;
    }
    if (filters.q?.trim()) {
      const q = filters.q.trim().toLowerCase();
      const hay = [
        product.title,
        product.description,
        product.brand || "",
        product.sku || "",
        ...product.tags,
        ...product.subjectTags,
        categoriesById.get(product.categoryId)?.name || "",
      ]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  items = items.sort((a, b) => a.title.localeCompare(b.title));

  const total = items.length;
  const page = Math.max(1, Math.floor(filters.page || 1));
  const pageSize = Math.min(100, Math.max(1, Math.floor(filters.pageSize || 24)));
  const offset = (page - 1) * pageSize;
  const pageItems = items.slice(offset, offset + pageSize).map((product) => ({
    ...product,
    category: categoriesById.get(product.categoryId) ?? null,
  }));

  return {
    products: pageItems,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}

export async function getEquipmentProductBySlug(slug: string) {
  const db = await readCatalogDb();
  const product = db.products.find((item) => item.slug === slug) ?? null;
  if (!product) return null;
  const category = db.categories.find((c) => c.id === product.categoryId) ?? null;
  const bundleItemsExpanded = product.isBundle
    ? (product.bundleItems || [])
        .map((row) => {
          const item = db.products.find((p) => p.slug === row.slug);
          if (!item) return null;
          return { product: item, qty: row.qty };
        })
        .filter(Boolean)
    : [];
  return {
    ...product,
    category,
    bundleItemsExpanded,
  };
}

function validateSeedProduct(input: SeedProduct, categorySlugs: Set<string>) {
  const parsed = seedProductSchema.parse(input);
  if (parsed.gradeMin > parsed.gradeMax) {
    throw new Error("gradeMin cannot exceed gradeMax");
  }
  if (!categorySlugs.has(parsed.categorySlug)) {
    throw new Error(`Unknown categorySlug: ${parsed.categorySlug}`);
  }
  if (parsed.isBundle && (!parsed.bundleItems || parsed.bundleItems.length === 0)) {
    throw new Error("Bundle product requires bundleItems");
  }
  return parsed;
}

export async function ingestEquipmentSeed() {
  const seed = await readEquipmentSeed();
  const db = await readCatalogDb();

  const failed: Array<{ slug: string; reason: string }> = [];
  let inserted = 0;
  let updated = 0;

  const categoryBySlug = new Map<string, EquipmentCategory>();
  const currentCategoryBySlug = new Map(db.categories.map((c) => [c.slug, c]));

  for (const [index, rawCategory] of seed.categories.entries()) {
    try {
      const parsed = seedCategorySchema.parse(rawCategory);
      const existing = currentCategoryBySlug.get(parsed.slug);
      const category: EquipmentCategory = withTimestamps(
        {
          id: existing?.id ?? randomUUID(),
          slug: parsed.slug,
          name: parsed.name,
          parentId: null,
          sortOrder: parsed.sortOrder ?? (index + 1) * 10,
        },
        existing ?? undefined
      );
      categoryBySlug.set(category.slug, category);
    } catch (error) {
      failed.push({
        slug: String((rawCategory as any)?.slug || `category-${index}`),
        reason: error instanceof Error ? error.message : "Invalid category",
      });
    }
  }

  for (const rawCategory of seed.categories) {
    const parsed = seedCategorySchema.parse(rawCategory);
    const category = categoryBySlug.get(parsed.slug);
    if (!category) continue;
    if (parsed.parentSlug) {
      const parent = categoryBySlug.get(parsed.parentSlug);
      if (!parent) {
        failed.push({ slug: parsed.slug, reason: `Unknown parent category: ${parsed.parentSlug}` });
        continue;
      }
      category.parentId = parent.id;
    }
  }

  const nextProducts: EquipmentProduct[] = [];
  const existingBySlug = new Map(db.products.map((p) => [p.slug, p]));
  const validCategorySlugs = new Set(categoryBySlug.keys());

  for (const rawProduct of seed.products) {
    try {
      const parsed = validateSeedProduct(rawProduct, validCategorySlugs);
      const existing = existingBySlug.get(parsed.slug);
      const category = categoryBySlug.get(parsed.categorySlug);
      if (!category) throw new Error(`Unknown categorySlug: ${parsed.categorySlug}`);
      const product: EquipmentProduct = withTimestamps(
        {
          id: existing?.id ?? randomUUID(),
          slug: normalizeSlug(parsed.slug),
          title: parsed.title,
          description: parsed.description,
          brand: parsed.brand ?? null,
          sku: parsed.sku ?? null,
          categoryId: category.id,
          phaseTags: parsed.phaseTags,
          gradeMin: parsed.gradeMin,
          gradeMax: parsed.gradeMax,
          subjectTags: parsed.subjectTags,
          tags: parsed.tags ?? [],
          priceCents: parsed.priceCents,
          currency: (parsed.currency || "ZAR").toUpperCase(),
          images: parsed.images ?? [],
          fulfillmentType: parsed.fulfillmentType,
          stockQty: parsed.stockQty ?? null,
          leadTimeDays: parsed.leadTimeDays ?? null,
          attributes: parsed.attributes ?? {},
          isBundle: parsed.isBundle ?? false,
          bundleItems: parsed.bundleItems ?? null,
        },
        existing ?? undefined
      );
      if (existing) updated += 1;
      else inserted += 1;
      nextProducts.push(product);
    } catch (error) {
      failed.push({
        slug: String((rawProduct as any)?.slug || "unknown-product"),
        reason: error instanceof Error ? error.message : "Invalid product",
      });
    }
  }

  // Keep any manually-created products not present in the seed.
  const seededSlugs = new Set(nextProducts.map((p) => p.slug));
  const manualCarryForward = db.products.filter((p) => !seededSlugs.has(p.slug));

  const mergedProducts = [...manualCarryForward, ...nextProducts];
  const nextDb: EquipmentCatalogDb = {
    version: 1,
    updatedAt: new Date().toISOString(),
    categories: Array.from(categoryBySlug.values()).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    products: mergedProducts,
  };
  await writeCatalogDb(nextDb);

  return {
    inserted,
    updated,
    failed,
    totals: {
      categories: nextDb.categories.length,
      products: nextDb.products.length,
      bundles: nextDb.products.filter((p) => p.isBundle).length,
    },
  };
}

export async function listAdminEquipmentProducts() {
  const db = await readCatalogDb();
  const categoriesById = new Map(db.categories.map((c) => [c.id, c]));
  return {
    categories: db.categories.slice().sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    products: db.products
      .slice()
      .sort((a, b) => a.title.localeCompare(b.title))
      .map((product) => ({ ...product, category: categoriesById.get(product.categoryId) ?? null })),
  };
}

export async function upsertAdminEquipmentProduct(input: unknown) {
  const parsed = adminProductSchema.parse(input);
  const db = await readCatalogDb();
  const categoriesById = new Map(db.categories.map((c) => [c.id, c]));
  const categoriesBySlug = new Map(db.categories.map((c) => [c.slug, c]));
  const category = categoriesBySlug.get(parsed.categorySlug);
  if (!category) {
    throw new Error(`Unknown categorySlug: ${parsed.categorySlug}`);
  }
  if (parsed.gradeMin > parsed.gradeMax) {
    throw new Error("gradeMin cannot exceed gradeMax");
  }
  if (parsed.isBundle && (!parsed.bundleItems || parsed.bundleItems.length === 0)) {
    throw new Error("Bundle products require bundleItems");
  }

  const normalizedSlug = normalizeSlug(parsed.slug);
  const byIdIndex = parsed.id ? db.products.findIndex((p) => p.id === parsed.id) : -1;
  const bySlugIndex = db.products.findIndex((p) => p.slug === normalizedSlug);
  const targetIndex = byIdIndex >= 0 ? byIdIndex : bySlugIndex;
  const existing = targetIndex >= 0 ? db.products[targetIndex] : undefined;

  const next: EquipmentProduct = withTimestamps(
    {
      id: existing?.id ?? parsed.id ?? randomUUID(),
      slug: normalizedSlug,
      title: parsed.title,
      description: parsed.description,
      brand: parsed.brand ?? null,
      sku: parsed.sku ?? null,
      categoryId: category.id,
      phaseTags: parsed.phaseTags,
      gradeMin: parsed.gradeMin,
      gradeMax: parsed.gradeMax,
      subjectTags: parsed.subjectTags,
      tags: parsed.tags ?? [],
      priceCents: parsed.priceCents,
      currency: (parsed.currency || "ZAR").toUpperCase(),
      images: parsed.images ?? [],
      fulfillmentType: parsed.fulfillmentType,
      stockQty: parsed.stockQty ?? null,
      leadTimeDays: parsed.leadTimeDays ?? null,
      attributes: parsed.attributes ?? {},
      isBundle: parsed.isBundle ?? false,
      bundleItems: parsed.bundleItems ?? null,
    },
    existing ?? undefined
  );

  if (targetIndex >= 0) db.products[targetIndex] = next;
  else db.products.push(next);
  await writeCatalogDb(db);
  return { product: { ...next, category: categoriesById.get(next.categoryId) ?? category }, created: targetIndex < 0 };
}

export async function deleteAdminEquipmentProductBySlug(slug: string) {
  const db = await readCatalogDb();
  const index = db.products.findIndex((product) => product.slug === slug);
  if (index < 0) return false;
  db.products.splice(index, 1);
  await writeCatalogDb(db);
  return true;
}

export async function validateEquipmentCart(items: EquipmentCartLine[]) {
  const normalized = items
    .map((line) => ({
      slug: normalizeSlug(line.slug),
      quantity: Math.max(1, Math.min(20, Math.floor(line.quantity || 1))),
    }))
    .filter((line) => line.slug);
  if (!normalized.length) {
    return {
      items: [] as EquipmentValidatedCartItem[],
      totals: { subtotalCents: 0, totalCents: 0, currency: "ZAR" },
    };
  }

  const db = await readCatalogDb();
  const bySlug = new Map(db.products.map((product) => [product.slug, product]));
  const validated: EquipmentValidatedCartItem[] = [];
  let subtotal = 0;
  for (const line of normalized) {
    const product = bySlug.get(line.slug);
    if (!product) continue;
    const lineTotal = product.priceCents * line.quantity;
    subtotal += lineTotal;
    validated.push({
      product,
      quantity: line.quantity,
      unitPriceCents: product.priceCents,
      lineTotalCents: lineTotal,
    });
  }
  return {
    items: validated,
    totals: {
      subtotalCents: subtotal,
      totalCents: subtotal,
      currency: validated[0]?.product.currency || "ZAR",
    },
  };
}

type EquipmentQuoteItem = {
  slug: string;
  title: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
  fulfillmentType: EquipmentFulfillmentType;
  isBundle: boolean;
};

export const EQUIPMENT_QUOTE_STATUSES = ["received", "answered", "closed"] as const;
export type EquipmentQuoteStatus = (typeof EQUIPMENT_QUOTE_STATUSES)[number];

type EquipmentQuoteRequester = {
  organizationName: string | null;
  contactEmail: string | null;
  province: string | null;
  purpose: "equipment_quote_follow_up";
};

export type EquipmentQuoteRecord = {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: EquipmentQuoteStatus;
  statusUpdatedAt: string | null;
  statusUpdatedBy: string | null;
  currency: string;
  subtotalCents: number;
  totalCents: number;
  items: EquipmentQuoteItem[];
  requester: EquipmentQuoteRequester;
  notes: Record<string, unknown>;
  antiAbuse: {
    clientHash: string | null;
    source: string;
  };
};

const DEFAULT_EQUIPMENT_QUOTE_RETENTION_DAYS = 30;

function resolveQuoteRetentionDays(value?: number | null) {
  const candidate =
    value ??
    Number(process.env.EQUIPMENT_QUOTE_RETENTION_DAYS || DEFAULT_EQUIPMENT_QUOTE_RETENTION_DAYS);
  if (!Number.isFinite(candidate)) return DEFAULT_EQUIPMENT_QUOTE_RETENTION_DAYS;
  return Math.max(1, Math.min(365, Math.floor(candidate)));
}

function isQuoteWithinRetentionWindow(quote: EquipmentQuoteRecord, olderThanDays: number, nowMs: number) {
  const createdAtMs = Date.parse(quote.createdAt);
  if (!Number.isFinite(createdAtMs)) return false;
  const ageMs = nowMs - createdAtMs;
  const maxAgeMs = olderThanDays * 24 * 60 * 60 * 1000;
  return ageMs <= maxAgeMs;
}

function hashClientIdentity(input: { ip?: string | null; userAgent?: string | null }) {
  const seed = `${input.ip || ""}|${input.userAgent || ""}`.trim();
  if (!seed) return null;
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return `h${Math.abs(hash)}`;
}

function normalizeQuoteStatus(status: unknown): EquipmentQuoteStatus {
  return status === "answered" || status === "closed" || status === "received" ? status : "received";
}

function normalizeRequester(
  requester: Partial<EquipmentQuoteRequester> | null | undefined
): EquipmentQuoteRequester {
  const organizationName = typeof requester?.organizationName === "string" ? requester.organizationName.trim() : "";
  const contactEmail = typeof requester?.contactEmail === "string" ? requester.contactEmail.trim().toLowerCase() : "";
  const province = typeof requester?.province === "string" ? requester.province.trim() : "";
  return {
    organizationName: organizationName || null,
    contactEmail: contactEmail || null,
    province: province || null,
    purpose: "equipment_quote_follow_up",
  };
}

function normalizeQuoteRecord(raw: unknown): EquipmentQuoteRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  if (typeof row.id !== "string" || typeof row.createdAt !== "string") return null;
  const items = Array.isArray(row.items) ? row.items : [];
  const normalizedItems: EquipmentQuoteItem[] = items
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      if (typeof record.slug !== "string" || typeof record.title !== "string") return null;
      return {
        slug: record.slug,
        title: record.title,
        quantity: Number.isFinite(Number(record.quantity)) ? Math.max(1, Math.floor(Number(record.quantity))) : 1,
        unitPriceCents: Number.isFinite(Number(record.unitPriceCents))
          ? Math.max(0, Math.floor(Number(record.unitPriceCents)))
          : 0,
        lineTotalCents: Number.isFinite(Number(record.lineTotalCents))
          ? Math.max(0, Math.floor(Number(record.lineTotalCents)))
          : 0,
        fulfillmentType:
          record.fulfillmentType === "SHIP_FROM_SUPPLIER" ||
          record.fulfillmentType === "DROPSHIP" ||
          record.fulfillmentType === "AFFILIATE_LINK" ||
          record.fulfillmentType === "QUOTE_REQUIRED" ||
          record.fulfillmentType === "STOCKED"
            ? record.fulfillmentType
            : "QUOTE_REQUIRED",
        isBundle: Boolean(record.isBundle),
      } satisfies EquipmentQuoteItem;
    })
    .filter((item): item is EquipmentQuoteItem => item !== null);

  return {
    id: row.id,
    createdAt: row.createdAt,
    updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : row.createdAt,
    status: normalizeQuoteStatus(row.status),
    statusUpdatedAt: typeof row.statusUpdatedAt === "string" ? row.statusUpdatedAt : null,
    statusUpdatedBy: typeof row.statusUpdatedBy === "string" ? row.statusUpdatedBy : null,
    currency: typeof row.currency === "string" && row.currency ? row.currency : "ZAR",
    subtotalCents: Number.isFinite(Number(row.subtotalCents))
      ? Math.max(0, Math.floor(Number(row.subtotalCents)))
      : 0,
    totalCents: Number.isFinite(Number(row.totalCents)) ? Math.max(0, Math.floor(Number(row.totalCents))) : 0,
    items: normalizedItems,
    requester: normalizeRequester(
      row.requester && typeof row.requester === "object"
        ? (row.requester as Partial<EquipmentQuoteRequester>)
        : null
    ),
    notes: row.notes && typeof row.notes === "object" ? (row.notes as Record<string, unknown>) : {},
    antiAbuse: {
      clientHash:
        row.antiAbuse &&
        typeof row.antiAbuse === "object" &&
        typeof (row.antiAbuse as { clientHash?: unknown }).clientHash === "string"
          ? ((row.antiAbuse as { clientHash?: string }).clientHash ?? null)
          : null,
      source:
        row.antiAbuse &&
        typeof row.antiAbuse === "object" &&
        typeof (row.antiAbuse as { source?: unknown }).source === "string"
          ? ((row.antiAbuse as { source?: string }).source ?? "web")
          : "web",
    },
  };
}

async function readEquipmentQuotes() {
  const existing = (await readJsonFile<unknown[]>(quotesPath())) ?? [];
  if (!Array.isArray(existing)) return [] as EquipmentQuoteRecord[];
  return existing
    .map((row) => normalizeQuoteRecord(row))
    .filter((row): row is EquipmentQuoteRecord => row !== null);
}

type ListEquipmentQuoteFilters = {
  status?: EquipmentQuoteStatus | "all";
  from?: string | null;
  to?: string | null;
  limit?: number | null;
};

function parseDateValue(input: string | null | undefined) {
  if (!input) return null;
  const timestamp = Date.parse(input);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function resolveQuoteListLimit(value: number | null | undefined) {
  if (!Number.isFinite(value)) return 100;
  return Math.max(1, Math.min(500, Math.floor(Number(value))));
}

export async function createEquipmentQuoteRequest(input: {
  items: EquipmentCartLine[];
  notes?: Record<string, unknown>;
  requester?: Partial<EquipmentQuoteRequester>;
  client?: { ip?: string | null; userAgent?: string | null; source?: string };
}) {
  const validated = await validateEquipmentCart(input.items);
  if (!validated.items.length) {
    throw new Error("Cart is empty. Add at least one equipment item before requesting a quote.");
  }
  const requester = normalizeRequester(input.requester);
  if (!requester.contactEmail) {
    throw new Error("Contact email is required for quote follow-up.");
  }
  const nowIso = new Date().toISOString();

  const quote: EquipmentQuoteRecord = {
    id: `eqq_${randomUUID().replace(/-/g, "").slice(0, 18)}`,
    createdAt: nowIso,
    updatedAt: nowIso,
    status: "received",
    statusUpdatedAt: null,
    statusUpdatedBy: null,
    currency: validated.totals.currency,
    subtotalCents: validated.totals.subtotalCents,
    totalCents: validated.totals.totalCents,
    items: validated.items.map((line) => ({
      slug: line.product.slug,
      title: line.product.title,
      quantity: line.quantity,
      unitPriceCents: line.unitPriceCents,
      lineTotalCents: line.lineTotalCents,
      fulfillmentType: line.product.fulfillmentType,
      isBundle: line.product.isBundle,
    })),
    requester,
    notes: input.notes ?? {},
    antiAbuse: {
      clientHash: hashClientIdentity({
        ip: input.client?.ip ?? null,
        userAgent: input.client?.userAgent ?? null,
      }),
      source: input.client?.source ?? "web",
    },
  };

  const nowMs = Date.now();
  const retentionDays = resolveQuoteRetentionDays();
  const existing = (await readJsonFile<EquipmentQuoteRecord[]>(quotesPath())) ?? [];
  const retained = existing.filter((row) =>
    isQuoteWithinRetentionWindow(row, retentionDays, nowMs)
  );
  retained.unshift(quote);
  await writeJsonFile(quotesPath(), retained.slice(0, 1000));

  const affiliateLinks = validated.items
    .filter((line) => line.product.fulfillmentType === "AFFILIATE_LINK")
    .map((line) => ({
      slug: line.product.slug,
      title: line.product.title,
      url:
        typeof line.product.attributes?.affiliateUrl === "string"
          ? (line.product.attributes.affiliateUrl as string)
          : null,
    }));

  return {
    quote,
    validated,
    message: "Quote request captured. Supplier follow-up will confirm pricing and delivery options.",
    affiliateLinks,
  };
}

export async function cleanupEquipmentQuotes(options?: { olderThanDays?: number | null }) {
  const olderThanDays = resolveQuoteRetentionDays(options?.olderThanDays ?? null);
  const nowMs = Date.now();
  const existing = await readEquipmentQuotes();
  const retained = existing.filter((row) =>
    isQuoteWithinRetentionWindow(row, olderThanDays, nowMs)
  );
  if (retained.length !== existing.length) {
    await writeJsonFile(quotesPath(), retained.slice(0, 1000));
  }
  return {
    ok: true,
    olderThanDays,
    removedCount: Math.max(0, existing.length - retained.length),
    remainingCount: retained.length,
  };
}

export async function listEquipmentQuotes(filters: ListEquipmentQuoteFilters = {}) {
  const retentionDays = resolveQuoteRetentionDays();
  const nowMs = Date.now();
  const existing = await readEquipmentQuotes();
  const retained = existing.filter((row) => isQuoteWithinRetentionWindow(row, retentionDays, nowMs));
  if (retained.length !== existing.length) {
    await writeJsonFile(quotesPath(), retained.slice(0, 1000));
  }

  const statusFilter = filters.status && filters.status !== "all" ? normalizeQuoteStatus(filters.status) : null;
  const fromMs = parseDateValue(filters.from ?? null);
  const toMs = parseDateValue(filters.to ?? null);
  const limit = resolveQuoteListLimit(filters.limit ?? null);

  const filtered = retained
    .filter((quote) => {
      if (statusFilter && quote.status !== statusFilter) return false;
      const createdAtMs = Date.parse(quote.createdAt);
      if (fromMs !== null && Number.isFinite(createdAtMs) && createdAtMs < fromMs) return false;
      if (toMs !== null && Number.isFinite(createdAtMs) && createdAtMs > toMs) return false;
      return true;
    })
    .sort((a, b) => {
      const left = Date.parse(a.createdAt);
      const right = Date.parse(b.createdAt);
      if (!Number.isFinite(left) || !Number.isFinite(right)) return 0;
      return right - left;
    });

  return {
    quotes: filtered.slice(0, limit),
    totalCount: filtered.length,
    retentionDays,
    applied: {
      status: statusFilter ?? "all",
      from: filters.from ?? null,
      to: filters.to ?? null,
      limit,
    },
  };
}

export async function updateEquipmentQuoteStatus(input: {
  quoteId: string;
  status: EquipmentQuoteStatus;
  updatedBy: string | null;
}) {
  const status = normalizeQuoteStatus(input.status);
  const existing = await readEquipmentQuotes();
  const nowMs = Date.now();
  const retentionDays = resolveQuoteRetentionDays();
  const retained = existing.filter((row) => isQuoteWithinRetentionWindow(row, retentionDays, nowMs));

  const index = retained.findIndex((row) => row.id === input.quoteId);
  if (index < 0) {
    return null;
  }

  const nowIso = new Date().toISOString();
  const current = retained[index];
  retained[index] = {
    ...current,
    status,
    updatedAt: nowIso,
    statusUpdatedAt: nowIso,
    statusUpdatedBy: input.updatedBy?.trim() || null,
  };
  await writeJsonFile(quotesPath(), retained.slice(0, 1000));
  return retained[index];
}
