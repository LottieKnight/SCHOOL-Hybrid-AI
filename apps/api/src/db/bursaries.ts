import { pool } from "./pool.js";

export type BursaryRecord = {
  id: string;
  title: string;
  provider: string;
  provider_type: string;
  seta_name: string | null;
  fields_of_study: string[];
  year_levels: string[];
  needs_based: boolean;
  merit_based: boolean;
  amount_min: number | null;
  amount_max: number | null;
  deadline: string | null;
  description: string | null;
  requirements: string[];
  link: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type BursaryMatchRecord = BursaryRecord & { match_score: number };

export type MatchBursariesParams = {
  // All three ranking inputs are optional: omit them (or pass "") to mean "any".
  // matchBursaries normalizes undefined → "" / false internally.
  fieldOfStudy?: string;
  yearOfStudy?: string;
  needsFinancialAid?: boolean;
  limit: number;
  offset: number;
  providerType?: string;
  needsOnly?: boolean;
  sortBy?: "match" | "deadline";
};

export type BursaryInput = {
  title: string;
  provider: string;
  provider_type: string;
  seta_name: string | null;
  fields_of_study: string[];
  year_levels: string[];
  needs_based: boolean;
  merit_based: boolean;
  amount_min: number | null;
  amount_max: number | null;
  deadline: string | null;
  description: string | null;
  requirements: string[];
  link: string;
  is_active: boolean;
};

export async function matchBursaries(params: MatchBursariesParams): Promise<{ bursaries: BursaryMatchRecord[]; total: number }> {
  const { limit, offset, providerType, needsOnly, sortBy = "match" } = params;

  // Normalize the optional ranking inputs so callers may pass undefined or "".
  const field = (params.fieldOfStudy ?? "").trim();
  const year = (params.yearOfStudy ?? "").trim();
  const needs = params.needsFinancialAid ?? false;

  const hasField = field !== "";
  const hasYear = year !== "";

  // Filters are all OPTIONAL: an empty field/year means "any", so we simply omit
  // that condition (passing "" used to exclude every field-specific bursary).
  // Ranking — not filtering — surfaces the best matches. needs-based bursaries
  // stay visible to everyone; `needsFinancialAid` only boosts their rank, and
  // `needsOnly` is the explicit "needs-based only" filter.
  const conditions: string[] = [
    "b.is_active = true",
    "(b.deadline IS NULL OR b.deadline >= CURRENT_DATE)",
  ];
  const whereValues: unknown[] = [];

  if (hasField) {
    whereValues.push(field);
    conditions.push(`(b.fields_of_study = '{}' OR b.fields_of_study && ARRAY[$${whereValues.length}::text])`);
  }
  if (hasYear) {
    whereValues.push(year);
    conditions.push(`(b.year_levels = '{}' OR b.year_levels && ARRAY[$${whereValues.length}::text])`);
  }
  if (providerType) {
    whereValues.push(providerType);
    conditions.push(`b.provider_type = $${whereValues.length}`);
  }
  if (needsOnly) {
    conditions.push("b.needs_based = true");
  }

  const whereClause = conditions.join(" AND ");

  // The data query reuses the same WHERE params, then appends the scoring inputs
  // and pagination. The count query uses ONLY the WHERE params, so the two never
  // disagree on parameter arity (which would be a bind error).
  const dataValues = [...whereValues];
  dataValues.push(field);
  const fieldIdx = dataValues.length;
  dataValues.push(year);
  const yearIdx = dataValues.length;
  dataValues.push(needs);
  const needsIdx = dataValues.length;
  dataValues.push(limit);
  const limitIdx = dataValues.length;
  dataValues.push(offset);
  const offsetIdx = dataValues.length;

  // A SPECIFIC field/year overlap outranks an "open to all" ('{}') bursary, so a
  // precisely-targeted match sorts above a field-agnostic one. Both still beat a
  // non-match, and both still pass the WHERE filter above. Max score 6 = field(3)
  // + year(2) + needs(1).
  const scoreExpr = `(
    CASE
      WHEN $${fieldIdx}::text <> '' AND b.fields_of_study && ARRAY[$${fieldIdx}::text] THEN 3
      WHEN $${fieldIdx}::text <> '' AND b.fields_of_study = '{}' THEN 1
      ELSE 0
    END
    + CASE
      WHEN $${yearIdx}::text <> '' AND b.year_levels && ARRAY[$${yearIdx}::text] THEN 2
      WHEN $${yearIdx}::text <> '' AND b.year_levels = '{}' THEN 1
      ELSE 0
    END
    + CASE WHEN $${needsIdx}::boolean = true AND b.needs_based = true THEN 1 ELSE 0 END
  )`;

  const orderClause = sortBy === "deadline"
    ? "b.deadline ASC NULLS LAST, match_score DESC"
    : "match_score DESC, b.deadline ASC NULLS LAST";

  // `to_char(...) AS deadline` re-projects the `date` column as a plain
  // 'YYYY-MM-DD' string. Without it, node-postgres returns a JS Date for OID 1082
  // and Fastify serializes it to a full ISO timestamp (with a TZ shift) that the
  // date-only frontend can't parse. The later same-named column wins in the row.
  const query = `
    SELECT b.*, to_char(b.deadline, 'YYYY-MM-DD') AS deadline, ${scoreExpr} AS match_score
    FROM bursaries b
    WHERE ${whereClause}
    ORDER BY ${orderClause}
    LIMIT $${limitIdx} OFFSET $${offsetIdx}
  `;

  const [countResult, dataResult] = await Promise.all([
    pool.query(`SELECT COUNT(*) AS total FROM bursaries b WHERE ${whereClause}`, whereValues),
    pool.query(query, dataValues),
  ]);

  const countRow = countResult.rows[0] as { total: string } | undefined;

  return {
    bursaries: (dataResult.rows as Array<BursaryRecord & { match_score: string | number }>).map(
      (row) => ({ ...row, match_score: Number(row.match_score) })
    ),
    total: countRow ? parseInt(countRow.total, 10) : 0,
  };
}

export type BursaryFacets = {
  total: number;
  providerTypes: Array<{ provider_type: string; count: number }>;
};

/**
 * Aggregate counts for the public finder's filters. Mirrors the visibility rules
 * in matchBursaries (active and not past its deadline) so the chips never offer a
 * filter that would return zero live results.
 */
export async function getBursaryFacets(): Promise<BursaryFacets> {
  const visible = "is_active = true AND (deadline IS NULL OR deadline >= CURRENT_DATE)";

  const [totalResult, providerResult] = await Promise.all([
    pool.query(`SELECT COUNT(*)::int AS total FROM bursaries WHERE ${visible}`),
    pool.query(
      `SELECT provider_type, COUNT(*)::int AS count
       FROM bursaries
       WHERE ${visible}
       GROUP BY provider_type
       ORDER BY count DESC, provider_type ASC`
    ),
  ]);

  const totalRow = totalResult.rows[0] as { total: number } | undefined;

  return {
    total: totalRow ? totalRow.total : 0,
    providerTypes: providerResult.rows as Array<{ provider_type: string; count: number }>,
  };
}

export async function listAdminBursaries(params: {
  page: number;
  limit: number;
  active?: boolean;
  search?: string;
}): Promise<{ bursaries: BursaryRecord[]; total: number; active: number; inactive: number; deadlines_this_month: number }> {
  const { page, limit, active, search } = params;
  const offset = (page - 1) * limit;
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (active !== undefined) {
    values.push(active);
    conditions.push(`is_active = $${values.length}`);
  }
  if (search) {
    values.push(`%${search.toLowerCase()}%`);
    conditions.push(`(LOWER(title) LIKE $${values.length} OR LOWER(provider) LIKE $${values.length})`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  values.push(limit, offset);

  const [dataResult, statsResult] = await Promise.all([
    pool.query(
      `SELECT * FROM bursaries ${where} ORDER BY created_at DESC LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values
    ),
    pool.query(`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE is_active = true) AS active,
        COUNT(*) FILTER (WHERE is_active = false) AS inactive,
        COUNT(*) FILTER (WHERE deadline >= date_trunc('month', CURRENT_DATE) AND deadline < date_trunc('month', CURRENT_DATE) + interval '1 month' AND is_active = true) AS deadlines_this_month
      FROM bursaries
    `),
  ]);

  const stats = statsResult.rows[0] as { total: string; active: string; inactive: string; deadlines_this_month: string };

  return {
    bursaries: dataResult.rows as BursaryRecord[],
    total: parseInt(stats.total, 10),
    active: parseInt(stats.active, 10),
    inactive: parseInt(stats.inactive, 10),
    deadlines_this_month: parseInt(stats.deadlines_this_month, 10),
  };
}

export async function getBursaryById(id: string): Promise<BursaryRecord | null> {
  const result = await pool.query("SELECT * FROM bursaries WHERE id = $1", [id]);
  return (result.rows[0] as BursaryRecord) ?? null;
}

export async function createBursary(input: BursaryInput): Promise<BursaryRecord> {
  const result = await pool.query(
    `INSERT INTO bursaries
      (title, provider, provider_type, seta_name, fields_of_study, year_levels,
       needs_based, merit_based, amount_min, amount_max, deadline, description,
       requirements, link, is_active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     RETURNING *`,
    [
      input.title, input.provider, input.provider_type, input.seta_name,
      input.fields_of_study, input.year_levels, input.needs_based, input.merit_based,
      input.amount_min, input.amount_max, input.deadline, input.description,
      input.requirements, input.link, input.is_active,
    ]
  );
  if (!result.rows[0]) throw new Error("createBursary did not return a row");
  return result.rows[0] as BursaryRecord;
}

export async function updateBursary(id: string, patch: Partial<BursaryInput>): Promise<BursaryRecord | null> {
  const sets: string[] = [];
  const values: unknown[] = [];

  const allowed: (keyof BursaryInput)[] = [
    "title", "provider", "provider_type", "seta_name", "fields_of_study",
    "year_levels", "needs_based", "merit_based", "amount_min", "amount_max",
    "deadline", "description", "requirements", "link", "is_active",
  ];

  for (const key of allowed) {
    if (key in patch) {
      values.push(patch[key]);
      sets.push(`${key} = $${values.length}`);
    }
  }

  if (sets.length === 0) return getBursaryById(id);

  sets.push(`updated_at = now()`);
  values.push(id);

  const result = await pool.query(
    `UPDATE bursaries SET ${sets.join(", ")} WHERE id = $${values.length} RETURNING *`,
    values
  );
  return (result.rows[0] as BursaryRecord) ?? null;
}

export async function softDeleteBursary(id: string): Promise<BursaryRecord | null> {
  const result = await pool.query(
    "UPDATE bursaries SET is_active = false, updated_at = now() WHERE id = $1 RETURNING *",
    [id]
  );
  return (result.rows[0] as BursaryRecord) ?? null;
}

export async function hardDeleteBursary(id: string): Promise<boolean> {
  const result = await pool.query("DELETE FROM bursaries WHERE id = $1 RETURNING id", [id]);
  return result.rows.length > 0;
}
