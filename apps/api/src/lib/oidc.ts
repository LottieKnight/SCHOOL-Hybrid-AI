// apps/api/src/lib/oidc.ts
//
// OpenID Connect (OIDC) Service Provider client used for enterprise SSO via
// Google Workspace and Microsoft Entra ID. Implements the authorization code
// flow:
//
//   1. SP builds the authorize URL (client_id, redirect_uri, scope, state,
//      nonce, PKCE).
//   2. User authenticates at the IdP and is redirected back to our callback.
//   3. SP exchanges the code for tokens at the token endpoint.
//   4. SP verifies the ID token signature/JWT with the provider's JWKS (jose)
//      and validates issuer, audience, nonce, and expiry.
//   5. Provider profile (from ID token claims + optional userinfo) is mapped
//      to SCHOOL's user model.
//
// Supports Google and Microsoft Entra ID (OIDC). For ADFS/SAML the SAML module
// is used instead.
import crypto from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { z } from "zod";
import { config } from "../config.js";

export type OidcProviderName = "google" | "microsoft";

export type OidcConfig = {
  provider: OidcProviderName;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  issuer?: string;
  authorizeEndpoint?: string;
  tokenEndpoint?: string;
  userinfoEndpoint?: string;
  jwksUri?: string;
  // Microsoft allows a tenant segment, e.g. "common" (multi-tenant) or a
  // specific tenant id / "organizations".
  tenant?: string;
  // SSO-scoped groups claim (Microsoft / Google) for role mapping.
  groupsClaim?: string;
};

export type OidcUser = {
  email: string;
  firstName: string;
  lastName: string;
  groups?: string[];
  role?: string;
  sub?: string;
  picture?: string;
};

const MS_TEMPLATE = (tenant: string) => `https://login.microsoftonline.com/${tenant}/v2.0`;

/**
 * Provider default discovery URLs. Microsoft Entra uses well-known OpenID
 * configuration; Google publishes the same document.
 */
async function discover(provider: OidcProviderName, tenant?: string): Promise<{
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
  jwks_uri: string;
}> {
  if (provider === "google") {
    const doc = await (await fetch("https://accounts.google.com/.well-known/openid-configuration")).json();
    return {
      issuer: doc.issuer,
      authorization_endpoint: doc.authorization_endpoint,
      token_endpoint: doc.token_endpoint,
      userinfo_endpoint: doc.userinfo_endpoint,
      jwks_uri: doc.jwks_uri,
    };
  }
  const tenantId = tenant || "common";
  const configUrl = `${MS_TEMPLATE(tenantId)}/.well-known/openid-configuration`;
  const doc = await (await fetch(configUrl)).json();
  return {
    issuer: doc.issuer,
    authorization_endpoint: doc.authorization_endpoint,
    token_endpoint: doc.token_endpoint,
    userinfo_endpoint: doc.userinfo_endpoint,
    jwks_uri: doc.jwks_uri,
  };
}

async function getEndpoints(cfg: OidcConfig) {
  // Pre-configured endpoints win; otherwise discover.
  if (
    cfg.issuer &&
    cfg.authorizeEndpoint &&
    cfg.tokenEndpoint &&
    cfg.jwksUri
  ) {
    return {
      issuer: cfg.issuer,
      authorization_endpoint: cfg.authorizeEndpoint,
      token_endpoint: cfg.tokenEndpoint,
      userinfo_endpoint: cfg.userinfoEndpoint ?? "",
      jwks_uri: cfg.jwksUri,
    };
  }
  return discover(cfg.provider, cfg.tenant);
}

/**
 * Build the authorization URL. Uses PKCE (S256) so we never need a secret on
 * the authorize redirect; matches the code_verifier with the token exchange.
 */
export async function buildAuthorizeUrl(
  cfg: OidcConfig,
  opts: { state?: string; nonce?: string }
): Promise<{ url: string; codeVerifier: string }> {
  const ep = await getEndpoints(cfg);
  const state = opts.state ?? crypto.randomBytes(16).toString("hex");
  const nonce = opts.nonce ?? crypto.randomBytes(16).toString("hex");
  const codeVerifier = crypto.randomBytes(48).toString("base64url");
  const codeChallenge = crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");

  const params = new URLSearchParams({
    client_id: cfg.clientId,
    response_type: "code",
    redirect_uri: cfg.redirectUri,
    scope: "openid email profile",
    state,
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  });

  // Microsoft supports a selected tenant hint to avoid tenant ambiguity.
  if (cfg.provider === "microsoft" && cfg.tenant && cfg.tenant !== "common") {
    params.set("domain_hint", cfg.tenant.replace(/^[a-z]+/, (m) => m.toLowerCase()));
  }

  const url = `${ep.authorization_endpoint}?${params.toString()}`;
  return { url, codeVerifier };
}

/**
 * Exchange the authorization code for an ID token and verify it.
 */
export async function processCallback(
  cfg: OidcConfig,
  input: { code: string; codeVerifier: string; expectedState: string; state?: string; nonce: string; expectedNonce: string; redirectUri: string }
): Promise<OidcUser> {
  if (input.state !== input.expectedState) {
    throw new Error("OIDC state mismatch (CSRF)");
  }
  if (input.expectedNonce && input.nonce !== input.expectedNonce) {
    throw new Error("OIDC nonce mismatch (replay protection)");
  }

  const ep = await getEndpoints(cfg);

  // 1. Token exchange
  const tokenRes = await fetch(ep.token_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: input.code,
      redirect_uri: input.redirectUri,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      code_verifier: input.codeVerifier,
    }),
  });
  if (!tokenRes.ok) {
    const body = await tokenRes.text();
    throw new Error(`OIDC token exchange failed (${tokenRes.status}): ${body.slice(0, 200)}`);
  }
  const tokens: any = await tokenRes.json();
  if (!tokens.id_token) {
    throw new Error("OIDC token response missing id_token");
  }

  // 2. Verify ID token signature + claims via JWKS
  const jwks = createRemoteJWKSet(new URL(ep.jwks_uri));
  const { payload } = await jwtVerify(tokens.id_token, jwks, {
    issuer: normalizeIssuer(ep.issuer),
    audience: cfg.clientId,
    clockTolerance: 60,
  });

  // 3. Enrich via userinfo if available (esp. Microsoft groups/roles)
  let userInfo: any = {};
  if (ep.userinfo_endpoint) {
    try {
      const uiRes = await fetch(ep.userinfo_endpoint, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      if (uiRes.ok) userInfo = await uiRes.json();
    } catch {
      // userinfo is best-effort
    }
  }

  return mapOidcUser(payload, userInfo, cfg);
}

function normalizeIssuer(iss: string): string {
  // Accept both trailing-slash and non-trailing-slash forms.
  const trimmed = iss.replace(/\/$/, "");
  return iss.endsWith("/") ? trimmed : trimmed;
}

function mapOidcUser(idToken: any, userInfo: any, cfg: OidcConfig): OidcUser {
  const src = Object.keys(userInfo).length ? userInfo : idToken;
  const email =
    src.email ||
    src.upn ||
    src.preferred_username ||
    idToken.email ||
    "";
  const firstName =
    src.given_name ||
    src.givenName ||
    idToken.given_name ||
    (idToken.name ? idToken.name.split(" ")[0] : "") ||
    "";
  const lastName =
    src.family_name ||
    src.surname ||
    idToken.family_name ||
    (idToken.name ? idToken.name.split(" ").slice(1).join(" ") : "") ||
    "";

  const groupsClaim = cfg.groupsClaim || "groups";
  let groups: string[] = [];
  const g = src[groupsClaim] ?? idToken[groupsClaim];
  if (Array.isArray(g)) groups = g.filter((x: any) => typeof x === "string");
  else if (typeof g === "string") groups = g.split(",").map((x: string) => x.trim()).filter(Boolean);
  // Microsoft sends group object IDs (not names) by default, so also accept
  // roles claim for role inference.
  const roles = Array.isArray(idToken.roles) ? idToken.roles : [];

  return {
    email: String(email).toLowerCase(),
    firstName: String(firstName || "OIDC"),
    lastName: String(lastName || "User"),
    groups,
    role: inferOidcRole(groups, roles),
    sub: src.sub || idToken.sub,
    picture: src.picture,
  };
}

function inferOidcRole(groups: string[], roles: unknown[]): string | undefined {
  const pool = [...groups, ...roles.map((r) => String(r))];
  if (pool.some((g) => /admin|staff/i.test(g))) return "institution_admin";
  if (pool.some((g) => /educator|teacher/i.test(g))) return "educator";
  if (pool.some((g) => /parent|guardian/i.test(g))) return "parent";
  return undefined;
}

// -------------------- Config resolution --------------------

export const oidcConfigSchema = z.object({
  provider: z.enum(["google", "microsoft"]),
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  redirectUri: z.string().url(),
  issuer: z.string().optional(),
  authorizeEndpoint: z.string().url().optional(),
  tokenEndpoint: z.string().url().optional(),
  userinfoEndpoint: z.string().url().optional(),
  jwksUri: z.string().url().optional(),
  tenant: z.string().optional(),
  groupsClaim: z.string().optional(),
});

/** Resolve an OIDC config from institution_settings.sso_config. */
export function resolveOidcConfig(raw: Record<string, unknown> | undefined | null): OidcConfig | null {
  if (!raw || raw.provider !== "google" && raw.provider !== "microsoft") return null;
  const parsed = oidcConfigSchema.safeParse(raw);
  if (!parsed.success) return null;
  const c = parsed.data;
  return {
    provider: c.provider,
    clientId: c.clientId,
    clientSecret: c.clientSecret,
    redirectUri: c.redirectUri ?? `${config.appUrl}/sso/callback`,
    issuer: c.issuer,
    authorizeEndpoint: c.authorizeEndpoint,
    tokenEndpoint: c.tokenEndpoint,
    userinfoEndpoint: c.userinfoEndpoint,
    jwksUri: c.jwksUri,
    tenant: c.tenant,
    groupsClaim: c.groupsClaim,
  };
}
