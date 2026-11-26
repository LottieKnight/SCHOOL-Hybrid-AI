import type { InstitutionCode, ThemeName } from "../store/themeStore";

export type ColorTokens = {
  background: string;
  backgroundDeep: string;
  surface: string;
  surface2: string;
  surface3: string;
  card: string;
  border: string;
  text: string;
  textMuted: string;
  textSoft: string;
  gold: string;
  goldStrong: string;
  green: string;
  red: string;
  amber: string;
  blue: string;
};

export const THEMES: Record<ThemeName, ColorTokens> = {
  scholar: {
    background: "#0a0a0a",
    backgroundDeep: "#050505",
    surface: "#111111",
    surface2: "#161616",
    surface3: "#1a1a1a",
    card: "rgba(17, 17, 17, 0.88)",
    border: "rgba(255, 255, 255, 0.08)",
    text: "#f5f5f5",
    textMuted: "#9a9a9a",
    textSoft: "#6b6b6b",
    gold: "#e8c15a",
    goldStrong: "#f0d27a",
    green: "#10b981",
    red: "#ef4444",
    amber: "#f59e0b",
    blue: "#60a5fa",
  },
  light: {
    background: "#f4f4f5",
    backgroundDeep: "#ececec",
    surface: "#ffffff",
    surface2: "#fafafa",
    surface3: "#f0f0f0",
    card: "rgba(255, 255, 255, 0.92)",
    border: "rgba(184, 134, 47, 0.18)",
    text: "#111111",
    textMuted: "#3a3a3a",
    textSoft: "#6b6b6b",
    gold: "#b8862f",
    goldStrong: "#9a6b1f",
    green: "#059669",
    red: "#dc2626",
    amber: "#d97706",
    blue: "#2563eb",
  },
  obsidian: {
    background: "#080808",
    backgroundDeep: "#040404",
    surface: "#0f0f0f",
    surface2: "#141414",
    surface3: "#1a1a1a",
    card: "rgba(15, 15, 15, 0.92)",
    border: "rgba(255, 255, 255, 0.06)",
    text: "#f5f5f5",
    textMuted: "#aaaaaa",
    textSoft: "#666666",
    gold: "#e8c15a",
    goldStrong: "#f0d27a",
    green: "#10b981",
    red: "#ef4444",
    amber: "#f59e0b",
    blue: "#60a5fa",
  },
  vanta: {
    background: "#000000",
    backgroundDeep: "#000000",
    surface: "#0a0a0a",
    surface2: "#0f0f0f",
    surface3: "#141414",
    card: "rgba(10, 10, 10, 0.96)",
    border: "rgba(204, 0, 0, 0.1)",
    text: "#ffffff",
    textMuted: "#999999",
    textSoft: "#555555",
    gold: "#cc0000",
    goldStrong: "#ff1a1a",
    green: "#10b981",
    red: "#ef4444",
    amber: "#f59e0b",
    blue: "#60a5fa",
  },
};

export const INSTITUTION_ACCENTS: Record<string, { gold: string; goldStrong: string }> = {
  NWU:  { gold: "#e8c15a", goldStrong: "#f0d27a" },
  UCT:  { gold: "#003366", goldStrong: "#0055AA" },
  UJ:   { gold: "#D95900", goldStrong: "#FF6A00" },
  WITS: { gold: "#002F4A", goldStrong: "#004D77" },
  UP:   { gold: "#CC0000", goldStrong: "#FF1A1A" },
};

export function getThemeTokens(theme: ThemeName, institution: InstitutionCode): ColorTokens {
  const base = THEMES[theme];
  if (!institution || !INSTITUTION_ACCENTS[institution]) return base;
  const accent = INSTITUTION_ACCENTS[institution];
  return { ...base, ...accent };
}

// Default export — scholar theme — keeps all existing code working without changes
export const colors: ColorTokens = THEMES.scholar;

export const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 44,
};

export const radius = {
  sm: 8,
  md: 14,
  lg: 20,
  xl: 28,
  full: 999,
};

export const type = {
  display: "CormorantGaramond_700Bold",
  displayRegular: "CormorantGaramond_400Regular",
  mono: "IBMPlexMono_400Regular",
  body: undefined as string | undefined,
};
