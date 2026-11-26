type RequestSample = {
  at: number;
  durationMs: number;
  statusCode: number;
};

type CacheSample = {
  at: number;
  hit: boolean;
};

const startedAtMs = Date.now();
const requestSamples: RequestSample[] = [];
const cacheSamples: CacheSample[] = [];
const MAX_REQUEST_SAMPLES = 3000;
const MAX_CACHE_SAMPLES = 3000;
const ONE_MINUTE_MS = 60_000;

let totalRequests = 0;
let totalErrors = 0;

function pruneSamples(nowMs: number) {
  while (requestSamples.length > MAX_REQUEST_SAMPLES) requestSamples.shift();
  while (cacheSamples.length > MAX_CACHE_SAMPLES) cacheSamples.shift();

  while (requestSamples.length > 0 && nowMs - requestSamples[0]!.at > 5 * ONE_MINUTE_MS) {
    requestSamples.shift();
  }
  while (cacheSamples.length > 0 && nowMs - cacheSamples[0]!.at > 5 * ONE_MINUTE_MS) {
    cacheSamples.shift();
  }
}

export function recordRequestObservation(input: { durationMs: number; statusCode: number }) {
  const nowMs = Date.now();
  totalRequests += 1;
  if (input.statusCode >= 500) totalErrors += 1;
  requestSamples.push({
    at: nowMs,
    durationMs: Math.max(0, Number(input.durationMs) || 0),
    statusCode: Math.max(0, Math.floor(Number(input.statusCode) || 0)),
  });
  pruneSamples(nowMs);
}

export function recordCacheObservation(hit: boolean) {
  const nowMs = Date.now();
  cacheSamples.push({ at: nowMs, hit });
  pruneSamples(nowMs);
}

export function getObservabilitySummary(input?: {
  queueLag?: number;
  memoryUsageBytes?: number;
  extra?: Record<string, unknown>;
}) {
  const nowMs = Date.now();
  pruneSamples(nowMs);

  const oneMinuteRequests = requestSamples.filter((sample) => nowMs - sample.at <= ONE_MINUTE_MS);
  const latencyP95 = (() => {
    if (oneMinuteRequests.length === 0) return 0;
    const sorted = oneMinuteRequests.map((sample) => sample.durationMs).sort((a, b) => a - b);
    const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(sorted.length * 0.95) - 1));
    return Math.round(sorted[idx] || 0);
  })();

  const oneMinuteErrors = oneMinuteRequests.filter((sample) => sample.statusCode >= 500).length;
  const errorRateOneMinute = oneMinuteRequests.length
    ? Number((oneMinuteErrors / oneMinuteRequests.length).toFixed(4))
    : 0;

  const oneMinuteCache = cacheSamples.filter((sample) => nowMs - sample.at <= ONE_MINUTE_MS);
  const cacheHitRateOneMinute = oneMinuteCache.length
    ? Number((oneMinuteCache.filter((sample) => sample.hit).length / oneMinuteCache.length).toFixed(4))
    : 0;

  return {
    uptimeSeconds: Math.floor((nowMs - startedAtMs) / 1000),
    totals: {
      requests: totalRequests,
      errors5xx: totalErrors,
    },
    oneMinute: {
      requests: oneMinuteRequests.length,
      errors5xx: oneMinuteErrors,
      errorRate: errorRateOneMinute,
      latencyP95Ms: latencyP95,
      cacheHitRate: cacheHitRateOneMinute,
    },
    queueLag: Math.max(0, Math.floor(input?.queueLag ?? 0)),
    memoryUsageBytes: Math.max(0, Math.floor(input?.memoryUsageBytes ?? 0)),
    extra: input?.extra ?? {},
  };
}
