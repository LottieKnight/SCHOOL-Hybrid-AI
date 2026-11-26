import { test } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { createRequire } from 'module';
import { resolve } from 'path';
const __filename = new URL(import.meta.url).pathname;
const __dirname = new URL(import.meta.url).pathname.replace(/\/[^/]+$/, '');
const require = createRequire(import.meta.url);

function clearModuleCache(...modules: string[]) {
  for (const modulePath of modules) {
    const resolved = resolve(__dirname, modulePath);
    if (require.cache[resolved]) {
      delete require.cache[resolved];
    }
  }
}

async function setupTestData(pool) {
  // Insert a test user if not exists
  await pool.query(
    `INSERT INTO users (id, email, role, is_minor)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (id) DO NOTHING`,
    ['test-user-id', 'test@example.com', 'user', false]
  );

  // Insert a test study if not exists
  await pool.query(
    `INSERT INTO research_studies (id, code, title, status, ethics_ref, current_consent_version, current_stimulus_version, min_age, config)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (code) DO NOTHING`,
    [
      'test-study-id',
      'observational-silence-v1',
      'Observational Silence Study',
      'recruiting',
      'ethics-ref-123',
      '1.0',
      '1.0',
      18,
      '{}'
    ]
  );
}

test("research consent endpoint returns 401 without auth", async () => {
  process.env.NODE_ENV = "test";
  process.env.PORT = "0";
  process.env.DATABASE_URL = "postgres://saedu:saedu_password@localhost:5432/saedu";
  process.env.REDIS_URL = "redis://localhost:6379";
  process.env.JWT_SECRET = "test_secret";
  process.env.COOKIE_SECRET = "test_cookie";
  process.env.CORS_ORIGIN = "http://localhost:3000";

  // Clear cache for modules we are about to import
  clearModuleCache(
    '../src/server.js',
    '../src/cache.js'
  );

  const { buildServer: build } = await import("../src/server.js");
  const { closeRedis: close } = await import("../src/cache.js");
  const app = await build();
  try {
    const response = await app.inject({
      method: "POST",
      url: `/research/observational-silence-v1/consent`,
      payload: {},
    });
    assert.equal(response.statusCode, 401);
  } finally {
    await app.close();
    await close();
  }
});

test("research consent endpoint returns 200 with valid auth and study", async () => {
  process.env.NODE_ENV = "test";
  process.env.PORT = "0";
  process.env.DATABASE_URL = "postgres://saedu:saedu_password@localhost:5432/saedu";
  process.env.REDIS_URL = "redis://localhost:6379";
  process.env.JWT_SECRET = "test_secret";
  process.env.COOKIE_SECRET = "test_cookie";
  process.env.CORS_ORIGIN = "http://localhost:3000";

  // Clear cache for modules we are about to import
  clearModuleCache(
    '../src/server.js',
    '../src/cache.js',
    '../src/db/pool.js',
    '../src/config.js'
  );

  const { buildServer: build } = await import("../src/server.js");
  const { closeRedis: close } = await import("../src/cache.js");
  const { pool } = await import("../src/db/pool.js");
  const { config } = await import("../src/config.js");

  await setupTestData(pool);

  const app = await build();
  try {
    // Create a JWT token for the test user
    const token = jwt.sign(
      { sub: 'test-user-id', role: 'user', email: 'test@example.com' },
      config.jwtSecret,
      { expiresIn: '7d' }
    );

    const response = await app.inject({
      method: "POST",
      url: `/research/observational-silence-v1/consent`,
      payload: {},
      cookies: {
        [config.cookieName]: token
      }
    });

    // Expect 200 (if already consented) or 201 (if newly consented)
    assert.ok([200, 201].includes(response.statusCode), 
      `Expected status code 200 or 201, got ${response.statusCode}`);
  } finally {
    await app.close();
    await close();
  }
});
