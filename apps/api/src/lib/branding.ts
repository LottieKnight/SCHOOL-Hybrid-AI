// apps/api/src/lib/branding.ts
//
// Per-institution white-label branding (Phase 2.3).
//
// Contract holders on E2+ can configure how the auth surface and web app are
// named/looked when their users sign in. `institution_settings.branding` is a
// free-form JSONB whose trusted shape is defined here; missing fields fall back
// to a coherent default theme so every tenant renders something professional
// even without configuration.

import { pool } from "../db/pool.js";

export interface Branding {
  name: string;
  tagline: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontFamily: string;
  loginHeroText: string;
  supportEmail: string | null;
  /** Optional favicon HTML / SVG. */
  faviconSvg: string | null;
}

export const DEFAULT_BRANDING: Branding = {
  name: "SCHOOL",
  tagline: "Learn anything. Achieve everything.",
  logoUrl: null,
  primaryColor: "#0f766e",   // emerald-700
  secondaryColor: "#0d9488", // teal-600
  accentColor: "#f59e0b",    // amber-500
  fontFamily: "Inter, system-ui, sans-serif",
  loginHeroText: "Welcome back — continue your learning journey.",
  supportEmail: null,
  faviconSvg: null,
};

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

/**
 * Sanitise an untrusted JSONB `branding` blob against the typed spec. Returns a
 * fully-populated, safe Branding (bad/unsafe values dropped, defaults applied).
 */
export function sanitizeBranding(raw: unknown): Branding {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const sval = (v: unknown, def: string, max = 300): string =>
    typeof v === "string" && v.trim() && v.trim().length <= max ? v.trim() : def;
  const color = (v: unknown, def: string): string =>
    typeof v === "string" && HEX_RE.test(v) ? v.toLowerCase() : def;
  const svg = (v: unknown): string | null =>
    typeof v === "string" && v.startsWith("<svg") && v.includes("</svg>") && v.length <= 4000 ? v : null;
  const email = (v: unknown): string | null =>
    typeof v === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length <= 254 ? v : null;

  return {
    name: sval(r.name, DEFAULT_BRANDING.name),
    tagline: sval(r.tagline, DEFAULT_BRANDING.tagline),
    logoUrl: sval(r.logoUrl, DEFAULT_BRANDING.logoUrl ?? "", 2000) || null,
    primaryColor: color(r.primaryColor, DEFAULT_BRANDING.primaryColor),
    secondaryColor: color(r.secondaryColor, DEFAULT_BRANDING.secondaryColor),
    accentColor: color(r.accentColor, DEFAULT_BRANDING.accentColor),
    fontFamily: sval(r.fontFamily, DEFAULT_BRANDING.fontFamily, 200),
    loginHeroText: sval(r.loginHeroText, DEFAULT_BRANDING.loginHeroText, 500),
    supportEmail: email(r.supportEmail),
    faviconSvg: svg(r.faviconSvg),
  };
}

function parseStoredBranding(row: { branding: unknown; name: string; custom_domain: string | null }): Branding {
  return sanitizeBranding(row.branding ?? {});
}

/**
 * Resolve branding for an institution by host. Mirrors the SSO host resolution
 * so a public world (web login page) and authenticated admin surface agree on
 * which tenant is being addressed:
 *   1. exact custom_domain match on the host, else
 *   2. bare subdomain (e.g. nwu.school.ac.za -> nwu).
 * Returns null when no institution matches (caller falls back to default).
 */
export async function resolveInstitutionByHost(host: string): Promise<{ id: string; name: string } | null> {
  const clean = (host || "").replace(/:\d+$/, "").toLowerCase();
  if (!clean) return null;

  // 1. exact custom_domain match
  const byDomain = await pool.query(
    `SELECT i.id::text, i.name
     FROM institution_settings s JOIN institutions i ON i.id = s.institution_id
     WHERE lower(s.custom_domain) = $1 AND i.is_active = TRUE`,
    [clean]
  );
  if (byDomain.rows[0]) return byDomain.rows[0];

  // 2. bare subdomain (skip platform-reserved labels)
  const sub = clean.split(".")[0];
  if (!sub || ["school", "www", "app", "localhost", "api"].includes(sub)) return null;
  const bySub = await pool.query(
    `SELECT i.id::text, i.name
     FROM institutions i
     WHERE (lower(i.domain) = $1 OR lower(i.short_name) = $1) AND i.is_active = TRUE`,
    [sub]
  );
  if (bySub.rows[0]) return bySub.rows[0];

  return null;
}

/** Fetch+normalise branding for an institution id (undefined settings -> default). */
export async function getInstitutionBranding(institutionId: string): Promise<Branding | null> {
  const result = await pool.query(
    `SELECT s.branding, i.name, s.custom_domain
     FROM institutions i
     LEFT JOIN institution_settings s ON s.institution_id = i.id
     WHERE i.id = $1 AND i.is_active = TRUE`,
    [institutionId]
  );
  const row = result.rows[0];
  if (!row) return null;
  const b = parseStoredBranding(row);
  if ((!b.name || b.name === DEFAULT_BRANDING.name) && row.name) b.name = row.name;
  return b;
}