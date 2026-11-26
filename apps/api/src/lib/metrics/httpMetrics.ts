import type { FastifyInstance, FastifyRequest } from "fastify";
import { httpRequestDurationSeconds, httpRequestErrorsTotal, httpRequestsTotal } from "./registry.js";

type TimedRequest = FastifyRequest & {
  _metricsStartedAtMs?: number;
  _startedAtMs?: number;
};

function resolveRoute(request: FastifyRequest): string {
  const routeOptions = (request as FastifyRequest & {
    routeOptions?: { url?: string };
  }).routeOptions;
  const legacyRouterPath = (request as FastifyRequest & { routerPath?: string }).routerPath;
  return routeOptions?.url ?? legacyRouterPath ?? "unknown";
}

/**
 * Registers onRequest/onResponse hooks that feed the Prometheus HTTP metrics.
 * Mirrors the timing pattern already used by recordRequestObservation in
 * server.ts, reusing its `_startedAtMs` stamp when it is present.
 */
export function registerHttpMetricsHooks(app: FastifyInstance): void {
  app.addHook("onRequest", (request, _reply, done) => {
    (request as TimedRequest)._metricsStartedAtMs = Date.now();
    done();
  });

  app.addHook("onResponse", (request, reply, done) => {
    const timed = request as TimedRequest;
    const startedAtMs = timed._metricsStartedAtMs ?? timed._startedAtMs ?? Date.now();
    const durationSeconds = Math.max(0, Date.now() - startedAtMs) / 1000;

    const labels = {
      method: request.method,
      route: resolveRoute(request),
      status: String(reply.statusCode),
    };

    httpRequestDurationSeconds.observe(labels, durationSeconds);
    httpRequestsTotal.inc(labels);
    if (reply.statusCode >= 500) {
      httpRequestErrorsTotal.inc(labels);
    }

    done();
  });
}
