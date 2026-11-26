export type Platform = "x" | "linkedin" | "instagram" | "youtube";
export type Pillar = "trading" | "school" | "aura" | "builder";
export type SignalSource =
  | "github"
  | "trading"
  | "ideas"
  | "price"
  | "manual"
  | "telegram";

export interface BrandSignal {
  source: SignalSource;
  rawContent: string;
  pillar: Pillar;
}

export interface PlatformContent {
  x?: { thread: string[] };
  linkedin?: { text: string };
  instagram?: { caption: string; visualBrief: string };
  youtube?: {
    title: string;
    description: string;
    script: string;
    tags: string[];
  };
}

export interface VoiceModel {
  version: number;
  systemPrompt: string;
  examples: Array<{
    platform: Platform;
    content: string;
    engagements: number;
  }>;
}

export interface PillarWeights {
  trading: number;
  school: number;
  aura: number;
  builder: number;
}

export const DEFAULT_PILLAR_WEIGHTS: PillarWeights = {
  trading: 0.4,
  school: 0.3,
  aura: 0.2,
  builder: 0.1,
};

export const PLATFORM_TIMING: Record<
  Platform,
  { days: number[]; hour: number }[]
> = {
  x: [
    { days: [1, 2, 3, 4, 5], hour: 8 },
    { days: [1, 2, 3, 4, 5], hour: 17 },
  ],
  linkedin: [{ days: [2, 3, 4], hour: 9 }],
  instagram: [{ days: [1, 2, 3, 4, 5, 6], hour: 18 }],
  youtube: [
    { days: [3, 6], hour: 14 },
  ],
};
