import "server-only";

import type {
  BookstoreCatalogFilters,
  BookstoreCatalogResponse,
  BookstoreProduct,
  InstitutionResourceCatalogResponse,
} from "@/lib/bookstore";
import { rankResourceProductsWithMemory } from "@/lib/memory";
import { queryPlannerDb } from "@/lib/server/plannerDb";

export type ResourceLibraryScope = "institution" | "universal" | "all";

type ResourceLibraryQueryInput = BookstoreCatalogFilters & {
  institutionScope?: ResourceLibraryScope;
  institutionId?: string | null;
  userId?: string | null;
  activeModule?: string | null;
  currentModules?: string[];
};

type ResourceProductRow = BookstoreProduct & {
  institution_id?: string | null;
  institution_name?: string | null;
};

function normalizeScope(value: string | null | undefined): ResourceLibraryScope {
  return value === "institution" || value === "universal" || value === "all" ? value : "all";
}

async function tableExists(tableName: string) {
  const result = await queryPlannerDb<{ regclass: string | null }>(`SELECT to_regclass($1) AS regclass`, [tableName]);
  return Boolean(result.rows[0]?.regclass);
}

async function columnExists(tableName: string, columnName: string) {
  const result = await queryPlannerDb<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = $1
          AND column_name = $2
      ) AS exists
    `,
    [tableName, columnName]
  );
  return Boolean(result.rows[0]?.exists);
}

function coercePositiveInt(value: number | string | undefined, fallback: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function deriveImplicitConcepts(product: ResourceProductRow) {
  const existing = Array.isArray(product.concepts)
    ? product.concepts.map((value) => value.trim()).filter(Boolean)
    : [];
  const derived = new Set(existing);
  const haystack = normalizeText(
    [
      product.title,
      product.description,
      ...(product.subjects || []),
      ...(product.tags || []),
      typeof product.metadata_json?.moduleCode === "string" ? product.metadata_json.moduleCode : "",
    ]
      .filter(Boolean)
      .join(" ")
  );

  const keywordMap: Array<[string, string]> = [
    ["inflation", "inflation"],
    ["demand", "demand"],
    ["supply", "supply"],
    ["elasticity", "price-elasticity-demand"],
    ["equilibrium", "market-equilibrium"],
    ["opportunity cost", "opportunity-cost"],
    ["macroeconomics", "aggregate-demand"],
    ["gdp", "gross-domestic-product"],
    ["cash flow", "cash-flow-statement"],
    ["financial statements", "financial-statements"],
    ["ratio analysis", "ratio-analysis"],
    ["budget", "budgeting"],
    ["depreciation", "depreciation"],
    ["working capital", "working-capital-management"],
  ];

  for (const [token, conceptKey] of keywordMap) {
    if (haystack.includes(token)) {
      derived.add(conceptKey);
    }
  }

  return Array.from(derived);
}

export async function getInstitutionResourceLibrary(
  input: ResourceLibraryQueryInput = {}
): Promise<InstitutionResourceCatalogResponse> {
  const emptyResult: InstitutionResourceCatalogResponse = {
    products: [],
    pagination: {
      page: 1,
      pageSize: 24,
      total: 0,
      totalPages: 0,
    },
    sections: [],
  };

  try {
    const hasProductsTable = await tableExists("public.bookstore_products");
    if (!hasProductsTable) {
      return emptyResult;
    }

    const hasInstitutionColumn = await columnExists("bookstore_products", "institution_id");
    const hasInstitutionsTable = await tableExists("public.institutions");
    const page = coercePositiveInt(input.page, 1);
    const pageSize = Math.min(48, coercePositiveInt(input.pageSize, 24));
    const offset = (page - 1) * pageSize;
    const scope = normalizeScope(input.institutionScope);
    const values: unknown[] = [];
    const where: string[] = ["p.is_active = TRUE"];

    if (input.phase) {
      values.push(input.phase);
      where.push(`p.phase = $${values.length}`);
    }

    if (typeof input.grade === "number") {
      values.push(input.grade);
      const gradeIndex = values.length;
      where.push(`p.grade_min <= $${gradeIndex} AND p.grade_max >= $${gradeIndex}`);
    }

    if (input.subject) {
      values.push(`%${input.subject.trim()}%`);
      const subjectIndex = values.length;
      where.push(`EXISTS (SELECT 1 FROM unnest(p.subjects) AS subject WHERE subject ILIKE $${subjectIndex})`);
    }

    if (input.format) {
      values.push(input.format);
      where.push(`p.format = $${values.length}`);
    }

    if (input.priceType === "free") {
      where.push(`p.is_free = TRUE`);
    } else if (input.priceType === "paid") {
      where.push(`p.is_free = FALSE`);
    }

    if (input.license) {
      values.push(input.license);
      where.push(`p.license_type = $${values.length}`);
    }

    if (input.commercialAllowedOnly) {
      where.push(`p.nc_noncommercial = FALSE`);
    }

    if (input.q) {
      values.push(`%${input.q.trim()}%`);
      const queryIndex = values.length;
      where.push(
        `(p.title ILIKE $${queryIndex} OR p.description ILIKE $${queryIndex} OR EXISTS (SELECT 1 FROM unnest(p.subjects) AS subject WHERE subject ILIKE $${queryIndex}))`
      );
    }

    if (hasInstitutionColumn) {
      if (scope === "institution" && input.institutionId) {
        values.push(input.institutionId);
        where.push(`p.institution_id = $${values.length}`);
      } else if (scope === "universal") {
        where.push(`p.institution_id IS NULL`);
      }
    }

    const joinClause =
      hasInstitutionColumn && hasInstitutionsTable ? "LEFT JOIN institutions i ON i.id = p.institution_id" : "";
    const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

    const countResult = await queryPlannerDb<{ total: number }>(
      `
        SELECT COUNT(*)::int AS total
        FROM bookstore_products p
        ${joinClause}
        ${whereClause}
      `,
      values
    );
    const total = Number(countResult.rows[0]?.total ?? 0);

    values.push(pageSize, offset);
    const limitIndex = values.length - 1;
    const offsetIndex = values.length;

    const result = await queryPlannerDb<ResourceProductRow>(
      `
        SELECT
          p.*,
          ${hasInstitutionColumn ? "p.institution_id::text" : "NULL::text"} AS institution_id,
          ${hasInstitutionColumn && hasInstitutionsTable ? "i.name" : "NULL::text"} AS institution_name
        FROM bookstore_products p
        ${joinClause}
        ${whereClause}
        ORDER BY
          CASE WHEN ${hasInstitutionColumn ? "p.institution_id" : "NULL"} IS NULL THEN 1 ELSE 0 END,
          p.is_free DESC,
          p.updated_at DESC,
          p.title ASC
        LIMIT $${limitIndex}
        OFFSET $${offsetIndex}
      `,
      values
    );

    const normalizedProducts = result.rows.map((row) => ({
      ...row,
      concepts: deriveImplicitConcepts(row),
    }));

    if (input.userId) {
      const ranked = await rankResourceProductsWithMemory({
        products: normalizedProducts,
        userId: input.userId,
        activeModule: input.activeModule ?? null,
        currentModules: input.currentModules ?? [],
      });

      return {
        products: ranked.products,
        sections: ranked.sections,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
        },
      };
    }

    return {
      products: normalizedProducts,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
      },
    };
  } catch {
    return emptyResult;
  }
}
