import client from "prom-client";

/**
 * Single shared Prometheus registry for the API process.
 * Default Node/process metrics (CPU, memory, event loop, GC, handles) are
 * collected into this registry once at module load.
 */
export const registry = new client.Registry();

registry.setDefaultLabels({ service: "saedu-api" });

let defaultsStarted = false;

export function ensureDefaultMetrics(): void {
  if (defaultsStarted) return;
  defaultsStarted = true;
  client.collectDefaultMetrics({ register: registry });
}

ensureDefaultMetrics();

export const httpRequestDurationSeconds = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route", "status"] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry],
});

export const httpRequestsTotal = new client.Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests handled",
  labelNames: ["method", "route", "status"] as const,
  registers: [registry],
});

export const httpRequestErrorsTotal = new client.Counter({
  name: "http_request_errors_total",
  help: "Total number of HTTP responses with status >= 500",
  labelNames: ["method", "route", "status"] as const,
  registers: [registry],
});

export const dbQueryDurationSeconds = new client.Histogram({
  name: "db_query_duration_seconds",
  help: "Database query duration in seconds",
  labelNames: ["operation", "table", "status"] as const,
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [registry],
});

export const metricsContentType = registry.contentType;

export async function renderMetrics(): Promise<string> {
  return registry.metrics();
}
