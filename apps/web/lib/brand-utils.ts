export type UniversityBrandId = "DEFAULT" | "NWU" | "UCT" | "UJ" | "WITS" | "UP";

export type BrandTheme = {
  id: UniversityBrandId;
  primary: string;
  secondary: string;
  primaryForeground: string;
  secondaryForeground: string;
  surface: string;
  border: string;
  displayFont: string;
  bodyFont: string;
};

// Ditshego Ventures house type. The institution themes are applied inline at
// runtime (and inline wins the cascade), so the house families must be the brand
// defaults here too — not just in CSS. These reference the next/font CSS variables
// defined on <html> (see app/layout.tsx); institution brand *colours* still vary.
const DISPLAY_FONT = 'var(--font-playfair), "Playfair Display", Georgia, serif';
const BODY_FONT = 'var(--font-archivo), "Archivo", system-ui, sans-serif';

const BRAND_MAP: Record<UniversityBrandId, BrandTheme> = {
  // House default = the SCHOOL/Scholar product itself: the Ditshego Ventures
  // signature gold→teal accent (drives primary CTAs and active rails). Antique
  // gold stays the precious accent via the --gold token. Specific universities
  // below keep their own real brand colours.
  DEFAULT: {
    id: "DEFAULT",
    primary: "#e8c15a",
    secondary: "#2DD4BF",
    // Dark label: the gold→teal gradient is light, so white text fails WCAG AA
    // on the teal end (~1.9:1). Navy ink clears AA across the whole gradient.
    primaryForeground: "#0a0a0a",
    secondaryForeground: "#0a0a0a",
    surface: "rgba(255, 255, 255, 0.05)",
    border: "rgba(255, 255, 255, 0.12)",
    displayFont: DISPLAY_FONT,
    bodyFont: BODY_FONT,
  },
  NWU: {
    id: "NWU",
    primary: "#e8c15a",
    secondary: "#00889C",
    primaryForeground: "#FFFFFF",
    secondaryForeground: "#F4FBFF",
    surface: "rgba(232, 193, 90, 0.14)",
    border: "rgba(232, 193, 90, 0.26)",
    displayFont: DISPLAY_FONT,
    bodyFont: BODY_FONT,
  },
  UCT: {
    id: "UCT",
    primary: "#003366",
    secondary: "#34ADA0",
    primaryForeground: "#FFFFFF",
    secondaryForeground: "#052B29",
    surface: "rgba(0, 51, 102, 0.16)",
    border: "rgba(52, 173, 160, 0.3)",
    displayFont: DISPLAY_FONT,
    bodyFont: BODY_FONT,
  },
  UJ: {
    id: "UJ",
    primary: "#D95900",
    secondary: "#F7B512",
    primaryForeground: "#FFFFFF",
    secondaryForeground: "#3A2500",
    surface: "rgba(217, 89, 0, 0.14)",
    border: "rgba(247, 181, 18, 0.28)",
    displayFont: DISPLAY_FONT,
    bodyFont: BODY_FONT,
  },
  WITS: {
    id: "WITS",
    primary: "#002F4A",
    secondary: "#D4AF37",
    primaryForeground: "#FFFFFF",
    secondaryForeground: "#2C2405",
    surface: "rgba(0, 47, 74, 0.16)",
    border: "rgba(212, 175, 55, 0.28)",
    displayFont: DISPLAY_FONT,
    bodyFont: BODY_FONT,
  },
  UP: {
    id: "UP",
    primary: "#CC0000",
    secondary: "#000066",
    primaryForeground: "#FFFFFF",
    secondaryForeground: "#F2F3FF",
    surface: "rgba(204, 0, 0, 0.14)",
    border: "rgba(0, 0, 102, 0.28)",
    displayFont: DISPLAY_FONT,
    bodyFont: BODY_FONT,
  },
};

const DOMAIN_MAP: Record<string, UniversityBrandId> = {
  "myuct.ac.za": "UCT",
  "uct.ac.za": "UCT",
  "nwu.ac.za": "NWU",
  "student.uj.ac.za": "UJ",
  "uj.ac.za": "UJ",
  "students.wits.ac.za": "WITS",
  "wits.ac.za": "WITS",
  "up.ac.za": "UP",
  "tuks.co.za": "UP",
};

function normalizeKey(value?: string | null) {
  return value?.trim().toUpperCase().replace(/[^A-Z]/g, "") ?? "";
}

function normalizeHex(value: string) {
  const trimmed = value.trim().replace("#", "");
  if (trimmed.length === 3) {
    return `#${trimmed
      .split("")
      .map((char) => char + char)
      .join("")}`.toUpperCase();
  }
  return `#${trimmed}`.toUpperCase();
}

function hexToRgb(hex: string) {
  const normalized = normalizeHex(hex).slice(1);
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function getChannelLuminance(channel: number) {
  const scaled = channel / 255;
  return scaled <= 0.03928 ? scaled / 12.92 : Math.pow((scaled + 0.055) / 1.055, 2.4);
}

export function getRelativeLuminance(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * getChannelLuminance(r) + 0.7152 * getChannelLuminance(g) + 0.0722 * getChannelLuminance(b);
}

export function getContrastRatio(firstHex: string, secondHex: string) {
  const first = getRelativeLuminance(firstHex);
  const second = getRelativeLuminance(secondHex);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

export function passesWcagAa(firstHex: string, secondHex: string, largeText = false) {
  return getContrastRatio(firstHex, secondHex) >= (largeText ? 3 : 4.5);
}

export function detectBrandByEmailDomain(email?: string | null): UniversityBrandId | null {
  if (!email || !email.includes("@")) return null;
  const domain = email.split("@").pop()?.trim().toLowerCase();
  if (!domain) return null;

  for (const [candidate, brand] of Object.entries(DOMAIN_MAP)) {
    if (domain === candidate || domain.endsWith(`.${candidate}`)) {
      return brand;
    }
  }

  return null;
}

export function getBrandTheme(universityId?: string | null): BrandTheme {
  const key = normalizeKey(universityId);
  if (key in BRAND_MAP) {
    return BRAND_MAP[key as UniversityBrandId];
  }

  if (key.includes("NORTHWEST") || key.includes("NWU")) return BRAND_MAP.NWU;
  if (key.includes("UCT") || key.includes("CAPETOWN")) return BRAND_MAP.UCT;
  if (key === "UJ" || key.includes("JOHANNESBURG")) return BRAND_MAP.UJ;
  if (key.includes("WITS") || key.includes("WITWATERSRAND")) return BRAND_MAP.WITS;
  if (key === "UP" || key.includes("PRETORIA") || key.includes("TUKS")) return BRAND_MAP.UP;

  return BRAND_MAP.DEFAULT;
}

export function applyBrandTheme(brand: BrandTheme) {
  if (typeof document === "undefined") return brand;
  const root = document.documentElement;
  root.style.setProperty("--brand-primary", brand.primary);
  root.style.setProperty("--brand-secondary", brand.secondary);
  root.style.setProperty("--brand-primary-foreground", brand.primaryForeground);
  root.style.setProperty("--brand-secondary-foreground", brand.secondaryForeground);
  root.style.setProperty("--brand-surface", brand.surface);
  root.style.setProperty("--brand-border", brand.border);
  root.style.setProperty("--font-display", brand.displayFont);
  root.style.setProperty("--font-body", brand.bodyFont);
  root.style.setProperty("--institution-primary", brand.primary);
  root.style.setProperty("--institution-secondary", brand.secondary);
  return brand;
}

export const UNIVERSITY_BRANDS = BRAND_MAP;
