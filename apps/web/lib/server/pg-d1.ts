import "server-only";

// A minimal pg-compatible surface backed by Cloudflare D1, mirroring the subset
// of `pg` (Pool/Client.query + QueryResult) that the app's plannerDb consumers
// rely on. Postgres-only syntax in the query strings is rewritten for SQLite:
//   $n placeholders -> positional `?`,  ANY($n) arrays -> IN (?, ...),
//   ::casts stripped, ILIKE -> LIKE, now()/gen_random_uuid() -> SQLite equivs.
// Multi-statement text is split and executed atomically via D1 batch, and
// BEGIN/COMMIT/ROLLBACK inside a client are buffered into one batch.

type Scalar = string | number | null;

type D1Prepared = {
  bind: (...params: Scalar[]) => D1Prepared;
  all: () => Promise<{ results: Record<string, unknown>[] }>;
  run: () => Promise<{ meta?: { changes?: number } }>;
};

type D1DatabaseLike = {
  prepare: (sql: string) => D1Prepared;
  batch: (stmts: D1Prepared[]) => Promise<{ results: Record<string, unknown>[] }[]>;
};

export type PgLikeResult<T = any> = {
  rows: T[];
  rowCount: number;
  command: string;
  fields: { name: string }[];
};

type QueryArgs = {
  text: string;
  values?: readonly unknown[];
  name?: string;
};

export function isCloudflareRuntime(): boolean {
  return Boolean((process.env as Record<string, string | undefined>).CF_D1);
}

export function resolveD1Binding(): D1DatabaseLike | null {
  if (!isCloudflareRuntime()) return null;
  try {
    const { getCloudflareContext } = require("@opennextjs/cloudflare") as {
      getCloudflareContext: () => { env: Record<string, unknown> };
    };
    const env = getCloudflareContext().env ?? {};
    const d1 = env.DB_BUSINESS as D1DatabaseLike | undefined;
    return d1 ?? null;
  } catch {
    return null;
  }
}

function toD1Value(v: unknown): Scalar {
  if (v === null || v === undefined) return null;
  if (typeof v === "bigint") return v.toString();
  if (typeof v === "boolean") return v ? 1 : 0;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") return JSON.stringify(v);
  return v as Scalar;
}

// Returns segments of `sql` that live OUTSIDE string literals, comments and
// double-quoted identifiers, applying `fn` to each outside run.
function mapOutside(sql: string, fn: (seg: string) => string): string {
  let out = "";
  let i = 0;
  const n = sql.length;
  while (i < n) {
    const ch = sql[i];
    if (ch === "'") {
      let j = i + 1;
      while (j < n) {
        if (sql[j] === "'") {
          if (sql[j + 1] === "'") {
            j += 2;
            continue;
          }
          j++;
          break;
        }
        j++;
      }
      out += sql.slice(i, j);
      i = j;
      continue;
    }
    if (ch === '"') {
      let j = i + 1;
      while (j < n) {
        if (sql[j] === '"') {
          j++;
          break;
        }
        j++;
      }
      out += sql.slice(i, j);
      i = j;
      continue;
    }
    if (ch === "-" && sql[i + 1] === "-") {
      let j = i;
      while (j < n && sql[j] !== "\n") j++;
      out += sql.slice(i, j);
      i = j;
      continue;
    }
    let j = i;
    while (
      j < n &&
      sql[j] !== "'" &&
      sql[j] !== '"' &&
      !(sql[j] === "-" && sql[j + 1] === "-")
    )
      j++;
    out += fn(sql.slice(i, j));
    i = j;
  }
  return out;
}

const CAST_RE =
  /::\s*(?:"[^"]+"|[A-Za-z_][\w]*(?:\s*\[\])?)/g;
const ILIKE_RE = /\bILIKE\b/gi;
const NOW_RE = /\bnow\s*\(\s*\)/gi;
const UUID_RE = /\bgen_random_uuid\s*\(\s*\)/gi;
// date_trunc('week', x) -> (datetime(x))". Loosens exact zeroing, keeps
// ordering/day granularity correct for the app's use in stats/digests.
const DATE_TRUNC_RE = /\bdate_trunc\s*\(\s*'[a-z]+'\s*,\s*([^()]*[^()\s])\s*\)/gi;

export function rewritePgToD1(
  sql: string,
  values: readonly unknown[] = []
): { sql: string; values: Scalar[] } {
  const outVals: Scalar[] = [];
  const outSql = mapOutside(sql, (seg) => {
    let res = "";
    let idx = 0;
    // First pass: $n and ANY($n) expansion, in textual order.
    const re = /ANY\s*\(\s*\$(\d+)\s*\)|\$\d+/gi;
    while (idx < seg.length) {
      re.lastIndex = idx;
      const m = re.exec(seg);
      if (!m) {
        res += seg.slice(idx);
        break;
      }
      res += seg.slice(idx, m.index);
      if (m[1] !== undefined) {
        const arr = values[Number(m[1]) - 1];
        if (Array.isArray(arr)) {
          const placeholders = arr.map(() => "?").join(", ");
          res += `IN (${placeholders})`;
          for (const a of arr) outVals.push(toD1Value(a));
        } else {
          res += "?";
          outVals.push(toD1Value(arr));
        }
      } else {
        const p = Number(m[0].slice(1)) - 1;
        res += "?";
        outVals.push(toD1Value(values[p]));
      }
      idx = m.index + m[0].length;
    }
    return res
      .replace(CAST_RE, "")
      .replace(ILIKE_RE, "LIKE")
      .replace(NOW_RE, "(strftime('%Y-%m-%dT%H:%M:%fZ','now'))")
      .replace(UUID_RE, "lower(hex(randomblob(16)))")
      .replace(DATE_TRUNC_RE, "(datetime($1))");
  });
  return { sql: outSql, values: outVals };
}

function splitStatements(sql: string): string[] {
  const parts: string[] = [];
  let cur = "";
  let i = 0;
  const n = sql.length;
  while (i < n) {
    const ch = sql[i];
    if (ch === "'") {
      let j = i + 1;
      while (j < n) {
        if (sql[j] === "'") {
          if (sql[j + 1] === "'") {
            j += 2;
            continue;
          }
          j++;
          break;
        }
        j++;
      }
      cur += sql.slice(i, j);
      i = j;
      continue;
    }
    if (ch === "-" && sql[i + 1] === "-") {
      let j = i;
      while (j < n && sql[j] !== "\n") j++;
      cur += " ";
      i = j;
      continue;
    }
    if (ch === ";") {
      if (cur.trim()) parts.push(cur);
      cur = "";
      i++;
      continue;
    }
    cur += ch;
    i++;
  }
  if (cur.trim()) parts.push(cur);
  return parts.map((s) => s.trim()).filter(Boolean);
}

function countPlaceholders(sql: string): number {
  return mapOutside(sql, (seg) => seg).split("?").length - 1;
}

function toPgResult<T = any>(
  r: { results?: Record<string, unknown>[]; meta?: { changes?: number } } | undefined
): PgLikeResult<T> {
  const rows = (r?.results ?? []) as T[];
  const changes = r?.meta?.changes ?? 0;
  return {
    rows,
    rowCount: rows.length > 0 ? rows.length : changes,
    command: "",
    fields: rows.length
      ? Object.keys(rows[0] as Record<string, unknown>).map((name) => ({ name }))
      : [],
  };
}

async function executeOne(db: D1DatabaseLike, sql: string, values: Scalar[]) {
  const stmt = values.length ? db.prepare(sql).bind(...values) : db.prepare(sql);
  return toPgResult(await stmt.all());
}

async function execute(db: D1DatabaseLike, sql: string, values: readonly unknown[]) {
  const { sql: rewritten, values: flat } = rewritePgToD1(sql, values);
  const stmts = splitStatements(rewritten);
  if (stmts.length === 1) {
    return executeOne(db, rewritten, flat);
  }
  const prepared: D1Prepared[] = [];
  let vi = 0;
  for (const st of stmts) {
    const count = countPlaceholders(st);
    const vals = flat.slice(vi, vi + count);
    vi += count;
    prepared.push(vals.length ? db.prepare(st).bind(...vals) : db.prepare(st));
  }
  const results = await db.batch(prepared);
  return toPgResult(results[results.length - 1]);
}

export class PgCompatiblePool {
  private _client?: D1DatabaseLike;

  constructor(client?: D1DatabaseLike) {
    this._client = client;
  }

  private db(): D1DatabaseLike {
    if (!this._client) {
      const d1 = resolveD1Binding();
      if (!d1) throw new Error("DB_BUSINESS binding unavailable in this runtime");
      this._client = d1;
    }
    return this._client;
  }

  query<T = any>(text: string, values?: readonly unknown[]): Promise<PgLikeResult<T>>;
  query<T = any>(config: QueryArgs): Promise<PgLikeResult<T>>;
  query<T = any>(
    textOrConfig: string | QueryArgs,
    values?: readonly unknown[]
  ): Promise<PgLikeResult<T>> {
    const config: QueryArgs =
      typeof textOrConfig === "string"
        ? { text: textOrConfig, values }
        : textOrConfig;
    return execute(this.db(), config.text, config.values ?? []);
  }

  async connect() {
    return new PgCompatibleClient(this.db());
  }

  on() {
    return this;
  }

  end() {
    return Promise.resolve();
  }
}

export class PgCompatibleClient {
  private _tx: { prepared: D1Prepared[] } | null = null;
  private _released = false;

  constructor(private db: D1DatabaseLike) {}

  async query<T = any>(text: string, values?: readonly unknown[]): Promise<PgLikeResult<T>>;
  async query<T = any>(config: QueryArgs): Promise<PgLikeResult<T>>;
  async query<T = any>(
    textOrConfig: string | QueryArgs,
    values?: readonly unknown[]
  ): Promise<PgLikeResult<T>> {
    if (this._released) throw new Error("Client has already been released");
    const config: QueryArgs =
      typeof textOrConfig === "string"
        ? { text: textOrConfig, values }
        : textOrConfig;
    const text = config.text;
    const t = text.trim();
    if (/^(BEGIN|START\s+TRANSACTION)\b/i.test(t)) {
      this._tx = { prepared: [] };
      return { rows: [], rowCount: 0, command: "BEGIN", fields: [] };
    }
    if (/^(COMMIT|END)\b/i.test(t)) {
      const tx = this._tx;
      this._tx = null;
      if (tx && tx.prepared.length) {
        const results = await this.db.batch(tx.prepared);
        return toPgResult(results[results.length - 1]);
      }
      return { rows: [], rowCount: 0, command: "COMMIT", fields: [] };
    }
    if (/^(ROLLBACK|ABORT)\b/i.test(t)) {
      this._tx = null;
      return { rows: [], rowCount: 0, command: "ROLLBACK", fields: [] };
    }
    if (this._tx) {
      const { sql: rewritten, values: flat } = rewritePgToD1(text, values ?? []);
      const stmts = splitStatements(rewritten);
      let vi = 0;
      for (const st of stmts) {
        const count = countPlaceholders(st);
        const vals = flat.slice(vi, vi + count);
        vi += count;
        this._tx.prepared.push(
          vals.length ? this.db.prepare(st).bind(...vals) : this.db.prepare(st)
        );
      }
      return { rows: [], rowCount: 0, command: "", fields: [] };
    }
    return execute(this.db, text, values ?? []);
  }

  release() {
    // Implicit commit of any unclosed transaction, mirroring pg issuing COMMIT
    // if the client releases mid-transaction (pg warns but commits).
    if (this._tx && this._tx.prepared.length) {
      void this.db
        .batch(this._tx.prepared)
        .then(() => undefined)
        .catch(() => undefined);
    }
    this._tx = null;
    this._released = true;
  }
}