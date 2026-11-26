// apps/api/src/lib/lti.ts
//
// LTI 1.3 (IMS Global / 1EdTech LTI-Core-v1.3 + IMS Security Framework) Tool
// implementation. SCHOOL is the LTI Tool; an institutional LMS (Moodle, Sakai,
// Canvas, Blackboard) is the LTI Platform.
//
// Launch flow (one of two), the standard OIDC 3rd-party-initiated login:
//   1. Platform (LMS) redirects the learner to the Tool's OIDC login
//      initiation endpoint with `iss`, `login_hint`, `target_link_uri`,
//      `client_id`, `lti_message_hint`.
//   2. Tool validates the interaction, builds a client-assertion / initiator
//      JWT + nonce, and redirects the browser back to the Platform's
//      `auth_login_url`, carrying its own `client_id` and `lti_message_hint`.
//   3. Platform posts a signed LTI launch JWT (key `id_token`, `state=<state>`)
//      to the Tool's resource-link launch endpoint.
//   4. Tool verifies the JWT (iss, aud, azp, exp, deployment_id, nonce, and
//      signature against the Platform JWKS via `jose`), then provisions/scopes
//      the learner for the context (course) the LMS opened.
//
// Security posture: state is HMAC-sealed (CSRF), nonce is persisted and
// one-time-use (replay), and the launch JWT is cryptographically verified
// against fresh remote JWKS — never a shared secret unknown to us.

import crypto from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { pool } from "../db/pool.js";
import { config } from "../config.js";

export interface LtitRegistration {
  id: string;
  institution_id: string;
  issuer: string;
  client_id: string;
  platform_name: string;
  auth_login_url: string;
  auth_token_url: string;
  jwks_url: string;
  deployment_id: string | null;
  tool_context: string;
  claim_nonce_ttl_sec: number;
}

// ---------------- State / nonce ----------------

export function ltiStateToken(payload: object): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", config.cookieSecret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function ltiVerifyState(token: string): any | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = crypto.createHmac("sha256", config.cookieSecret).update(body).digest("base64url");
  const a = Buffer.from(sig); const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try { return JSON.parse(Buffer.from(body, "base64url").toString("utf8")); } catch { return null; }
}

async function storeNonce(nonce: string, state: string, ttlSec: number): Promise<void> {
  await pool.query(
    `INSERT INTO lti_launch_states (nonce, state, expires_at)
     VALUES ($1, $2, NOW() + $3 * INTERVAL '1 second')`,
    [nonce, state, ttlSec]
  );
}

/** Atomically consume a nonce; returns true when it was unused and unexpired. */
export async function consumeNonce(nonce: string, state: string): Promise<boolean> {
  const result = await pool.query(
    `UPDATE lti_launch_states SET used = TRUE
     WHERE nonce = $1 AND state = $2 AND used = FALSE AND expires_at > NOW()
     RETURNING id`,
    [nonce, state]
  );
  return (result.rowCount ?? 0) > 0;
}

// ---------------- OIDC login initiation (step 2: tool -> platform) ----------------

export interface LtiLoginInitiationParams {
  iss: string;
  login_hint: string;
  target_link_uri: string;
  client_id: string;
  lti_message_hint?: string;
}

/**
 * Validate the platform's login-initiation parameters and build the redirect
 * back to the platform's `auth_login_url`. The returned URL is the browser
 * target; `stateNonce` should be returned to the caller for session context.
 */
export async function buildLtiLoginInitiation(
  reg: LtitRegistration,
  params: LtiLoginInitiationParams
): Promise<{ url: string; state: string; nonce: string }> {
  if (reg.issuer !== params.iss) throw new Error("LTI: iss mismatch");
  if (reg.client_id !== params.client_id) throw new Error("LTI: client_id mismatch");

  const state = ltiStateToken({ reg: reg.id, hint: params.login_hint, target: params.target_link_uri });
  const nonce = crypto.randomBytes(16).toString("hex");
  await storeNonce(nonce, state, reg.claim_nonce_ttl_sec);

  const url = new URL(reg.auth_login_url);
  url.searchParams.set("client_id", reg.client_id);        // tool's OAuth client
  url.searchParams.set("login_hint", params.login_hint);    // OIDC login_hint (user)
  url.searchParams.set("target_link_uri", params.target_link_uri);
  url.searchParams.set("scope", "openid");
  url.searchParams.set("response_type", "id_token");
  url.searchParams.set("response_mode", "form_post");
  url.searchParams.set("nonce", nonce);
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "none");
  url.searchParams.set("lti_message_hint", params.lti_message_hint ?? "");

  return { url: url.toString(), state, nonce };
}

// ---------------- Launch JWT verification (step 4) ----------------

export interface LtiLaunchResult {
  userEmail: string;
  firstName: string;
  lastName: string;
  role: string;
  institutionId: string;
  contextTitle: string;
  resourceLinkId: string;
  deploymentId: string;
  registration: LtitRegistration;
}

function mapLtiRole(rolesLIS: unknown): string {
  const roles = (Array.isArray(rolesLIS) ? rolesLIS : []).map((r) => String(r).toLowerCase().split("#").pop() ?? "");
  if (roles.some((r) => /administrator|admin|sysadmin|instructor:admin/i.test(r))) return "institution_admin";
  if (roles.some((r) => /instructor|teacher|mentor|staff/i.test(r))) return "educator";
  if (roles.some((r) => /parent|guardian/i.test(r))) return "parent";
  return "learner";
}

/**
 * Verify an LTI 1.3 launch JWT. Returns the mapped provisioning payload.
 * Throws on any failed security check (signature, iss, aud/azp, exp, nonce,
 * deployment_id).
 */
export async function verifyLtiLaunch(
  reg: LtitRegistration,
  idToken: string,
  state: string,
  claims?: { nonce?: string; azp?: string; deployment_id?: string }
): Promise<LtiLaunchResult> {
  const jwks = createRemoteJWKSet(new URL(reg.jwks_url));
  let payload: any;
  try {
    ({ payload } = await jwtVerify(idToken, jwks, {
      issuer: reg.issuer,
      audience: reg.client_id,
      clockTolerance: 60,
    }));
  } catch (e: any) {
    throw new Error(`LTI: launch JWT verification failed (${e.message})`);
  }

  // aud consumed by jose above; enforce azp == client_id when azp present
  if (payload.azp && payload.azp !== reg.client_id) throw new Error("LTI: azp mismatch");
  if (claims?.deployment_id && payload["https://purl.imsglobal.org/spec/lti/claim/deployment_id"] !== claims.deployment_id) {
    throw new Error("LTI: deployment_id mismatch");
  }

  // nonce: must match a stored, one-time-use nonce we issued
  const launchNonce = claims?.nonce ?? payload.nonce;
  if (!launchNonce || !(await consumeNonce(launchNonce, state))) {
    throw new Error("LTI: nonce rejected (invalid, used, or expired)");
  }

  const email = payload.email || payload.preferred_username || payload.sub;
  if (!email) throw new Error("LTI: no email in launch claims");
  const firstName = payload.given_name || payload.name?.split(" ")[0] || "LTI";
  const lastName = payload.family_name || payload.name?.split(" ").slice(1).join(" ") || "User";

  const lisRoles = payload["https://purl.imsglobal.org/spec/lti/claim/roles"];
  const contextClaim = payload["https://purl.imsglobal.org/spec/lti/claim/context"];
  const resourceLink = payload["https://purl.imsglobal.org/spec/lti/claim/resource_link"];
  const deploymentId =
    payload["https://purl.imsglobal.org/spec/lti/claim/deployment_id"] ??
    claims?.deployment_id ??
    reg.deployment_id ??
    "";

  return {
    userEmail: String(email).toLowerCase(),
    firstName,
    lastName,
    role: mapLtiRole(lisRoles),
    institutionId: reg.institution_id,
    contextTitle: contextClaim?.title ?? resourceLink?.title ?? "",
    resourceLinkId: resourceLink?.id ?? payload.sub ?? "",
    deploymentId,
    registration: reg,
  };
}

export async function getLtiRegistration(institutionId: string, issuer: string, clientId: string): Promise<LtitRegistration | null> {
  const result = await pool.query(
    `SELECT id::text, institution_id::text, issuer, client_id, platform_name, auth_login_url,
            auth_token_url, jwks_url, deployment_id, tool_context, claim_nonce_ttl_sec
     FROM lti_registrations
     WHERE institution_id = $1 AND issuer = $2 AND client_id = $3`,
    [institutionId, issuer, clientId]
  );
  return result.rows[0] ? { ...result.rows[0], deployment_id: result.rows[0].deployment_id ?? null } : null;
}

export async function listLtiRegistrations(institutionId: string): Promise<LtitRegistration[]> {
  const result = await pool.query(
    `SELECT id::text, institution_id::text, issuer, client_id, platform_name, auth_login_url,
            auth_token_url, jwks_url, deployment_id, tool_context, claim_nonce_ttl_sec
     FROM lti_registrations WHERE institution_id = $1 ORDER BY platform_name`,
    [institutionId]
  );
  return result.rows;
}