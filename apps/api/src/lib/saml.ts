// apps/api/src/lib/saml.ts
//
// SAML 2.0 Service Provider integration built on @node-saml/node-saml
// (the reference Node.js SAML implementation) for the security-critical
// verification work: XML canonicalisation (exclusive C14N), xmldsig signature
// verification, assertion/conditions validation, and single logout.
//
// Responsibilities here:
//   - wrapping node-saml's SAML class per-institution configuration
//   - SP metadata + AuthnRequest helpers
//   - mapping the validated SAML profile to SCHOOL's user model
//   - resolving per-institution SAML config from institution_settings
import { SAML, ValidateInResponseTo } from "@node-saml/node-saml";
import { z } from "zod";
import { config } from "../config.js";

export type SamlConfig = {
  entityId: string;
  callbackUrl: string;
  entryPoint: string;
  issuer: string;
  idpCert: string; // IdP signing certificate (PEM or base64)
  identifierFormat?: string;
  logoutCallbackUrl?: string;
  wantAssertionsSigned?: boolean;
  signatureAlgorithm?: string;
};

export type SamlUser = {
  email: string;
  firstName: string;
  lastName: string;
  groups?: string[];
  role?: string;
  nameId?: string;
  sessionIndex?: string;
};

/**
 * Build a node-saml SAML service-provider instance for a given institution.
 */
export function createSamlProvider(cfg: SamlConfig): SAML {
  return new SAML({
    callbackUrl: cfg.callbackUrl,
    entryPoint: cfg.entryPoint,
    issuer: cfg.issuer,
    cert: cfg.idpCert,
    identifierFormat: cfg.identifierFormat ?? "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
    wantAssertionsSigned: cfg.wantAssertionsSigned ?? true,
    wantAuthnResponseSigned: true,
    acceptedClockSkewMs: 5 * 60 * 1000, // 5 minutes
    validateInResponseTo: ValidateInResponseTo.always,
    signatureAlgorithm: (cfg.signatureAlgorithm ?? "sha256") as "sha1" | "sha256" | "sha512",
    logoutCallbackUrl: cfg.logoutCallbackUrl,
    // SAML bindings we support
    authnRequestBinding: "HTTP-REDIRECT",
    additionalParams: {},
    additionalAuthorizeParams: {},
    additionalLogoutParams: {},
    allowCreate: true,
    disableRequestedAuthnContext: false,
    forceAuthn: false,
    skipRequestCompression: false,
    passive: false,
    providerName: "SCHOOL Technologies",
  });
}

/**
 * Generate the SP metadata XML document for a given institution.
 */
export function generateSpMetadata(cfg: SamlConfig): string {
  const provider = createSamlProvider(cfg);
  return provider.generateServiceProviderMetadata(null, [cfg.idpCert]);
}

/**
 * Build the redirect URL for SP-initiated login.
 */
export async function buildAuthorizeUrl(cfg: SamlConfig, relayState?: string): Promise<string> {
  const provider = createSamlProvider(cfg);
  return provider.getAuthorizeUrlAsync(relayState ?? "", undefined, {});
}

/**
 * Validate a POST-bound SAML Response and map the profile to a SCHOOL user.
 */
export async function processPostResponse(
  cfg: SamlConfig,
  body: Record<string, string>
): Promise<{ user: SamlUser; profile: any; loggedOut: boolean }> {
  const provider = createSamlProvider(cfg);
  const { profile, loggedOut } = await provider.validatePostResponseAsync(body);
  if (loggedOut) return { user: null as any, profile: null, loggedOut: true };

  const user = mapProfileToUser(profile);
  if (!user.email) {
    throw new Error("SAML response contained no user email address");
  }
  return { user, profile, loggedOut };
}

/**
 * Validate a Redirect-bound SAML logout (SLO).
 */
export async function validateRedirect(
  cfg: SamlConfig,
  parsedQuery: Record<string, string>,
  originalQuery: string
): Promise<{ profile: any; loggedOut: boolean }> {
  const provider = createSamlProvider(cfg);
  return provider.validateRedirectAsync(parsedQuery, originalQuery);
}

/**
 * Build logout URL (SP-initiated SLO).
 */
export async function buildLogoutUrl(cfg: SamlConfig, nameId: string, sessionIndex?: string): Promise<string> {
  const provider = createSamlProvider(cfg);
  return provider.getLogoutUrlAsync(
    { nameID: nameId, nameIDFormat: cfg.identifierFormat ?? "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress", sessionIndex } as any,
    "",
    {}
  );
}

/**
 * Map a node-saml profile to SCHOOL's user model. node-saml flattens SAML
 * attributes into `profile[claim]` using common claim URIs.
 */
function mapProfileToUser(profile: any): SamlUser {
  const p = profile ?? {};
  const email = pick(p, "email", "mail", "nameID", "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress");
  const firstName = pick(p, "first_name", "firstName", "givenName", "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname") || "SSO";
  const lastName = pick(p, "last_name", "lastName", "surname", "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname") || "";
  const groupsRaw = pick(p, "groups", "group", "memberOf", "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/groups");
  const groups = groupsRaw ? String(groupsRaw).split(",").map((g) => g.trim()).filter(Boolean) : [];

  return {
    email: String(email ?? "").toLowerCase(),
    firstName: String(firstName),
    lastName: String(lastName),
    groups,
    role: typeof p.role === "string" ? p.role : inDangerousGroups(groups) ? "institution_admin" : undefined,
    nameId: p.nameID ? String(p.nameID) : undefined,
    sessionIndex: p.sessionIndex ? String(p.sessionIndex) : undefined,
  };
}

function pick(obj: any, ...keys: string[]): string {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null) return typeof v === "string" ? v : String(v);
  }
  return "";
}

function inDangerousGroups(groups: string[]): boolean {
  return groups.some((g) => /admin|staff|educator|teacher/i.test(g));
}

// -------------------- Config resolution --------------------

export const samlConfigSchema = z.object({
  entityId: z.string().min(1),
  callbackUrl: z.string().url(),
  entryPoint: z.string().url(),
  issuer: z.string().min(1),
  idpCert: z.string().min(1),
  identifierFormat: z.string().optional(),
  logoutCallbackUrl: z.string().url().optional(),
  wantAssertionsSigned: z.boolean().optional(),
  signatureAlgorithm: z.string().optional(),
});

/** Convert the free-form JSONB from institution_settings into a typed SamlConfig. */
export function resolveSamlConfig(institutionConfig: Record<string, unknown> | undefined | null): SamlConfig | null {
  if (!institutionConfig) return null;
  const parsed = samlConfigSchema.safeParse(institutionConfig);
  if (!parsed.success) return null;
  const c = parsed.data;
  return {
    entityId: c.entityId,
    callbackUrl: c.callbackUrl,
    entryPoint: c.entryPoint,
    issuer: c.issuer,
    idpCert: c.idpCert,
    identifierFormat: c.identifierFormat,
    logoutCallbackUrl: c.logoutCallbackUrl ?? `${config.appUrl}/sso/slo`,
    wantAssertionsSigned: c.wantAssertionsSigned,
    signatureAlgorithm: c.signatureAlgorithm,
  };
}

/** Default SP metadata when no per-institution SAML is configured. */
export function defaultSpMetadata(): string {
  return generateSpMetadata({
    entityId: `${config.appUrl}/sso/metadata`,
    callbackUrl: `${config.appUrl}/sso/acs`,
    entryPoint: "https://placeholder-idp.invalid/sso",
    issuer: config.appUrl,
    idpCert: "__unconfigured__",
  });
}
