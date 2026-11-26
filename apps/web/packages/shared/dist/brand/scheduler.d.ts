import { type Platform, type Pillar, type PillarWeights } from "./types.js";
export declare function getPlatformsForPillar(pillar: Pillar): Platform[];
export declare function getNextPostTime(platform: Platform, after?: Date): Date;
export declare function isPillarAllowed(weeklyPostCounts: Record<Pillar, number>, pillar: Pillar, weights?: PillarWeights): boolean;
export declare function generateFingerprint(content: string): string;
//# sourceMappingURL=scheduler.d.ts.map