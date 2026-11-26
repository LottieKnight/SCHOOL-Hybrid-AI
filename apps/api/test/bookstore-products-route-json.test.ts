import { test } from "node:test";
import assert from "node:assert/strict";

function setTestEnv() {
  process.env.NODE_ENV = "test";
  process.env.PORT = "0";
  process.env.DATABASE_URL = "postgres://test:test@localhost:5432/test";
  process.env.REDIS_URL = "redis://localhost:6379";
  process.env.JWT_SECRET = "test_secret";
  process.env.COOKIE_SECRET = "test_cookie";
  process.env.CORS_ORIGIN = "http://localhost:3000";
}

type QueryMock = (queryText: string, values?: unknown[]) => Promise<{ rows: unknown[] }>;

async function withMockedQuery(mock: QueryMock, run: () => Promise<void>) {
  const { pool } = await import("../src/db/pool.js");
  const mutablePool = pool as unknown as {
    query: (queryText: string, values?: unknown[]) => Promise<{ rows: unknown[] }>;
  };
  const original = mutablePool.query;
  mutablePool.query = mock;
  try {
    await run();
  } finally {
    mutablePool.query = original;
  }
}

test("GET /bookstore/products returns parseable JSON on success", async () => {
  setTestEnv();
  const { buildServer } = await import("../src/server.js");
  const { closeRedis } = await import("../src/cache.js");

  const productRow = {
    id: "00000000-0000-0000-0000-000000000111",
    slug: "foundation-maths-reader",
    title: "Foundation Maths Reader",
    description: "Intro maths reader",
    phase: "FOUNDATION",
    grade_min: 1,
    grade_max: 3,
    subjects: ["Mathematics"],
    format: "DIGITAL",
    price_cents: 0,
    currency: "ZAR",
    is_free: true,
    license_type: "CC_BY",
    license_url: "https://creativecommons.org/licenses/by/4.0/",
    attribution_html: "<p>Example attribution</p>",
    source_url: "https://example.org/oer",
    source_provider: "MANUAL",
    nd_no_derivatives: false,
    nc_noncommercial: false,
    sa_sharealike: false,
    is_adapted: false,
    storage_key: null,
    file_type: "LINK_ONLY",
    file_size: null,
    checksum: null,
    external_download_url: "https://example.org/oer.pdf",
    fulfillment_type: "LINK_ONLY",
    shipping_profile_id: null,
    stock_qty: null,
    tags: ["oer"],
    metadata_json: {},
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  await withMockedQuery(
    async (queryText) => {
      const text = queryText.toLowerCase();
      if (text.includes("count(*)")) {
        return { rows: [{ count: "1" }] };
      }
      if (text.includes("from bookstore_products")) {
        return { rows: [productRow] };
      }
      return { rows: [] };
    },
    async () => {
      const app = await buildServer();
      const response = await app.inject({ method: "GET", url: "/bookstore/products" });

      assert.equal(response.statusCode, 200);
      assert.match(response.headers["content-type"] || "", /application\/json/i);

      const parsed = JSON.parse(response.body) as {
        products: Array<{ id: string; license_flags?: { nc_noncommercial: boolean } }>;
        pagination: { total: number };
      };
      assert.equal(parsed.pagination.total, 1);
      assert.equal(parsed.products[0]?.id, productRow.id);
      assert.equal(parsed.products[0]?.license_flags?.nc_noncommercial, false);

      await app.close();
      await closeRedis();
    }
  );
});

test("GET /bookstore/products returns parseable JSON on internal error", async () => {
  setTestEnv();
  const { buildServer } = await import("../src/server.js");
  const { closeRedis } = await import("../src/cache.js");

  await withMockedQuery(
    async () => {
      throw new Error("db offline");
    },
    async () => {
      const app = await buildServer();
      const response = await app.inject({ method: "GET", url: "/bookstore/products" });

      assert.equal(response.statusCode, 500);
      assert.match(response.headers["content-type"] || "", /application\/json/i);
      const parsed = JSON.parse(response.body) as { error?: string };
      assert.ok(typeof parsed.error === "string" && parsed.error.length > 0);

      await app.close();
      await closeRedis();
    }
  );
});
