// apps/api/src/routes/sso.ts
//
// SAML 2.0 Single Sign-On service provider endpoints.
//
//   GET  /sso/metadata            Service Provider metadata (per-institution
//                                 or default)
//   GET  /sso/login               SP-initiated login -> redirect to IdP
//   POST /sso/acs                 Assertion Consumer Service (idP -> SP)
//   GET  /sso/initiate-slo        SP-initiated Single Logout
//   POST /sso/slo                 Single Logout (IdP Message)
//
// Each institution configures its IdP in `institution_settings.sso_config`
// (shape validated by samlConfigSchema). Requests carry the institution via a
// query/host so we can resolve the right IdP config.

import { FastifyInstance } from "fastify";
import { pool } from "../db/pool.js";
import { findUserByEmail, createUser, touchLastActiveAt } from "../db/users.js";
import { ensureProfile } from "../db/profile.js";
import { setAuthCookies, getClientIp } from "./auth/utils.js";
import { writeAuditLog } from "../db/audit-log.js";
import { config } from "../config.js";
import {
  resolveSamlConfig,
  processPostResponse,
  buildAuthorizeUrl,
  buildLogoutUrl,
  defaultSpMetadata,
} from "../lib/saml.js";
import {
  resolveOidcConfig,
  buildAuthorizeUrl as buildOidcAuthorizeUrl,
  processCallback as processOidcCallback,
} from "../lib/oidc.js";
import { randomUUID, createHmac, timingSafeEqual } from "node:crypto";
import { recordDailyUsage } from "../lib/usage.js";

async function getInstitutionSettings(institutionId: string): Promise<{ sso_config: Record<string, unknown>; tier: string } | null> {
  if (!institutionId) return null;
  const result = await pool.query(
    `SELECT sso_config, tier FROM institution_settings WHERE institution_id = $1`,
    [institutionId]
  );
  return result.rows[0] ?? null;
}

/** Resolve the institution id from a request (query param or host subdomain). */
function resolveInstitutionId(request: any): string | null {
  const q = request.query?.institutionId;
  if (typeof q === "string" && q) return q;
  const host = request.headers?.host ?? "";
  const sub = host.split(".")[0];
  return sub && sub !== "school" && sub !== "www" && sub !== "app" ? sub : null;
}

export async function registerSsoRoutes(app: FastifyInstance) {
  type SsoQuery = { institutionId?: string; RelayState?: string; nameId?: string; sessionIndex?: string };

  // SP metadata — per institution via ?institutionId, else default.
  app.get<{ Querystring: SsoQuery }>("/sso/metadata", async (request, reply) => {
    const institutionId = resolveInstitutionId(request);
    if (institutionId) {
      const settings = await getInstitutionSettings(institutionId);
      const saml = resolveSamlConfig(settings?.sso_config);
      if (saml) {
        reply.type("application/xml");
        const { generateSpMetadata } = await import("../lib/saml.js");
        return reply.send(generateSpMetadata(saml));
      }
    }
    reply.type("application/xml");
    return reply.send(defaultSpMetadata());
  });

  // SP-initiated login.
  app.get<{ Querystring: SsoQuery }>("/sso/login", async (request, reply) => {
    const institutionId = resolveInstitutionId(request);
    const settings = await getInstitutionSettings(institutionId ?? "");
    const saml = resolveSamlConfig(settings?.sso_config);
    if (!saml) {
      reply.code(400).send({ error: "SSO not configured for this institution" });
      return;
    }
    const url = await buildAuthorizeUrl(saml, request.query.RelayState);
    return reply.redirect(url);
  });

  // Assertion Consumer Service (POST from IdP).
  app.post<{ Querystring: SsoQuery; Body: Record<string, string> }>("/sso/acs", async (request, reply) => {
    const institutionId = resolveInstitutionId(request);
    const settings = await getInstitutionSettings(institutionId ?? "");
    const saml = resolveSamlConfig(settings?.sso_config);
    if (!saml) {
      reply.code(400).send({ error: "SSO not configured for this institution" });
      return;
    }

    try {
      const { user, loggedOut } = await processPostResponse(saml, request.body);
      if (loggedOut) {
        reply.clearCookie(config.cookieName, { path: "/" });
        return reply.redirect(config.appUrl);
      }

      if (!user.email) {
        reply.code(400).send({ error: "SSO response missing email" });
        return;
      }

      // Find or provision the user.
      let dbUser = await findUserByEmail(user.email);
      if (!dbUser) {
        dbUser = await createUser(
          user.email,
          randomUUID(), // SSO users have no local password
          user.firstName,
          user.lastName,
          "",
          inferRole(user)
        );
        // attach institution + mark email verified
        await pool.query(
          `UPDATE users SET institution_id = $2, is_email_verified = TRUE,
                  verification_level = 'standard'
           WHERE id = $1`,
          [dbUser.id, institutionId]
        );
        await ensureProfile(dbUser.id, user.email.split("@")[0]).catch(() => null);
      } else {
        // ensure institution linkage and verified email
        await pool.query(
          `UPDATE users SET is_email_verified = TRUE
           WHERE id = $1 AND (institution_id IS NULL OR institution_id = $2)`,
          [dbUser.id, institutionId]
        );
      }

      const token = await reply.jwtSign({
        sub: dbUser.id,
        email: dbUser.email,
        firstName: dbUser.first_name,
        lastName: dbUser.last_name,
        role: dbUser.role,
        planType: dbUser.plan_type,
        planStatus: dbUser.plan_status,
        isEmailVerified: true,
        isPhoneVerified: dbUser.is_phone_verified,
        verificationLevel: dbUser.verification_level,
        isMinor: dbUser.is_minor,
        institutionId: institutionId ?? dbUser.institution_id,
        permissions: dbUser.permissions,
      });
      const csrfToken = randomUUID();
      setAuthCookies(reply, token, csrfToken);
      touchLastActiveAt(dbUser.id);

      if (dbUser.institution_id) {
        void recordDailyUsage(dbUser.institution_id, { activeUsers: 1, logins: 1, sessions: 1 }).catch(() => {});
      }

      void writeAuditLog({
        userId: dbUser.id,
        actorId: dbUser.id,
        action: "auth.login",
        ipAddress: getClientIp(request),
        userAgent: request.headers["user-agent"] ?? null,
        metadata: { provider: "saml", institutionId },
      });

      const relay = request.body?.RelayState;
      const redirectUrl = typeof relay === "string" && relay.startsWith("http") ? relay : config.appUrl;
      return reply.redirect(redirectUrl);
    } catch (error: any) {
      app.log.error({ err: error }, "SAML ACS failed");
      reply.code(401).send({ error: "SSO authentication failed", detail: error?.message });
    }
  });

  // SP-initiated Single Logout.
  app.get<{ Querystring: SsoQuery }>("/sso/initiate-slo", async (request, reply) => {
    const institutionId = resolveInstitutionId(request);
    const settings = await getInstitutionSettings(institutionId ?? "");
    const saml = resolveSamlConfig(settings?.sso_config);
    if (!saml) {
      reply.code(400).send({ error: "SSO not configured" });
      return;
    }
    const nameId = request.query.nameId ?? "";
    const url = await buildLogoutUrl(saml, nameId, request.query.sessionIndex);
    return reply.redirect(url);
  });

  // Legacy compatibility: keep the old single POST /sso endpoint delegating to
  // the same flow when an institution can be inferred from the body.
  app.post("/sso", async (request, reply) => {
    const { samlResponse, institutionId } = (request.body ?? {}) as {
      samlResponse?: string;
      institutionId?: string;
    };
    if (!samlResponse) {
      reply.code(400).send({ error: "samlResponse required" });
      return;
    }
    const settings = await getInstitutionSettings(institutionId ?? "");
    const saml = resolveSamlConfig(settings?.sso_config);
    if (!saml) {
      reply.code(400).send({ error: "SSO not configured for this institution; provide institutionId" });
      return;
    }
    try {
      const { user } = await processPostResponse(saml, { SAMLResponse: samlResponse });
      let dbUser = await findUserByEmail(user.email);
      if (!dbUser) {
        dbUser = await createUser(user.email, randomUUID(), user.firstName, user.lastName, "", inferRole(user));
        await pool.query(
          `UPDATE users SET institution_id = $2, is_email_verified = TRUE WHERE id = $1`,
          [dbUser.id, institutionId]
        );
        await ensureProfile(dbUser.id, user.email.split("@")[0]).catch(() => null);
      }
      const token = await reply.jwtSign({
        sub: dbUser.id,
        email: dbUser.email,
        firstName: dbUser.first_name,
        lastName: dbUser.last_name,
        role: dbUser.role,
        planType: dbUser.plan_type,
        planStatus: dbUser.plan_status,
        isEmailVerified: true,
        isPhoneVerified: dbUser.is_phone_verified,
        verificationLevel: dbUser.verification_level,
        isMinor: dbUser.is_minor,
        institutionId,
        permissions: dbUser.permissions,
      });
      return reply.send({ token });
    } catch (error: any) {
      app.log.error({ err: error }, "Legacy SSO failed");
      reply.code(401).send({ error: "SSO authentication failed" });
    }
  });

  // ============================ OIDC (Google / Microsoft) ============================
  // Initiate OIDC login. The PKCE verifier, nonce, and target institution are
  // sealed into the `state` parameter (HMAC-SHA256 over cookieSecret) so the
  // callback can validate the round-trip without a server-side session store.
  app.get<{ Params: { provider: string }; Querystring: { institutionId?: string } }>(
    "/sso/oidc/:provider/login",
    async (request, reply) => {
      const provider = request.params.provider as "google" | "microsoft";
      if (provider !== "google" && provider !== "microsoft") {
        reply.code(400).send({ error: "Unsupported OIDC provider" });
        return;
      }
      const institutionId = request.query.institutionId ?? resolveInstitutionId(request) ?? "";
      const settings = await getInstitutionSettings(institutionId);
      const cfg = resolveOidcConfig(settings?.sso_config);
      if (cfg?.provider !== provider) {
        reply.code(400).send({ error: `OIDC ${provider} not configured for this institution` });
        return;
      }
      const nonce = randomUUID();
      const { url, codeVerifier } = await buildOidcAuthorizeUrl(cfg, { nonce });
      const state = sealOidcState({ institutionId, nonce, codeVerifier });
      reply.setCookie("sso_oidc_state", state, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: config.isProd,
        maxAge: 600,
      });
      return reply.redirect(`${url}&state=${encodeURIComponent(state)}`);
    }
  );

  // OIDC callback.
  app.get<{ Querystring: { code?: string; state?: string; error?: string; error_description?: string } }>(
    "/sso/callback",
    async (request, reply) => {
      const { error } = request.query;
      if (error) {
        reply.code(400).send({ error: "SSO login cancelled", detail: error });
        return;
      }
      const sealed = request.cookies?.sso_oidc_state;
      const rawState = request.query.state ?? "";
      if (!sealed || !unsealOidcState(sealed) || !timingSafeEqual(Buffer.from(sealed), Buffer.from(rawState))) {
        reply.code(401).send({ error: "SSO state verification failed" });
        return;
      }
      const payload = unsealOidcState(sealed)!;
      const institutionId = payload.institutionId || "";

      const settings = await getInstitutionSettings(institutionId);
      const cfg = resolveOidcConfig(settings?.sso_config);
      if (!cfg) {
        reply.code(400).send({ error: "OIDC not configured for this institution" });
        return;
      }

      try {
        const oidcUser = await processOidcCallback(cfg, {
          code: request.query.code ?? "",
          codeVerifier: payload.codeVerifier,
          expectedState: rawState,
          state: rawState,
          nonce: payload.nonce,
          expectedNonce: payload.nonce,
          redirectUri: cfg.redirectUri,
        });
        if (!oidcUser.email) {
          reply.code(400).send({ error: "OIDC response missing email" });
          return;
        }

        const { dbUser, token, csrfToken } = await provisionSsoUser(reply, {
          email: oidcUser.email,
          firstName: oidcUser.firstName,
          lastName: oidcUser.lastName,
          role: inferRole(oidcUser as any),
          institutionId,
        });
        setAuthCookies(reply, token, csrfToken);
        touchLastActiveAt(dbUser.id);
        if (institutionId) {
          void recordDailyUsage(String(institutionId), { activeUsers: 1, logins: 1, sessions: 1 }).catch(() => {});
        }
        void writeAuditLog({
          userId: dbUser.id,
          actorId: dbUser.id,
          action: "auth.login",
          ipAddress: getClientIp(request),
          userAgent: request.headers["user-agent"] ?? null,
          metadata: { provider: cfg.provider, institutionId },
        });
        reply.clearCookie("sso_oidc_state", { path: "/" });
        return reply.redirect(config.appUrl);
      } catch (e: any) {
        app.log.error({ err: e }, "OIDC callback failed");
        reply.code(401).send({ error: "SSO authentication failed", detail: e?.message });
      }
    }
  );
}

// Seal / unseal OIDC state so the PKCE material survives the browser round-trip.
function sealOidcState(data: { institutionId: string; nonce: string; codeVerifier: string }): string {
  const body = Buffer.from(JSON.stringify(data)).toString("base64url");
  const sig = createHmac("sha256", config.cookieSecret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function unsealOidcState(sealed: string): { institutionId: string; nonce: string; codeVerifier: string } | null {
  const dot = sealed.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = sealed.slice(0, dot);
  const sig = sealed.slice(dot + 1);
  const expected = createHmac("sha256", config.cookieSecret).update(body).digest("base64url");
  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf-8"));
  } catch {
    return null;
  }
}

/**
 * Find-or-provision a user from SSO attributes and issue a signed JWT.
 * Shared by SAML (ACS + legacy) and OIDC callbacks.
 */
async function provisionSsoUser(
  reply: any,
  input: { email: string; firstName: string; lastName: string; role: string; institutionId?: string }
) {
  let dbUser = await findUserByEmail(input.email);
  if (!dbUser) {
    dbUser = await createUser(input.email, randomUUID(), input.firstName, input.lastName, "", input.role);
    await pool.query(
      `UPDATE users SET institution_id = $2, is_email_verified = TRUE, verification_level = 'standard' WHERE id = $1`,
      [dbUser.id, input.institutionId ?? null]
    );
    await ensureProfile(dbUser.id, input.email.split("@")[0]).catch(() => null);
  } else {
    await pool.query(
      `UPDATE users SET is_email_verified = TRUE
       WHERE id = $1 AND (institution_id IS NULL OR institution_id = $2)`,
      [dbUser.id, input.institutionId ?? null]
    );
  }
  const token = await reply.jwtSign({
    sub: dbUser.id,
    email: dbUser.email,
    firstName: dbUser.first_name,
    lastName: dbUser.last_name,
    role: dbUser.role,
    planType: dbUser.plan_type,
    planStatus: dbUser.plan_status,
    isEmailVerified: true,
    isPhoneVerified: dbUser.is_phone_verified,
    verificationLevel: dbUser.verification_level,
    isMinor: dbUser.is_minor,
    institutionId: input.institutionId ?? dbUser.institution_id,
    permissions: dbUser.permissions,
  });
  const csrfToken = randomUUID();
  return { dbUser, token, csrfToken };
}

function inferRole(user: { groups?: string[]; role?: string }): string {
  if (user.role && ["institution_admin", "educator", "learner", "parent", "superadmin"].includes(user.role)) {
    return user.role;
  }
  const groups = user.groups ?? [];
  if (groups.some((g) => /admin|staff/i.test(g))) return "institution_admin";
  if (groups.some((g) => /educator|teacher/i.test(g))) return "educator";
  if (groups.some((g) => /parent|guardian/i.test(g))) return "parent";
  return "learner";
}
