export type Platform = "x" | "linkedin" | "instagram" | "youtube";
export type Pillar = "trading" | "school" | "aura" | "builder";
export type SignalSource = "github" | "trading" | "ideas" | "price" | "manual" | "telegram";
export interface BrandSignal {
    source: SignalSource;
    rawContent: string;
    pillar: Pillar;
}
export interface PlatformContent {
    x?: {
        thread: string[];
    };
    linkedin?: {
        text: string;
    };
    instagram?: {
        caption: string;
        visualBrief: string;
    };
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
export declare const DEFAULT_PILLAR_WEIGHTS: PillarWeights;
export declare const PLATFORM_TIMING: Record<Platform, {
    days: number[];
    hour: number;
}[]>;
//# sourceMappingURL=types.d.ts.map