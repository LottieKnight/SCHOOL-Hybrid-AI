import { FastifyInstance } from "fastify";
import { config } from "../config.js";
import {
  metricsContentType,
  registerHttpMetricsHooks,
  renderMetrics,
} from "../lib/metrics/index.js";

function isAuthorized(headerToken: string | undefined, bearer: string | undefined): boolean {
  if (!config.metricsToken) return true;
  if (headerToken && headerToken === config.metricsToken) return true;
  if (bearer && bearer === `Bearer ${config.metricsToken}`) return true;
  return false;
}

export async function registerMetricsRoutes(app: FastifyInstance) {
  // Collect HTTP metrics for every request handled by this instance.
  registerHttpMetricsHooks(app);

  app.get("/metrics", async (request, reply) => {
    const headerToken = request.headers["x-metrics-token"] as string | undefined;
    const bearer = request.headers.authorization as string | undefined;

    if (config.metricsToken) {
      if (!isAuthorized(headerToken, bearer)) {
        reply.code(403).send({ error: "Forbidden" });
        return;
      }
    } else if (config.isProd) {
      const ip = request.ip;
      const allowed = ip === "127.0.0.1" || ip === "::1";
      if (!allowed) {
        reply.code(403).send({ error: "Forbidden" });
        return;
      }
    }

    reply.header("Content-Type", metricsContentType);
    reply.send(await renderMetrics());
  });
}
