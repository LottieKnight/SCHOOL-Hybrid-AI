import { createHash, createHmac, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { FastifyInstance } from "fastify";
import { z } from "zod";
import { config } from "../config.js";
import {
  createBookstoreIngestJob,
  createBookstoreOrder,
  createBookstoreDownloadToken,
  createBookstoreSupplierImportJob,
  consumeBookstoreDownloadToken,
  getBookstoreDownloadToken,
  getBookstoreOrderForAdmin,
  getBookstoreOrderForUser,
  getBookstoreProductByIdOrSlug,
  listBookstoreIngestJobs,
  listBookstoreOrdersForAdmin,
  listBookstoreOrdersForUser,
  listBookstoreProducts,
  recordBookstoreDownloadEvent,
  slugifyProductTitle,
  updateBookstoreOrderPayment,
  updateBookstoreOrderStatus,
  upsertBookstoreProduct,
  validateBookstoreCart,
  type BookstoreProductInput,
} from "../db/bookstore.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import {
  LICENSE_TYPES,
  type BookstoreLicenseType,
  type BookstoreFulfillmentType,
  LicensingRuleError,
  validateLicensingRules,
} from "../lib/bookstore-licensing.js";
import {
  LicenseComplianceError,
  deriveLicenseFlags as deriveLicenseCapabilities,
  validateCheckoutLicensing,
} from "../lib/license_rules.js";
import { createPaymentIntent, fetchStripeCheckoutSession } from "../lib/bookstore-payments.js";
import {
  createPayFastBookstoreCheckoutUrl,
  payfastEnabled,
  verifyPayFastItn,
  type PayFastItnPayload,
} from "../lib/payfast.js";
import { markWebhookEventProcessed } from "../db/wallet.js";
import { defaultTargetMarginRate, recommendPodRetailPrice } from "../lib/bookstore-pod-pricing.js";

const phaseEnum = z.enum(["FOUNDATION", "INTERMEDIATE", "SENIOR", "FET"]);
const formatEnum = z.enum(["DIGITAL", "HARDCOPY", "BUNDLE"]);
const priceTypeEnum = z.enum(["all", "free", "paid"]);
const licenseTypeEnum = z.enum(LICENSE_TYPES);
const sourceProviderEnum = z.enum([
  "SIYAVULA",
  "AFRICAN_STORYBOOK",
  "STORYWEAVER",
  "OPENSTAX",
  "WHOLESALER",
  "PUBLISHER_DIRECT",
  "MANUAL",
]);
const fileTypeEnum = z.enum(["PDF", "EPUB", "ZIP", "LINK_ONLY"]);
const fulfillmentTypeEnum = z.enum(["LINK_ONLY", "FILE_DOWNLOAD", "PRINT_ON_DEMAND", "SHIP_FROM_SUPPLIER"]);

const listProductsQuerySchema = z.object({
  phase: phaseEnum.optional(),
  grade: z.coerce.number().int().min(0).max(12).optional(),
  subject: z.string().trim().min(1).max(120).optional(),
  format: formatEnum.optional(),
  priceType: priceTypeEnum.optional(),
  license: z.union([z.string(), z.array(z.string())]).optional(),
  commercialAllowedOnly: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .optional()
    .transform((value) => value === true || value === "true"),
  q: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).max(1000).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

const cartSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.coerce.number().int().min(1).max(20),
      })
    )
    .min(1),
});

const checkoutSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.coerce.number().int().min(1).max(20),
      })
    )
    .min(1),
  address: z.record(z.unknown()).optional().default({}),
  notes: z.record(z.unknown()).optional().default({}),
});

const adminProductSchema = z.object({
  id: z.string().uuid().optional(),
  slug: z.string().trim().min(1).max(120).optional(),
  title: z.string().trim().min(2).max(240),
  description: z.string().trim().min(1).max(10000),
  phase: phaseEnum,
  grade_min: z.coerce.number().int().min(0).max(12),
  grade_max: z.coerce.number().int().min(0).max(12),
  subjects: z.array(z.string().trim().min(1).max(120)).max(50),
  format: formatEnum,
  price_cents: z.coerce.number().int().min(0).max(100000000),
  currency: z.string().trim().min(3).max(3).default("ZAR"),
  license_type: licenseTypeEnum,
  license_url: z.string().trim().url().optional().or(z.literal("")).transform((v) => v || undefined),
  attribution_html: z.string().optional().default(""),
  source_url: z.string().trim().url().optional().or(z.literal("")).transform((v) => v || undefined),
  source_provider: sourceProviderEnum,
  supplier_id: z.string().uuid().optional().or(z.literal("")).transform((v) => v || undefined),
  is_adapted: z.boolean().optional().default(false),
  is_excerpt: z.boolean().optional().default(false),
  is_partial_product: z.boolean().optional().default(false),
  adapted_license_type: licenseTypeEnum.optional(),
  storage_key: z.string().trim().max(500).optional().or(z.literal("")).transform((v) => v || undefined),
  delivery_mode: z.enum(["LINK_ONLY", "FILE_DOWNLOAD"]).optional(),
  file_type: fileTypeEnum.optional(),
  file_size: z.coerce.number().int().min(0).optional(),
  checksum: z.string().trim().max(256).optional().or(z.literal("")).transform((v) => v || undefined),
  external_download_url: z.string().trim().url().optional().or(z.literal("")).transform((v) => v || undefined),
  fulfillment_type: fulfillmentTypeEnum,
  pod_spec_json: z.record(z.unknown()).optional().default({}),
  pod_base_cost_cents: z.coerce.number().int().min(0).nullable().optional(),
  target_margin_rate: z.coerce.number().min(0).max(0.94).nullable().optional(),
  vat_inclusive: z.boolean().optional().default(true),
  shipping_profile_id: z.string().uuid().optional().or(z.literal("")).transform((v) => v || undefined),
  stock_qty: z.coerce.number().int().min(0).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(64)).optional().default([]),
  metadata_json: z.record(z.unknown()).optional().default({}),
  is_active: z.boolean().optional().default(true),
});

const adminOrderStatusSchema = z.object({
  status: z.enum(["pending", "awaiting_payment", "paid", "canceled", "fulfilled", "failed"]),
});

const downloadParamsSchema = z.object({
  orderId: z.string().trim().min(1),
  productId: z.string().uuid(),
});

const supplierSyncSchema = z.object({
  provider: z.enum(["WHOLESALER", "PUBLISHER_DIRECT"]).optional().default("WHOLESALER"),
});

const adminOerIngestRequestSchema = z.object({
  seedFormat: z.enum(["json", "csv", "all"]).optional().default("all"),
});

const podPricingRequestSchema = z.object({
  printCostCents: z.coerce.number().int().min(0),
  shippingCostCents: z.coerce.number().int().min(0).optional().default(0),
  fixedFeesCents: z.coerce.number().int().min(0).optional().default(0),
  paymentFeeRate: z.coerce.number().min(0).max(0.94).optional().default(0.029),
  riskBufferRate: z.coerce.number().min(0).max(0.94).optional().default(0.03),
  targetMarginRate: z.coerce.number().min(0).max(0.94).optional(),
  productKind: z.enum(["workbook", "textbook", "color"]).optional().default("textbook"),
  vatRate: z.coerce.number().min(0).max(0.5).optional().default(0.15),
  vatInclusive: z.boolean().optional().default(true),
  roundingStepCents: z.coerce.number().int().min(1).max(10000).optional().default(100),
});

const checkoutConfirmQuerySchema = z.object({
  provider: z.enum(["stripe", "payfast"]),
  orderId: z.string().uuid(),
  sessionId: z.string().trim().min(3).optional(),
});

const downloadTokenParamsSchema = z.object({
  token: z.string().trim().min(8).max(500),
});

const oerSeedSchema = z.object({
  title: z.string(),
  description: z.string(),
  phase: phaseEnum,
  grade_min: z.number().int().min(0).max(12),
  grade_max: z.number().int().min(0).max(12),
  subjects: z.array(z.string()).min(1),
  source_provider: sourceProviderEnum,
  source_url: z.string().url(),
  external_download_url: z.string().url(),
  license_type: licenseTypeEnum,
  license_url: z.string().url(),
  attribution_html: z.string(),
  format: formatEnum.default("DIGITAL"),
  tags: z.array(z.string()).optional().default([]),
});

function normalizeLicenseFilters(value: string | string[] | undefined) {
  if (!value) return undefined;
  const list = Array.isArray(value) ? value : value.split(",");
  const parsed = list
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item): item is BookstoreLicenseType => LICENSE_TYPES.includes(item as BookstoreLicenseType));
  return parsed.length ? parsed : undefined;
}

function mapProductForClient(product: any) {
  const licenseCapabilities =
    product.license_type && product.license_type !== "OTHER"
      ? deriveLicenseCapabilities(product.license_type)
      : {
          isCommercialAllowed: !product.nc_noncommercial,
          isDerivativeAllowed: !product.nd_no_derivatives,
          requiresShareAlike: Boolean(product.sa_sharealike),
          requiresAttribution: Boolean(String(product.license_type || "").startsWith("CC_")),
        };
  return {
    ...product,
    license_flags: {
      nd_no_derivatives: product.nd_no_derivatives,
      nc_noncommercial: product.nc_noncommercial,
      sa_sharealike: product.sa_sharealike,
    },
    license_capabilities: licenseCapabilities,
    digital_asset:
      product.storage_key || product.file_type || product.file_size || product.checksum
        ? {
            storage_key: product.storage_key,
            file_type: product.file_type,
            file_size: product.file_size,
            checksum: product.checksum,
          }
        : null,
  };
}

function safeRepoRoot() {
  const cwd = process.cwd();
  const candidates = [cwd, path.join(cwd, ".."), path.join(cwd, "..", "..")];
  for (const candidate of candidates) {
    if (existsSync(path.join(candidate, "data"))) {
      return candidate;
    }
  }
  return cwd;
}

function getOerSeedPath() {
  return path.join(safeRepoRoot(), "data", "oer_catalog_seed.json");
}

function getOerSeedCsvPath() {
  return path.join(safeRepoRoot(), "data", "oer_catalog_seed.csv");
}

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      const next = line[i + 1];
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  cells.push(current);
  return cells.map((cell) => cell.trim());
}

function parseDelimitedList(value: string | undefined, delimiter = "|") {
  return String(value || "")
    .split(delimiter)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseOerSeedCsv(raw: string) {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
  if (!lines.length) return [];
  const header = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    const record: Record<string, string> = {};
    header.forEach((key, index) => {
      record[key] = cells[index] ?? "";
    });
    return record;
  });

  return rows.map((row) => ({
    title: row.title,
    description: row.description,
    phase: row.phase,
    grade_min: Number(row.grade_min),
    grade_max: Number(row.grade_max),
    subjects: parseDelimitedList(row.subjects),
    source_provider: row.source_provider,
    source_url: row.source_url,
    external_download_url: row.external_download_url,
    license_type: row.license_type,
    license_url: row.license_url,
    attribution_html: row.attribution_html,
    format: row.format || "DIGITAL",
    tags: parseDelimitedList(row.tags),
  }));
}

function loadOerSeedItems(seedFormat: "json" | "csv" | "all") {
  const loaded: Array<{ sourceFile: string; items: Array<z.infer<typeof oerSeedSchema>> }> = [];

  const includeJson = seedFormat === "json" || seedFormat === "all";
  const includeCsv = seedFormat === "csv" || seedFormat === "all";

  if (includeJson) {
    const jsonPath = getOerSeedPath();
    if (!existsSync(jsonPath)) {
      if (seedFormat === "json") {
        throw new Error(`Missing OER seed file: ${jsonPath}`);
      }
    } else {
      const raw = readFileSync(jsonPath, "utf8");
      const parsedRaw = JSON.parse(raw);
      loaded.push({
        sourceFile: path.basename(jsonPath),
        items: z.array(oerSeedSchema).parse(parsedRaw),
      });
    }
  }

  if (includeCsv) {
    const csvPath = getOerSeedCsvPath();
    if (!existsSync(csvPath)) {
      if (seedFormat === "csv") {
        throw new Error(`Missing OER seed file: ${csvPath}`);
      }
    } else {
      const raw = readFileSync(csvPath, "utf8");
      loaded.push({
        sourceFile: path.basename(csvPath),
        items: z.array(oerSeedSchema).parse(parseOerSeedCsv(raw)),
      });
    }
  }

  return loaded;
}

type OerSeedImportResult = {
  ok: boolean;
  seedFormat: "json" | "csv" | "all";
  sources: string[];
  imported: number;
  failed: number;
  warnings: string[];
  results: Array<{
    title: string;
    slug: string;
    source_file: string;
    source_provider: string;
    status: "upserted" | "failed";
    warnings?: string[];
    error?: string;
  }>;
  job?: unknown;
};

async function importCuratedOerSeed(options: {
  seedFormat: "json" | "csv" | "all";
  createdBy?: string | null;
  recordJob?: boolean;
}): Promise<OerSeedImportResult> {
  const seedSources = loadOerSeedItems(options.seedFormat);
  if (!seedSources.length) {
    throw new Error("No OER seed file found for the requested format.");
  }

  const warnings: string[] = [];
  const results: OerSeedImportResult["results"] = [];
  let imported = 0;
  let failed = 0;

  for (const source of seedSources) {
    for (const item of source.items) {
      const title = item.title.trim();
      const slug = `${slugifyProductTitle(title)}-${item.source_provider.toLowerCase()}`;
      const price_cents = 0;
      const fulfillment_type = "LINK_ONLY" as const;

      try {
        const licenseCheck = validateLicensingRules({
          license_type: item.license_type,
          price_cents,
          fulfillment_type,
          is_adapted: false,
          source_url: item.source_url,
          file_type: "LINK_ONLY",
        });
        warnings.push(...licenseCheck.warnings.map((warning) => `${title}: ${warning}`));

        await upsertBookstoreProduct({
          slug,
          title,
          description: item.description,
          phase: item.phase,
          grade_min: item.grade_min,
          grade_max: item.grade_max,
          subjects: item.subjects,
          format: item.format,
          price_cents,
          currency: "ZAR",
          license_type: item.license_type,
          license_url: item.license_url,
          attribution_html: item.attribution_html,
          source_url: item.source_url,
          source_provider: item.source_provider,
          is_adapted: false,
          delivery_mode: "LINK_ONLY",
          external_download_url: item.external_download_url,
          file_type: "LINK_ONLY",
          fulfillment_type,
          tags: item.tags,
          metadata_json: {
            imported_from: source.sourceFile,
            ingestion: "manual-curated",
            seed_format: source.sourceFile.endsWith(".csv") ? "csv" : "json",
            auto_bootstrap: options.recordJob === false,
          },
          is_active: true,
        });

        imported += 1;
        results.push({
          title,
          slug,
          source_file: source.sourceFile,
          source_provider: item.source_provider,
          status: "upserted",
          warnings: licenseCheck.warnings,
        });
      } catch (error) {
        failed += 1;
        const message = error instanceof Error && error.message ? error.message : "Unknown ingestion error";
        results.push({
          title,
          slug,
          source_file: source.sourceFile,
          source_provider: item.source_provider,
          status: "failed",
          error: message,
        });
      }
    }
  }

  let job: unknown;
  if (options.recordJob !== false && options.createdBy) {
    job = await createBookstoreIngestJob({
      jobType: "oer_seed_import",
      source: seedSources.map((source) => source.sourceFile).join(", "),
      status: "completed",
      result: {
        seedFormat: options.seedFormat,
        imported,
        failed,
        warnings,
        results: results.slice(0, 100),
      },
      createdBy: options.createdBy,
    });
  }

  return {
    ok: failed === 0,
    seedFormat: options.seedFormat,
    sources: seedSources.map((source) => source.sourceFile),
    imported,
    failed,
    warnings,
    results,
    job,
  };
}

let bookstoreAutoSeedPromise: Promise<void> | null = null;

async function ensureBookstoreCatalogSeeded(app: FastifyInstance) {
  if (bookstoreAutoSeedPromise) {
    await bookstoreAutoSeedPromise;
    return;
  }
  bookstoreAutoSeedPromise = (async () => {
    try {
      const firstPage = await listBookstoreProducts({ page: 1, pageSize: 1, priceType: "all" });
      if (firstPage.pagination.total > 0) return;
      const imported = await importCuratedOerSeed({
        seedFormat: "all",
        recordJob: false,
      });
      app.log.info(
        {
          imported: imported.imported,
          failed: imported.failed,
          sources: imported.sources,
        },
        "Auto-bootstrapped bookstore catalog from curated OER seed"
      );
    } catch (error) {
      app.log.warn(
        { err: error instanceof Error ? error.message : error },
        "Unable to auto-bootstrap bookstore catalog from OER seed"
      );
    }
  })().finally(() => {
    bookstoreAutoSeedPromise = null;
  });
  await bookstoreAutoSeedPromise;
}

function verifyDownloadToken(token: string, input: { orderId: string; productId: string; userId: string }) {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const [orderId, productId, userId, expiresAtRaw, signature] = decoded.split(":");
    if (orderId !== input.orderId || productId !== input.productId || userId !== input.userId) return false;
    const expiresAt = Number(expiresAtRaw);
    if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return false;
    const payload = `${orderId}:${productId}:${userId}:${expiresAt}`;
    const expected = createHmac("sha256", config.jwtSecret).update(payload).digest("hex");
    return signature === expected;
  } catch {
    return false;
  }
}

function mapAdminProductInput(parsed: z.infer<typeof adminProductSchema>): BookstoreProductInput {
  const inferredAdaptedLicenseType =
    parsed.is_adapted && parsed.license_type.includes("_SA")
      ? parsed.license_type === "OTHER"
        ? null
        : parsed.license_type
      : parsed.adapted_license_type && parsed.adapted_license_type !== "OTHER"
        ? parsed.adapted_license_type
        : null;
  return {
    ...parsed,
    slug: parsed.slug || slugifyProductTitle(parsed.title),
    currency: parsed.currency.toUpperCase(),
    stock_qty: parsed.stock_qty ?? null,
    pod_base_cost_cents: parsed.pod_base_cost_cents ?? null,
    target_margin_rate: parsed.target_margin_rate ?? null,
    adapted_license_type: inferredAdaptedLicenseType,
    delivery_mode:
      parsed.delivery_mode ??
      (parsed.fulfillment_type === "LINK_ONLY"
        ? "LINK_ONLY"
        : parsed.fulfillment_type === "FILE_DOWNLOAD"
          ? "FILE_DOWNLOAD"
          : undefined),
    file_type: parsed.file_type ?? (parsed.fulfillment_type === "LINK_ONLY" ? "LINK_ONLY" : undefined),
  };
}

function handleRouteError(reply: any, error: unknown, fallback = "Request failed") {
  if (error instanceof LicensingRuleError) {
    reply.code(400).send({ error: error.message, code: error.code });
    return;
  }
  if (error instanceof LicenseComplianceError) {
    reply.code(400).send({ error: error.message, code: error.code });
    return;
  }
  if (error instanceof z.ZodError) {
    reply.code(400).send({ error: "Invalid input", details: error.flatten() });
    return;
  }
  reply.code(500).send({ error: fallback });
}

export async function registerBookstoreRoutes(app: FastifyInstance) {
  app.get("/bookstore/products", async (request, reply) => {
    try {
      await ensureBookstoreCatalogSeeded(app);
      const parsed = listProductsQuerySchema.parse(request.query ?? {});
      const result = await listBookstoreProducts({
        phase: parsed.phase,
        grade: parsed.grade,
        subject: parsed.subject,
        format: parsed.format,
        priceType: parsed.priceType ?? "all",
        licenseTypes: normalizeLicenseFilters(parsed.license),
        commercialAllowedOnly: parsed.commercialAllowedOnly,
        q: parsed.q,
        page: parsed.page,
        pageSize: parsed.pageSize,
      });
      reply.send({
        products: result.products.map(mapProductForClient),
        pagination: result.pagination,
      });
    } catch (error) {
      handleRouteError(reply, error, "Unable to load bookstore catalog.");
    }
  });

  app.get("/bookstore/products/:id", async (request, reply) => {
    const id = (request.params as { id?: string }).id;
    if (!id) {
      reply.code(400).send({ error: "Missing id" });
      return;
    }
    try {
      const product = await getBookstoreProductByIdOrSlug(id);
      if (!product || !product.is_active) {
        reply.code(404).send({ error: "Product not found" });
        return;
      }
      const licenseEval = validateLicensingRules({
        license_type: product.license_type as BookstoreLicenseType,
        price_cents: product.price_cents,
        is_adapted: product.is_adapted,
        adapted_license_type:
          product.adapted_license_type && product.adapted_license_type !== "OTHER"
            ? (product.adapted_license_type as any)
            : undefined,
        fulfillment_type: product.fulfillment_type as BookstoreFulfillmentType,
        storage_key: product.storage_key,
        file_type: (product.file_type as any) ?? undefined,
        checksum: product.checksum,
        source_url: product.source_url,
        is_excerpt: Boolean(product.is_excerpt),
        is_partial_product: Boolean(product.is_partial_product),
      });
      reply.send({
        product: mapProductForClient(product),
        licensing: {
          warnings: licenseEval.warnings,
          notes: licenseEval.notes,
        },
      });
    } catch (error) {
      handleRouteError(reply, error, "Unable to load product.");
    }
  });

  app.post("/cart", async (request, reply) => {
    try {
      const parsed = cartSchema.parse(request.body ?? {});
      const validated = await validateBookstoreCart(parsed.items);
      reply.send({
        items: validated.items.map((item) => ({
          product: mapProductForClient(item.product),
          quantity: item.quantity,
          unit_price_cents: item.unit_price_cents,
          line_total_cents: item.line_total_cents,
        })),
        totals: {
          subtotal_cents: validated.subtotal_cents,
          shipping_cents: 0,
          tax_cents: 0,
          total_cents: validated.subtotal_cents,
          currency: validated.currency,
        },
      });
    } catch (error) {
      handleRouteError(reply, error, "Unable to validate cart.");
    }
  });

  app.post("/checkout", { preHandler: requireAuth }, async (request, reply) => {
    try {
      const parsed = checkoutSchema.parse(request.body ?? {});
      const validated = await validateBookstoreCart(parsed.items);
      if (!validated.items.length) {
        reply.code(400).send({ error: "Cart is empty or contains unavailable products." });
        return;
      }

      for (const item of validated.items) {
        validateLicensingRules({
          license_type: item.product.license_type as BookstoreLicenseType,
          price_cents: item.product.price_cents,
          is_adapted: item.product.is_adapted,
          adapted_license_type:
            item.product.adapted_license_type && item.product.adapted_license_type !== "OTHER"
              ? (item.product.adapted_license_type as any)
              : undefined,
          fulfillment_type: item.product.fulfillment_type as BookstoreFulfillmentType,
          is_excerpt: Boolean(item.product.is_excerpt),
          is_partial_product: Boolean(item.product.is_partial_product),
        });
      }

      const checkoutLicenseLines = validated.items.flatMap((item) => {
        if (item.product.license_type === "OTHER") return [];
        return [
          {
            title: item.product.title,
            license: item.product.license_type as any,
            priceCents: item.unit_price_cents,
            attributionHtml: item.product.attribution_html,
            isAdapted: item.product.is_adapted,
            adaptedLicense:
              item.product.adapted_license_type && item.product.adapted_license_type !== "OTHER"
                ? (item.product.adapted_license_type as any)
                : null,
            isExcerpt: Boolean(item.product.is_excerpt),
            isPartialProduct: Boolean(item.product.is_partial_product),
          },
        ];
      });
      validateCheckoutLicensing(checkoutLicenseLines);

      const total = validated.subtotal_cents;
      const freeCheckout = total <= 0;

      const initialOrder = await createBookstoreOrder(request.user.sub, {
        items: validated.items,
        address_json: parsed.address,
        notes_json: parsed.notes,
        status: freeCheckout ? "paid" : "awaiting_payment",
        payment_status: freeCheckout ? "not_required" : "pending",
        fulfillment_status: freeCheckout ? "ready" : "pending",
        shipping_cents: 0,
        tax_cents: 0,
        payment_provider: freeCheckout ? null : config.bookstorePaymentProvider,
      });

      if (freeCheckout) {
        reply.code(201).send({
          order: initialOrder.order,
          items: initialOrder.items,
          payment: null,
          message: "Free checkout completed.",
        });
        return;
      }

      if (config.bookstorePaymentProvider === "payfast" && payfastEnabled()) {
        const baseCandidate =
          config.bookstorePublicBaseUrl.trim() ||
          config.corsOrigin.split(",")[0]?.trim() ||
          "https://saedu-api.vercel.app";
        const webBase = baseCandidate.replace(/\/+$/, "");
        const checkoutUrl = createPayFastBookstoreCheckoutUrl({
          orderId: initialOrder.order.id,
          userId: request.user.sub,
          amountZar: initialOrder.order.total_cents / 100,
          itemNames: validated.items.map((item) => item.product.title),
          returnUrl: `${webBase}/checkout?provider=payfast&orderId=${encodeURIComponent(initialOrder.order.id)}`,
          cancelUrl: `${webBase}/checkout?provider=payfast&orderId=${encodeURIComponent(initialOrder.order.id)}&canceled=1`,
          notifyUrl: `${webBase}/api/bookstore/webhooks/payfast`,
        });
        const payfastOrder = await updateBookstoreOrderPayment(initialOrder.order.id, {
          payment_intent_id: initialOrder.order.id,
          status: "awaiting_payment",
          payment_status: "pending",
        });
        reply.code(201).send({
          order: payfastOrder ?? initialOrder.order,
          items: initialOrder.items,
          payment: {
            provider: "payfast",
            paymentIntentId: initialOrder.order.id,
            clientSecret: null,
            amountCents: initialOrder.order.total_cents,
            currency: initialOrder.order.currency,
            status: "requires_action",
            checkoutUrl,
            checkoutSessionId: initialOrder.order.id,
            providerMetadata: {
              merchantId: config.payfastMerchantId,
              sandbox: Boolean(config.payfastSandbox),
            },
          },
          message: "Order created. Complete payment on PayFast to unlock downloads.",
        });
        return;
      }

      if (config.paidCheckoutBlocked) {
        reply.code(503).send({
          error:
            "Bookstore checkout is unavailable: no payment provider is configured. Set BOOKSTORE_PAYMENT_PROVIDER=payfast with PAYFAST_MERCHANT_ID, PAYFAST_MERCHANT_KEY and PAYFAST_PASSPHRASE.",
        });
        return;
      }

      const paymentIntent = await createPaymentIntent({
        orderId: initialOrder.order.id,
        amountCents: initialOrder.order.total_cents,
        currency: initialOrder.order.currency,
        metadata: { userId: request.user.sub },
        lineItems: validated.items.map((item) => ({
          name: item.product.title,
          quantity: item.quantity,
          unitAmountCents: item.unit_price_cents,
          description: `${item.product.phase} | ${item.product.subjects.slice(0, 3).join(", ")}`,
        })),
      });
      const updatedOrder = await updateBookstoreOrderPayment(initialOrder.order.id, {
        payment_intent_id: paymentIntent.paymentIntentId,
        status: "awaiting_payment",
        payment_status: "pending",
      });

      reply.code(201).send({
        order: updatedOrder ?? initialOrder.order,
        items: initialOrder.items,
        payment: paymentIntent,
        message: "Order created. Complete payment to unlock downloads.",
      });
    } catch (error) {
      handleRouteError(reply, error, "Checkout failed.");
    }
  });

  app.get("/checkout/confirm", { preHandler: requireAuth }, async (request, reply) => {
    try {
      const parsed = checkoutConfirmQuerySchema.parse(request.query ?? {});
      const order = await getBookstoreOrderForUser(parsed.orderId, request.user.sub);
      if (!order) {
        reply.code(404).send({ error: "Order not found" });
        return;
      }

      if (parsed.provider === "stripe") {
        if (!parsed.sessionId) {
          reply.code(400).send({ error: "Missing sessionId" });
          return;
        }
        const session = await fetchStripeCheckoutSession(parsed.sessionId);
        const sessionOrderId =
          session.metadata?.orderId ||
          session.metadata?.order_id ||
          (typeof (session as any).client_reference_id === "string"
            ? (session as any).client_reference_id
            : null);

        if (sessionOrderId && sessionOrderId !== parsed.orderId) {
          reply.code(400).send({ error: "Payment session does not match order." });
          return;
        }

        const paid = session.payment_status === "paid";
        if (paid) {
          await updateBookstoreOrderPayment(parsed.orderId, {
            payment_intent_id:
              (typeof (session as any).payment_intent === "string"
                ? (session as any).payment_intent
                : order.order.payment_intent_id) ?? parsed.sessionId,
            status: "paid",
            payment_status: "paid",
            fulfillment_status: "ready",
          });
        }
        const refreshed = await getBookstoreOrderForUser(parsed.orderId, request.user.sub);
        reply.send({
          provider: "stripe",
          payment: {
            sessionId: parsed.sessionId,
            status: session.status,
            paymentStatus: session.payment_status,
            paid,
          },
          ...(refreshed ?? order),
        });
        return;
      }

      if (parsed.provider === "payfast") {
        const refreshed = await getBookstoreOrderForUser(parsed.orderId, request.user.sub);
        const paid = refreshed?.order.payment_status === "paid";
        reply.send({
          provider: "payfast",
          payment: {
            status: refreshed?.order.status,
            paymentStatus: refreshed?.order.payment_status,
            paid,
          },
          ...(refreshed ?? order),
        });
        return;
      }

      reply.code(400).send({ error: "Unsupported provider" });
    } catch (error) {
      handleRouteError(reply, error, "Unable to confirm checkout.");
    }
  });

  app.post("/bookstore/webhooks/payfast", async (request, reply) => {
    const sourceIp =
      String(request.headers["x-forwarded-for"] || "").split(",")[0]?.trim() ||
      String((request.socket as { remoteAddress?: string }).remoteAddress || "");

    const body = (request.body ?? {}) as PayFastItnPayload;
    const { valid, reason } = await verifyPayFastItn(body, sourceIp);
    if (!valid) {
      app.log.warn({ reason, sourceIp }, "Bookstore PayFast ITN rejected");
      reply.code(400).send({ error: "Invalid PayFast ITN", reason });
      return;
    }

    const orderId = body.m_payment_id?.trim();
    if (!orderId) {
      reply.send({ ok: true, provider: "payfast", handled: false, message: "Missing m_payment_id" });
      return;
    }

    const pfPaymentId = body.pf_payment_id?.trim() || null;
    const eventId = pfPaymentId || orderId;
    const marked = await markWebhookEventProcessed("payfast", eventId);
    if (!marked) {
      reply.send({ ok: true, duplicate: true, provider: "payfast", eventId });
      return;
    }

    const paid = body.payment_status?.toUpperCase() === "COMPLETE";
    if (!paid) {
      await updateBookstoreOrderPayment(orderId, { status: "failed", payment_status: "failed" });
      reply.send({ ok: true, provider: "payfast", eventId, handled: false, message: "Payment not complete" });
      return;
    }

    const order = await getBookstoreOrderForAdmin(orderId);
    if (!order) {
      reply.code(404).send({ error: "Order not found" });
      return;
    }

    if (body.custom_str1 && body.custom_str1 !== order.order.user_id) {
      app.log.warn({ orderId, userId: order.order.user_id, custom: body.custom_str1 }, "Bookstore PayFast ITN user mismatch");
      reply.code(400).send({ error: "PayFast ITN user mismatch" });
      return;
    }

    const expectedZar = (order.order.total_cents / 100).toFixed(2);
    const paidZar = Number(body.amount_gross ?? "0").toFixed(2);
    if (paidZar !== expectedZar) {
      app.log.warn({ orderId, expectedZar, paidZar }, "Bookstore PayFast ITN amount mismatch");
      reply.code(400).send({ error: "PayFast ITN amount mismatch" });
      return;
    }

    await updateBookstoreOrderPayment(orderId, {
      payment_intent_id: pfPaymentId ?? orderId,
      status: "paid",
      payment_status: "paid",
      fulfillment_status: "ready",
    });

    reply.send({ ok: true, provider: "payfast", eventId, handled: true, orderId });
  });

  app.get("/orders", { preHandler: requireAuth }, async (request, reply) => {
    try {
      const orders = await listBookstoreOrdersForUser(request.user.sub);
      reply.send({
        orders: orders.map((entry) => ({
          order: entry.order,
          items: entry.items,
        })),
      });
    } catch (error) {
      handleRouteError(reply, error, "Unable to load orders.");
    }
  });

  app.get("/download/:token", async (request, reply) => {
    const params = downloadTokenParamsSchema.safeParse(request.params);
    if (!params.success) {
      reply.code(400).send({ error: "Invalid download token", details: params.error.flatten() });
      return;
    }

    try {
      const consumed = await consumeBookstoreDownloadToken(params.data.token);
      if (!consumed) {
        const existing = await getBookstoreDownloadToken(params.data.token);
        if (existing) {
          reply.code(403).send({ error: "Download token expired or has reached its usage limit." });
          return;
        }
        reply.code(404).send({ error: "Download token not found." });
        return;
      }

      const order = await getBookstoreOrderForAdmin(consumed.order_id);
      if (!order) {
        reply.code(404).send({ error: "Order not found." });
        return;
      }
      if (order.order.status !== "paid" && order.order.status !== "fulfilled") {
        reply.code(403).send({ error: "Payment not completed for this order." });
        return;
      }

      const item = order.items.find((row) => row.product_id === consumed.product_id);
      if (!item) {
        reply.code(404).send({ error: "Product not found in order." });
        return;
      }

      const product = await getBookstoreProductByIdOrSlug(consumed.product_id);
      if (!product) {
        reply.code(404).send({ error: "Product no longer available." });
        return;
      }

      await recordBookstoreDownloadEvent({
        orderId: order.order.id,
        productId: product.id,
        userId: consumed.user_id,
        metadata: {
          mode: "db-token",
          downloadTokenId: consumed.id,
          usedCount: consumed.used_count,
          maxUses: consumed.max_uses,
        },
      });

      if (product.fulfillment_type === "LINK_ONLY" && product.external_download_url) {
        reply.redirect(product.external_download_url);
        return;
      }

      if (product.storage_key) {
        reply.send({
          download_url: `/api/files/${encodeURIComponent(product.storage_key)}?download=1`,
          expires_at: new Date(consumed.expires_at).toISOString(),
          token_mode: "database",
        });
        return;
      }

      if (product.external_download_url) {
        reply.send({
          download_url: product.external_download_url,
          expires_at: new Date(consumed.expires_at).toISOString(),
          token_mode: "database",
        });
        return;
      }

      reply.code(404).send({ error: "No downloadable asset configured for this product." });
    } catch (error) {
      handleRouteError(reply, error, "Unable to serve tokenized download.");
    }
  });

  app.get("/download/:orderId/:productId", async (request, reply) => {
    const params = downloadParamsSchema.safeParse(request.params);
    if (!params.success) {
      reply.code(400).send({ error: "Invalid download link", details: params.error.flatten() });
      return;
    }

    const token = (request.query as { token?: string } | undefined)?.token;
    const { orderId, productId } = params.data;

    try {
      if (orderId === "public") {
        const product = await getBookstoreProductByIdOrSlug(productId);
        if (!product || !product.is_active) {
          reply.code(404).send({ error: "Product not found" });
          return;
        }
        if (!product.is_free) {
          reply.code(403).send({ error: "Order required for paid products" });
          return;
        }
        if (product.fulfillment_type !== "LINK_ONLY" || !product.external_download_url) {
          reply.code(400).send({ error: "This product is not available as a direct public download." });
          return;
        }
        await recordBookstoreDownloadEvent({
          orderId: null,
          productId: product.id,
          userId: null,
          metadata: { mode: "public-link" },
        });
        reply.redirect(product.external_download_url);
        return;
      }

      await requireAuth(request, reply);
      if (reply.sent) return;

      const order = await getBookstoreOrderForUser(orderId, request.user.sub);
      if (!order) {
        reply.code(404).send({ error: "Order not found" });
        return;
      }

      const item = order.items.find((row) => row.product_id === productId);
      if (!item) {
        reply.code(404).send({ error: "Product not found in order" });
        return;
      }
      const product = await getBookstoreProductByIdOrSlug(productId);
      if (!product) {
        reply.code(404).send({ error: "Product no longer available" });
        return;
      }

      if (order.order.status !== "paid" && order.order.status !== "fulfilled") {
        reply.code(403).send({ error: "Payment not completed for this order." });
        return;
      }

      if (product.fulfillment_type === "LINK_ONLY" && product.external_download_url) {
        await recordBookstoreDownloadEvent({
          orderId: order.order.id,
          productId: product.id,
          userId: request.user.sub,
          metadata: { mode: "ordered-link" },
        });
        reply.redirect(product.external_download_url);
        return;
      }

      if (!token) {
        const issuedToken = `bkt_${randomUUID().replace(/-/g, "")}`;
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
        await createBookstoreDownloadToken({
          orderId,
          productId,
          token: issuedToken,
          userId: request.user.sub,
          expiresAt,
          maxUses: 1,
        });
        reply.send({
          download_url: `/download/${encodeURIComponent(issuedToken)}`,
          expires_at: expiresAt.toISOString(),
          mode: "token",
          token_storage: "database",
        });
        return;
      }

      if (!verifyDownloadToken(token, { orderId, productId, userId: request.user.sub })) {
        reply.code(403).send({ error: "Invalid or expired download token" });
        return;
      }

      await recordBookstoreDownloadEvent({
        orderId: order.order.id,
        productId: product.id,
        userId: request.user.sub,
        metadata: { mode: "token", tokenHash: createHash("sha1").update(token).digest("hex") },
      });

      if (product.storage_key) {
        reply.send({
          download_url: `/api/files/${encodeURIComponent(product.storage_key)}`,
          expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
          note: "Storage provider signing is not configured yet. This endpoint returns a short-lived protected reference.",
        });
        return;
      }

      if (product.external_download_url) {
        reply.send({
          download_url: product.external_download_url,
          expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        });
        return;
      }

      reply.code(404).send({ error: "No downloadable asset configured for this product." });
    } catch (error) {
      handleRouteError(reply, error, "Unable to serve download.");
    }
  });

  app.get("/admin/bookstore/products", { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const parsed = listProductsQuerySchema.parse(request.query ?? {});
      const result = await listBookstoreProducts({
        phase: parsed.phase,
        grade: parsed.grade,
        subject: parsed.subject,
        format: parsed.format,
        priceType: parsed.priceType ?? "all",
        licenseTypes: normalizeLicenseFilters(parsed.license),
        q: parsed.q,
        page: parsed.page,
        pageSize: parsed.pageSize ?? 100,
      });
      const orders = await listBookstoreOrdersForAdmin(100);
      const ingestJobs = await listBookstoreIngestJobs(20);
      reply.send({
        products: result.products.map(mapProductForClient),
        pagination: result.pagination,
        orders,
        ingestJobs,
      });
    } catch (error) {
      handleRouteError(reply, error, "Unable to load admin bookstore data.");
    }
  });

  app.post("/admin/bookstore/products", { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const parsed = adminProductSchema.parse(request.body ?? {});
      if (parsed.grade_min > parsed.grade_max) {
        reply.code(400).send({ error: "grade_min cannot be greater than grade_max." });
        return;
      }
      const candidateAdaptedLicense =
        parsed.adapted_license_type ||
        (parsed.is_adapted && parsed.license_type.includes("_SA") && parsed.license_type !== "OTHER"
          ? parsed.license_type
          : undefined);
      const adaptedLicenseForValidation =
        candidateAdaptedLicense && candidateAdaptedLicense !== "OTHER" ? candidateAdaptedLicense : undefined;

      const licenseCheck = validateLicensingRules({
        license_type: parsed.license_type,
        price_cents: parsed.price_cents,
        is_adapted: parsed.is_adapted,
        adapted_license_type: adaptedLicenseForValidation,
        fulfillment_type: parsed.fulfillment_type,
        storage_key: parsed.storage_key,
        file_type: parsed.file_type,
        checksum: parsed.checksum,
        source_url: parsed.source_url,
        is_excerpt: parsed.is_excerpt,
        is_partial_product: parsed.is_partial_product,
      });

      const product = await upsertBookstoreProduct(mapAdminProductInput(parsed));
      reply.code(parsed.id ? 200 : 201).send({
        product: product ? mapProductForClient(product) : null,
        warnings: licenseCheck.warnings,
        notes: licenseCheck.notes,
      });
    } catch (error) {
      handleRouteError(reply, error, "Unable to save bookstore product.");
    }
  });

  app.get("/admin/bookstore/orders", { preHandler: requireAdmin }, async (_request, reply) => {
    try {
      const orders = await listBookstoreOrdersForAdmin(200);
      reply.send({ orders });
    } catch (error) {
      handleRouteError(reply, error, "Unable to load bookstore orders.");
    }
  });

  app.post("/admin/bookstore/orders/:id/status", { preHandler: requireAdmin }, async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
    if (!params.success) {
      reply.code(400).send({ error: "Invalid order id", details: params.error.flatten() });
      return;
    }
    try {
      const parsed = adminOrderStatusSchema.parse(request.body ?? {});
      const order = await updateBookstoreOrderStatus(params.data.id, parsed.status);
      if (!order) {
        reply.code(404).send({ error: "Order not found" });
        return;
      }
      reply.send({ order });
    } catch (error) {
      handleRouteError(reply, error, "Unable to update order status.");
    }
  });

  app.post("/admin/bookstore/pod/recommend-price", { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const parsed = podPricingRequestSchema.parse(request.body ?? {});
      const targetMarginRate =
        parsed.targetMarginRate ?? defaultTargetMarginRate(parsed.productKind);
      const breakdown = recommendPodRetailPrice({
        printCostCents: parsed.printCostCents,
        shippingCostCents: parsed.shippingCostCents,
        fixedFeesCents: parsed.fixedFeesCents,
        paymentFeeRate: parsed.paymentFeeRate,
        riskBufferRate: parsed.riskBufferRate,
        targetMarginRate,
        vatRate: parsed.vatRate,
        vatInclusive: parsed.vatInclusive,
        roundingStepCents: parsed.roundingStepCents,
      });
      reply.send({
        ok: true,
        productKind: parsed.productKind,
        targetMarginRate,
        input: parsed,
        breakdown,
        recommendedPriceCents: parsed.vatInclusive
          ? breakdown.roundedRecommendedCentsIncVat
          : breakdown.roundedRecommendedCentsExVat,
        vatDisplayMode: parsed.vatInclusive ? "inclusive" : "exclusive",
      });
    } catch (error) {
      handleRouteError(reply, error, "Unable to calculate POD price.");
    }
  });

  const adminOerIngestHandler = async (request: any, reply: any) => {
    try {
      const ingestOptions = adminOerIngestRequestSchema.parse(request.body ?? {});
      const result = await importCuratedOerSeed({
        seedFormat: ingestOptions.seedFormat,
        createdBy: request.user.sub,
        recordJob: true,
      });
      reply.send(result);
    } catch (error) {
      handleRouteError(reply, error, "OER ingestion failed.");
    }
  };

  app.post("/admin/bookstore/ingest/oer", { preHandler: requireAdmin }, adminOerIngestHandler);
  app.post("/admin/oer/ingest", { preHandler: requireAdmin }, adminOerIngestHandler);

  app.post("/admin/bookstore/suppliers/sync", { preHandler: requireAdmin }, async (request, reply) => {
    try {
      const parsed = supplierSyncSchema.parse(request.body ?? {});
      const startedAt = new Date();
      const job = await createBookstoreIngestJob({
        jobType: "supplier_sync_stub",
        source: parsed.provider,
        status: "completed",
        result: {
          provider: parsed.provider,
          synced: 0,
          stub: true,
          message: "Supplier sync is stubbed. Integrate wholesaler feed/API here.",
        },
        createdBy: request.user.sub,
      });
      const supplierJob = await createBookstoreSupplierImportJob({
        supplierType: parsed.provider,
        importFormat: "MANUAL",
        status: "completed",
        sourceRef: `${parsed.provider}:stub`,
        result: { synced: 0, stub: true },
        createdBy: request.user.sub,
        startedAt,
        finishedAt: new Date(),
      });
      reply.send({
        ok: true,
        provider: parsed.provider,
        stub: true,
        job,
        supplierImportJob: supplierJob,
        message: "Supplier sync stub executed. Implement reseller feed integration when provider API is available.",
      });
    } catch (error) {
      handleRouteError(reply, error, "Supplier sync failed.");
    }
  });

  app.get("/admin/bookstore/orders/:id", { preHandler: requireAdmin }, async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).safeParse(request.params);
    if (!params.success) {
      reply.code(400).send({ error: "Invalid order id", details: params.error.flatten() });
      return;
    }
    try {
      const order = await getBookstoreOrderForAdmin(params.data.id);
      if (!order) {
        reply.code(404).send({ error: "Order not found" });
        return;
      }
      reply.send(order);
    } catch (error) {
      handleRouteError(reply, error, "Unable to load order.");
    }
  });
}
