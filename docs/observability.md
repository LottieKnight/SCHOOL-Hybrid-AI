# Observability

Prometheus metrics exporter for the Fastify API plus a local Prometheus +
Grafana + node-exporter stack.

## Metrics exposed

`GET /metrics` returns Prometheus text format (`text/plain; version=0.0.4`).

| Metric | Type | Labels | Notes |
| --- | --- | --- | --- |
| `http_request_duration_seconds` | histogram | `method`, `route`, `status` | Request latency; buckets 5ms → 10s |
| `http_requests_total` | counter | `method`, `route`, `status` | Total requests handled |
| `http_request_errors_total` | counter | `method`, `route`, `status` | Responses with status ≥ 500 |
| `db_query_duration_seconds` | histogram | `operation`, `table`, `status` | Recorded via the `timeDbQuery` helper |
| `process_cpu_seconds_total`, `process_resident_memory_bytes`, `nodejs_*` | various | — | `prom-client` default Node/process metrics |

All series carry the default label `service="saedu-api"`.

## Code layout

```
apps/api/src/lib/metrics/
  registry.ts     # shared prom-client Registry + metric definitions
  httpMetrics.ts  # onRequest/onResponse hooks feeding the HTTP metrics
  dbTimer.ts      # timeDbQuery / startDbTimer helpers
  index.ts        # public re-exports
apps/api/src/routes/metrics.ts  # GET /metrics + hook registration
```

`registerMetricsRoutes(app)` (already called from `src/server.ts`) installs the
`onRequest`/`onResponse` hooks, so no change to `server.ts` was required. The
hooks stamp their own start time and fall back to the existing `_startedAtMs`
stamp used by `recordRequestObservation`, so both the in-memory observability
summary and Prometheus see the same request lifecycle.

### Timing a database query

```ts
import { timeDbQuery } from "../lib/metrics/index.js";

const rows = await timeDbQuery("select", "users", () => pool.query(sql, params));
```

Or, when a closure is awkward:

```ts
import { startDbTimer } from "../lib/metrics/index.js";

const end = startDbTimer("insert", "orders");
try { await doWork(); end("ok"); } catch (e) { end("error"); throw e; }
```

## Access control

- If `METRICS_TOKEN` is set, `/metrics` requires either
  `Authorization: Bearer <token>` or `X-Metrics-Token: <token>`; otherwise 403.
- If `METRICS_TOKEN` is unset and `NODE_ENV=production`, only loopback IPs
  (`127.0.0.1`, `::1`) may scrape.
- In development with no token, `/metrics` is open.

```bash
curl -H "Authorization: Bearer $METRICS_TOKEN" http://localhost:4000/metrics
```

## Local stack

```bash
cd infra/observability
docker compose -f docker-compose.observability.yml up -d
```

| Service | URL | Notes |
| --- | --- | --- |
| Prometheus | http://localhost:9090 | scrapes API, node-exporter, itself every 15s |
| Grafana | http://localhost:3001 | default login `admin` / `admin` (override via `GRAFANA_USER`/`GRAFANA_PASSWORD`) |
| node-exporter | http://localhost:9100/metrics | host CPU/memory/disk |

The API is scraped at `host.docker.internal:4000` so the exporter works while
the API runs on the host. If you run the API inside the same compose network,
change the target in `prometheus.yml` to the API service name and port.

If `METRICS_TOKEN` is set, uncomment the `authorization` block in
`prometheus.yml` and fill in the credentials.

Teardown (keeps volumes): `docker compose -f docker-compose.observability.yml down`.
Add `-v` to drop the Prometheus/Grafana data volumes.

## Dashboards

`grafana/dashboards/api-overview.json` is auto-provisioned into the **SAEDU**
folder via `grafana/provisioning/`, along with the Prometheus datasource. Panels:

1. Process CPU usage (API process + host)
2. Memory usage (RSS, heap used, heap total)
3. Request rate by route
4. Error rate (5xx and 4xx share of traffic)
5. HTTP latency p50 / p95 / p99
6. DB query latency p50 / p95 / p99

Edits made in the Grafana UI are not written back to the repo — export the JSON
and replace the file to persist a change.

## Useful queries

```promql
# Request rate by route
sum by (route) (rate(http_requests_total{service="saedu-api"}[5m]))

# p95 latency
histogram_quantile(0.95, sum by (le) (rate(http_request_duration_seconds_bucket[5m])))

# 5xx error ratio
sum(rate(http_requests_total{status=~"5.."}[5m]))
  / clamp_min(sum(rate(http_requests_total[5m])), 0.0001)
```

## Troubleshooting

- **Target DOWN in Prometheus** — check `METRICS_TOKEN` matches, and that
  `host.docker.internal` resolves (the compose file adds a `host-gateway`
  entry for Linux).
- **High-cardinality routes** — metrics are labelled with the Fastify route
  *pattern* (`/users/:id`), not the raw URL, so path params do not explode
  cardinality. Unmatched requests are labelled `route="unknown"`.

---

## 2026-09-14 status snapshot

- **Past Papers Ingest workflow failing daily** (≥6 consecutive runs, Sep 13–14).
  Root cause verified from action logs: `curl: option --retry-status: is unknown`
  (`curl_exit=2`, `failure_type=network_failure`) — the ubuntu-latest runner ships
  curl 8.5.1, which lacks `--retry-status` (needs ≥ 8.7). **Not** a DB/DNS fault.
  Fix committed (`f44353ea`: replaced with `--retry-all-errors`); push pending a
  workflow-scoped PAT. See `docs/engineering/INGEST_SECRETS.md`.
- **Failure alerting** now wired to every workflow via `.github/actions/notify-ops`
  (fires only when `OPS_ALERT_WEBHOOK_URL` is set — no-op otherwise).
- **Health endpoints:** web `/health` + API health route are registered.
- **External signals (owner actions):** Vercel function storage ~75% of free tier;
  Supabase project paused (Sep 1); Google Play signing-key registration due **Sep 30 2026**.
  Captured in the ops triage doc (Desktop/AI LAB, `OPS_TRIAGE_20260914.md`).
- **Local metrics stack** (Grafana/Prometheus) is unchanged and still documented above.
