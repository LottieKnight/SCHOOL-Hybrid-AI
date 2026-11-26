/** Conservative blend of a short prompt and reply that never left the phone. */
export const ON_DEVICE_SAVED_MB = 0.4;
export const RANDS_PER_GB = 85;

export type TutorStats = {
  onDevice: number;
  inCloud: number;
};

export const EMPTY_STATS: TutorStats = { onDevice: 0, inCloud: 0 };

export function recordInference(stats: TutorStats, source: "on_device" | "in_cloud"): TutorStats {
  if (source === "on_device") return { ...stats, onDevice: stats.onDevice + 1 };
  return { ...stats, inCloud: stats.inCloud + 1 };
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

export function estimateSavings(onDeviceCalls: number) {
  const mb = round2(Math.max(0, onDeviceCalls) * ON_DEVICE_SAVED_MB);
  const rands = round2((mb / 1024) * RANDS_PER_GB);
  return { mb, rands };
}

export function formatSavings(onDeviceCalls: number) {
  const { mb, rands } = estimateSavings(onDeviceCalls);
  return `${mb.toFixed(2)} MB kept on this phone, about R${rands.toFixed(2)} at R${RANDS_PER_GB}/GB`;
}
