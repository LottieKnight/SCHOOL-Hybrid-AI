import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { pool } from "../src/db/pool.js";

function setTestEnv() {
  process.env.NODE_ENV = "test";
  process.env.PORT = "0";
  process.env.DATABASE_URL = "postgres://test:test@localhost:5432/test";
  process.env.REDIS_URL = "redis://localhost:6379";
  process.env.JWT_SECRET = "test_secret";
  process.env.COOKIE_SECRET = "test_cookie";
  process.env.CORS_ORIGIN = "http://localhost:3000";
}

function buildAuthHeader(app: { jwt: { sign: (p: object) => string } }, input: { userId: string; role: string; email: string }) {
  const token = app.jwt.sign({
    sub: input.userId,
    email: input.email,
    firstName: "Test",
    lastName: "User",
    role: input.role,
    planType: "trial",
    planStatus: "active",
    isEmailVerified: true,
    isPhoneVerified: false,
    verificationLevel: "basic",
  });
  return { authorization: `Bearer ${token}` };
}

// Seed a user (+ optional public handle) and return its id.
async function seedUser(id: string, email: string, handle: string | null) {
  await pool.query("INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3)", [id, email, "x"]);
  if (handle) {
    await pool.query("INSERT INTO user_profiles (user_id, username) VALUES ($1, $2)", [id, handle]);
  }
}

interface Fixtures {
  qaId: string;
  aaId: string;
  otherId: string;
  postId: string;
  commentId: string;
  headers: Record<string, string>;
}

// Question author (qa, has a handle) accepts an answer comment authored by aa.
async function seedFixtures(app: { jwt: { sign: (p: object) => string } }): Promise<Fixtures> {
  const qaId = randomUUID();
  const aaId = randomUUID();
  const otherId = randomUUID();
  const postId = randomUUID();
  const commentId = randomUUID();
  await seedUser(qaId, `qa-${qaId}@test.local`, "qa-" + qaId.slice(0, 8));
  await seedUser(aaId, `aa-${aaId}@test.local`, null);
  await seedUser(otherId, `other-${otherId}@test.local`, "other-" + otherId.slice(0, 8));
  await pool.query(
    `INSERT INTO posts (id, user_id, post_type, content, is_hidden) VALUES ($1, $2, 'question', $3, FALSE)`,
    [postId, qaId, "What is the answer?"]
  );
  await pool.query(
    `INSERT INTO comments (id, post_id, user_id, content, is_hidden) VALUES ($1, $2, $3, $4, FALSE)`,
    [commentId, postId, aaId, "Here is the answer."]
  );
  const headers = buildAuthHeader(app, { userId: qaId, role: "STUDENT", email: `qa-${qaId}@test.local` });
  return { qaId, aaId, otherId, postId, commentId, headers };
}

async function countLedger(fx: Fixtures) {
  const r = await pool.query(
    `SELECT COALESCE(SUM(amount_credits), 0)::int AS total, COUNT(*)::int AS n
       FROM wallet_ledger_entries
      WHERE user_id IN ($1, $2) AND ref_type = 'community:accepted_answer' AND ref_id = $3`,
    [fx.qaId, fx.aaId, fx.commentId]
  );
  return r.rows[0] as { total: number; n: number };
}

async function cleanup(fx: Fixtures) {
  await pool.query("DELETE FROM wallet_ledger_entries WHERE user_id IN ($1,$2)", [fx.qaId, fx.aaId]);
  await pool.query("DELETE FROM wallet_accounts WHERE user_id IN ($1,$2,$3)", [fx.qaId, fx.aaId, fx.otherId]);
  await pool.query("DELETE FROM comments WHERE post_id = $1", [fx.postId]);
  await pool.query("DELETE FROM posts WHERE id = $1", [fx.postId]);
  await pool.query("DELETE FROM user_profiles WHERE user_id IN ($1,$2,$3)", [fx.qaId, fx.aaId, fx.otherId]);
  await pool.query("DELETE FROM users WHERE id IN ($1,$2,$3)", [fx.qaId, fx.aaId, fx.otherId]);
}

test("POST /community/posts/:id/accept awards 20 Scholar Credits + ledger proof-of-progress, and is idempotent", async () => {
  setTestEnv();
  const { buildServer } = await import("../src/server.js");
  const { closeRedis } = await import("../src/cache.js");
  const app = await buildServer();
  const fx = await seedFixtures(app);
  try {
    const accept = await (async () => {
      const res = await app.inject({
        method: "POST",
        url: `/community/posts/${fx.postId}/accept`,
        headers: fx.headers,
        payload: { commentId: fx.commentId },
      });
      return { statusCode: res.statusCode, body: JSON.parse(res.body) };
    })();

    assert.equal(accept.statusCode, 200);
    assert.deepEqual(accept.body, { ok: true, awarded_credits: 20, answer_author_id: fx.aaId });

    const before = await countLedger(fx);
    assert.equal(before.n, 1); // single proof-of-progress ledger row
    assert.equal(before.total, 20);

    // Re-accept the same comment — idempotent: no second credit awarded.
    const again = await app.inject({
      method: "POST",
      url: `/community/posts/${fx.postId}/accept`,
      headers: fx.headers,
      payload: { commentId: fx.commentId },
    });
    assert.equal(again.statusCode, 200);
    const after = await countLedger(fx);
    assert.equal(after.n, 1, "second accept must not create a second ledger entry");
    assert.equal(after.total, 20, "balance must not double");
  } finally {
    await cleanup(fx);
    await app.close();
    await closeRedis();
  }
});

test("POST /community/posts/:id/accept enforces auth (401 unauthenticated, 403 non-author)", async () => {
  setTestEnv();
  const { buildServer } = await import("../src/server.js");
  const { closeRedis } = await import("../src/cache.js");
  const app = await buildServer();
  const fx = await seedFixtures(app);
  try {
    // Unauthenticated → 401 (requireAuth).
    const unauth = await app.inject({ method: "POST", url: `/community/posts/${fx.postId}/accept`, payload: { commentId: fx.commentId } });
    assert.equal(unauth.statusCode, 401);

    // Authenticated but not the post author → 403 not_authorized.
    const otherHeaders = buildAuthHeader(app, { userId: fx.otherId, role: "STUDENT", email: `other-${fx.otherId}@test.local` });
    const forbidden = await app.inject({
      method: "POST",
      url: `/community/posts/${fx.postId}/accept`,
      headers: otherHeaders,
      payload: { commentId: fx.commentId },
    });
    assert.equal(forbidden.statusCode, 403);
    assert.equal(JSON.parse(forbidden.body).code, "not_authorized");
  } finally {
    await cleanup(fx);
    await app.close();
    await closeRedis();
  }
});
