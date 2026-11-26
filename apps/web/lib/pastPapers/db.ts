import "server-only";

import { initPastPapersEnv } from "@/lib/env";

type Scalar = string | number | null | boolean;
export type Row = Record<string, unknown>;

export type WhereValue =
  | Scalar
  | { not: Scalar }
  | { contains: string }
  | { gte: number | Date };

export type Where = Record<string, WhereValue>;

const DATE_COLUMNS = new Set([
  "createdAt",
  "updatedAt",
  "publishedAt",
  "lastSeenAt",
  "startedAt",
  "submittedAt",
  "markedAt",
  "plannerCompletedAt",
  "plannerSkippedAt",
]);

type TableMeta = {
  stamp: ("createdAt" | "updatedAt")[];
  defaults: Record<string, Scalar>;
};

const TABLES: Record<string, TableMeta> = {
  PastPaperSource: { stamp: ["createdAt", "updatedAt"], defaults: {} },
  PastPaper: { stamp: ["createdAt", "updatedAt"], defaults: {} },
  PastPaperQuestion: { stamp: ["createdAt", "updatedAt"], defaults: {} },
  PastPaperAttempt: {
    stamp: ["createdAt", "updatedAt"],
    defaults: { status: "in_progress" },
  },
  PastPaperAnswer: { stamp: ["createdAt", "updatedAt"], defaults: {} },
  PastPaperBookmark: { stamp: ["createdAt"], defaults: {} },
  LearningSession: {
    stamp: ["createdAt", "updatedAt"],
    defaults: { status: "completed" },
  },
  RevisionArtifact: {
    stamp: ["createdAt", "updatedAt"],
    defaults: { artifactType: "session_summary", status: "saved" },
  },
};

function tableMeta(table: string): TableMeta {
  return TABLES[table] ?? { stamp: [], defaults: {} };
}

function toMs(value: number | Date): number {
  return value instanceof Date ? value.getTime() : value;
}

function whereClause(table: string, where: Where) {
  const sql: string[] = [];
  const params: Scalar[] = [];
  for (const [key, value] of Object.entries(where)) {
    const col = `\`${key}\``;
    if (value !== null && typeof value === "object") {
      if ("not" in value) {
        if (value.not === null) {
          sql.push(`${col} IS NOT NULL`);
        } else {
          sql.push(`${col} != ?`);
          params.push(value.not as Scalar);
        }
      } else if ("contains" in value) {
        sql.push(`${col} LIKE ?`);
        params.push(`%${value.contains}%`);
      } else if ("gte" in value) {
        sql.push(`${col} >= ?`);
        params.push(toMs(value.gte as number | Date));
      } else {
        throw new Error(`Unsupported where operator on ${table}.${key}`);
      }
    } else {
      sql.push(`${col} = ?`);
      params.push(value as Scalar);
    }
  }
  return { clause: sql.join(" AND "), params };
}

function orderClause(orderBy?: Record<string, string> | Record<string, string>[]) {
  const list = Array.isArray(orderBy) ? orderBy : orderBy ? [orderBy] : [];
  if (list.length === 0) return "";
  return (
    " ORDER BY " +
    list
      .map((entry) => {
        const [[col, dir]] = Object.entries(entry);
        return `\`${col}\` ${dir === "desc" ? "DESC" : "ASC"}`;
      })
      .join(", ")
  );
}

function selectColumns(select?: string[]) {
  return select && select.length > 0 ? select.map((c) => `\`${c}\``).join(", ") : "*";
}

function hydrate(row: Row, columns?: string[]) {
  const source = columns ?? Object.keys(row);
  for (const col of source) {
    const v = row[col];
    if (DATE_COLUMNS.has(col) && typeof v === "number") {
      row[col] = new Date(v);
    }
  }
  return row;
}

type Backend = {
  all: (sql: string, params: Scalar[]) => Promise<Row[]>;
  run: (sql: string, params: Scalar[]) => Promise<number>;
};

function openNodeSqlite(): Backend {
  try {
    initPastPapersEnv();
  } catch {
    // Env validation is optional here; fall through to path resolution.
  }
  const { DatabaseSync } = require("node:sqlite") as {
    DatabaseSync: new (path: string) => {
      prepare: (sql: string) => {
        all: (...params: Scalar[]) => Row[];
        run: (...params: Scalar[]) => { changes: number };
      };
    };
  };
  const raw = process.env.PAST_PAPERS_DATABASE_URL || process.env.DATABASE_URL || "";
  const isPath =
    !!raw &&
    !raw.startsWith("postgres://") &&
    !raw.startsWith("postgresql://") &&
    !raw.startsWith("prisma+");
  const resolved = isPath
    ? raw
    : process.cwd() + "/prisma/past-papers.db";
  const db = new DatabaseSync(resolved.startsWith("file:") ? resolved.slice(5) : resolved);
  return {
    all: async (sql: string, params: Scalar[]) =>
      db.prepare(sql).all(...params) as Row[],
    run: async (sql: string, params: Scalar[]) => {
      const stmt = db.prepare(sql);
      if (params.length) return Number(stmt.run(...params).changes);
      return Number(stmt.run().changes);
    },
  };
}

function openD1(): Backend {
  const { getCloudflareContext } = require("@opennextjs/cloudflare") as {
    getCloudflareContext: () => { env: Record<string, unknown> };
  };
  const d1 = getCloudflareContext().env.DB as {
    prepare: (sql: string) => {
      bind: (...params: Scalar[]) => {
        all: () => Promise<{ results: Row[] }>;
        run: () => Promise<{ meta?: { changes?: number } }>;
      };
      all: () => Promise<{ results: Row[] }>;
      run: () => Promise<{ meta?: { changes?: number } }>;
    };
  };
  return {
    all: async (sql: string, params: Scalar[]) => {
      const stmt = d1.prepare(sql);
      const res = params.length ? await stmt.bind(...params).all() : await stmt.all();
      return res.results;
    },
    run: async (sql: string, params: Scalar[]) => {
      const stmt = d1.prepare(sql);
      const res = params.length ? await stmt.bind(...params).run() : await stmt.run();
      return Number(res.meta?.changes ?? 0);
    },
  };
}

let cachedBackend: Backend | null = null;

function getBackend(): Backend {
  if (cachedBackend) return cachedBackend;
  const isWorker = Boolean((process.env as Record<string, string | undefined>).CF_D1);
  cachedBackend = isWorker ? openD1() : openNodeSqlite();
  return cachedBackend;
}

type FindArgs = {
  where?: Where;
  select?: string[];
  orderBy?: Record<string, string> | Record<string, string>[];
  distinct?: string[];
  take?: number;
  skip?: number;
};

async function findMany(table: string, args: FindArgs = {}) {
  const where = whereClause(table, args.where ?? {});
  const base = `FROM \`${table}\`` + (where.clause ? ` WHERE ${where.clause}` : "");
  const cols = args.distinct
    ? args.distinct.map((c) => `\`${c}\``).join(", ")
    : selectColumns(args.select);
  const distinct = args.distinct ? "DISTINCT " : "";
  const order = args.distinct
    ? args.orderBy ? orderClause(args.orderBy) : ` ORDER BY \`${args.distinct[0]}\` ASC`
    : orderClause(args.orderBy);
  const limit = args.take !== undefined ? ` LIMIT ${Math.max(0, args.take)}` : "";
  const offset = args.skip !== undefined ? ` OFFSET ${Math.max(0, args.skip)}` : "";
  const sql = `SELECT ${distinct}${cols} ${base}${order}${limit}${offset}`;
  const rows = await getBackend().all(sql, where.params);
  return rows.map((r) => hydrate(r, args.select ?? args.distinct));
}

async function count(table: string, where: Where = {}) {
  const w = whereClause(table, where);
  const sql = `SELECT COUNT(*) AS n FROM \`${table}\`` + (w.clause ? ` WHERE ${w.clause}` : "");
  const rows = await getBackend().all(sql, w.params);
  return Number(rows[0]?.n ?? 0);
}

type IncludeSpec = {
  as: string;
  table: string;
  localKey: string;
  foreignKey: string;
  kind: "one" | "many";
  select?: string[];
};

async function findFirst(table: string, args: FindArgs & { include?: IncludeSpec[] } = {}) {
  const rows = await findMany(table, { ...args, take: 1 });
  if (rows.length === 0) return null;
  const row = rows[0];
  for (const inc of args.include ?? []) {
    const refs = await getBackend().all(
      `SELECT ${selectColumns(inc.select)} FROM \`${inc.table}\` WHERE \`${inc.foreignKey}\` = ?`,
      [row[inc.localKey] as Scalar]
    );
    const hydrated = refs.map((r) => hydrate(r, inc.select));
    row[inc.as] = inc.kind === "one" ? (hydrated[0] ?? null) : hydrated;
  }
  return row;
}

function serializeFields(data: Record<string, Scalar | Date>) {
  const keys: string[] = [];
  const params: Scalar[] = [];
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    keys.push(`\`${key}\``);
    params.push(value instanceof Date ? value.getTime() : (value as Scalar));
  }
  return { keys, params };
}

async function create(table: string, data: Record<string, Scalar | Date>): Promise<Row> {
  const meta = tableMeta(table);
  const now = Date.now();
  const final: Record<string, Scalar | Date> = { id: crypto.randomUUID(), ...data };
  if (final.id === undefined || final.id === null) final.id = crypto.randomUUID();
  for (const [key, value] of Object.entries(meta.defaults)) {
    if (final[key] === undefined) final[key] = value as Scalar;
  }
  for (const key of meta.stamp) {
    if (final[key] === undefined) final[key] = now;
  }
  const { keys, params } = serializeFields(final);
  const sql = `INSERT INTO \`${table}\` (${keys.join(", ")}) VALUES (${params.map(() => "?").join(", ")})`;
  await getBackend().run(sql, params);
  return hydrate({ ...final });
}

async function createMany(table: string, rows: Array<Record<string, Scalar | Date>>) {
  for (const row of rows) await create(table, row);
}

async function update(table: string, where: Where, data: Record<string, Scalar | Date>) {
  const meta = tableMeta(table);
  const final: Record<string, Scalar | Date> = { ...data };
  if (meta.stamp.includes("updatedAt") && final.updatedAt === undefined) {
    final.updatedAt = Date.now();
  }
  const w = whereClause(table, where);
  const { keys, params } = serializeFields(final);
  const setSql = keys.map((k) => `${k} = ?`).join(", ");
  const sql = `UPDATE \`${table}\` SET ${setSql}` + (w.clause ? ` WHERE ${w.clause}` : "");
  await getBackend().run(sql, [...params, ...w.params]);
}

async function deleteWhere(table: string, where: Where) {
  const w = whereClause(table, where);
  const sql = `DELETE FROM \`${table}\`` + (w.clause ? ` WHERE ${w.clause}` : "");
  await getBackend().run(sql, w.params);
}

async function run(sql: string, params: Scalar[] = []) {
  return getBackend().run(sql, params);
}

async function raw(sql: string, params: Scalar[] = []) {
  return getBackend().all(sql, params);
}

export const db = {
  findMany,
  findFirst,
  count,
  create,
  createMany,
  update,
  delete: deleteWhere,
  run,
  raw,
};
