import { detectBrandByEmailDomain, getBrandTheme } from "@/lib/brand-utils";

export type InstitutionThemeId = "default" | "nwu" | "uct" | "uj" | "wits" | "up";

export interface InstitutionThemeInput {
  slug?: string | null;
  shortName?: string | null;
  name?: string | null;
  domain?: string | null;
  email?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
}

export interface InstitutionThemeTokens {
  slug: InstitutionThemeId;
  primary: string;
  secondary: string;
  surface: string;
  border: string;
  textOnPrimary: string;
  textOnSecondary: string;
  displayFont: string;
  bodyFont: string;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function isValidHex(value: string | null | undefined): value is string {
  return typeof value === "string" && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim());
}

function normalizeHex(value: string) {
  const trimmed = value.trim();
  if (trimmed.length === 4) {
    return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`.toUpperCase();
  }
  return trimmed.toUpperCase();
}

function hexToRgb(value: string) {
  const normalized = normalizeHex(value).slice(1);
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function toRgba(value: string, alpha: number) {
  const { r, g, b } = hexToRgb(value);
  return `rgba(${r}, ${g}, ${b}, ${clamp(alpha, 0, 1)})`;
}

function getContrastText(value: string) {
  const { r, g, b } = hexToRgb(value);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 160 ? "#0a0a0a" : "#FFFFFF";
}

function normalizeInstitutionToken(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

export function deriveInstitutionThemeId(input?: string | null | InstitutionThemeInput): InstitutionThemeId {
  const emailBrand = typeof input === "string" ? null : detectBrandByEmailDomain(input?.email);
  const candidates =
    typeof input === "string"
      ? [input]
      : [emailBrand, input?.slug, input?.shortName, input?.domain, input?.name];

  const normalized = candidates
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map(normalizeInstitutionToken)
    .join(" ");

  if (normalized.includes("north-west-university") || normalized.includes("nwu")) return "nwu";
  if (normalized.includes("university-of-cape-town") || normalized.includes("uct")) return "uct";
  if (normalized.includes("university-of-johannesburg") || normalized.includes("uj")) return "uj";
  if (normalized.includes("witwatersrand") || normalized.includes("wits")) return "wits";
  if (normalized.includes("university-of-pretoria") || normalized.includes("up")) return "up";
  return "default";
}

export function resolveInstitutionTheme(input?: string | null | InstitutionThemeInput): InstitutionThemeTokens {
  const slug = deriveInstitutionThemeId(input);
  const baseBrand = getBrandTheme(slug);

  if (!input || typeof input === "string") {
    return {
      slug,
      primary: baseBrand.primary,
      secondary: baseBrand.secondary,
      surface: baseBrand.surface,
      border: baseBrand.border,
      textOnPrimary: baseBrand.primaryForeground,
      textOnSecondary: baseBrand.secondaryForeground,
      displayFont: baseBrand.displayFont,
      bodyFont: baseBrand.bodyFont,
    };
  }

  const primary = isValidHex(input.primaryColor) ? normalizeHex(input.primaryColor) : baseBrand.primary;
  const secondary = isValidHex(input.secondaryColor) ? normalizeHex(input.secondaryColor) : baseBrand.secondary;

  return {
    slug,
    primary,
    secondary,
    surface: toRgba(primary, 0.14),
    border: toRgba(primary, 0.28),
    textOnPrimary: getContrastText(primary),
    textOnSecondary: getContrastText(secondary),
    displayFont: baseBrand.displayFont,
    bodyFont: baseBrand.bodyFont,
  };
}

function setProperty(root: HTMLElement, property: string, value: string) {
  root.style.setProperty(property, value);
}

export function applyTheme(input?: string | null | InstitutionThemeInput) {
  const theme = resolveInstitutionTheme(input);

  if (typeof document === "undefined") {
    return theme;
  }

  const root = document.documentElement;
  root.dataset.inst = theme.slug;
  setProperty(root, "--inst-primary", theme.primary);
  setProperty(root, "--inst-secondary", theme.secondary);
  setProperty(root, "--inst-surface", theme.surface);
  setProperty(root, "--inst-border", theme.border);
  setProperty(root, "--inst-text-on-p", theme.textOnPrimary);
  setProperty(root, "--brand-primary", theme.primary);
  setProperty(root, "--brand-secondary", theme.secondary);
  setProperty(root, "--brand-primary-foreground", theme.textOnPrimary);
  setProperty(root, "--brand-secondary-foreground", theme.textOnSecondary);
  setProperty(root, "--brand-surface", theme.surface);
  setProperty(root, "--brand-border", theme.border);
  setProperty(root, "--font-display", theme.displayFont);
  setProperty(root, "--font-body", theme.bodyFont);
  setProperty(root, "--institution-primary", theme.primary);
  setProperty(root, "--institution-secondary", theme.secondary);

  return theme;
}

export function resetTheme() {
  return applyTheme("default");
}

export const applyInstitutionTheme = applyTheme;
export const resetInstitutionTheme = resetTheme;
