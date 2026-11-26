// apps/api/src/lib/webhooks.ts
//
// Enterprise outbound webhooks.
//
// Institutions register HTTPS endpoints and subscribe to events. When an event
// fires, we:
//   1. look up the institution's active endpoints subscribed to the event,
//   2. build a signed payload (HMAC-SHA256 over the canonical body using the
//      endpoint's per-endpoint secret),
//   3. enqueue a BullMQ delivery job with retries/backoff,
//   4. record the delivery attempt for audit/troubleshooting.
//
// Consumers call `enqueueWebhooks({ institutionId, event, payload })` with the
// tenant id already scoped. Deliveries happen asynchronously in the worker.

import crypto from "node:crypto";
import { taskQueue } from "../queue/index.js";
import { pool } from "../db/pool.js";

export type WebhookEvent =
  | "user.synced"
  | "user.created"
  | "school.created"
  | "institution.updated"
  | "payment.succeeded"
  | "license.provisioned"
  | "custom";

export interface WebhookEnvelope {
  id: string;
  event: WebhookEvent | string;
  institutionId: string;
  createdAt: string;
  payload: Record<string, unknown>;
  signature: string;
}

/**
 * Sign a webhook payload with HMAC-SHA256. The signature is computed over the
 * canonical JSON body, so consumers can recompute and compare it with a
 * constant-time check.
 */
export function signWebhookPayload(secret: string, body: string): string {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

/**
 * Enqueue deliveries for all active endpoints of an institution subscribed to
 * the given event. Returns the number of jobs enqueued.
 */
export async function enqueueWebhooks(input: {
  institutionId: string;
  event: WebhookEvent | string;
  payload: Record<string, unknown>;
}): Promise<number> {
  const result = await pool.query(
    `SELECT id::text, url, secret, events
     FROM webhook_endpoints
     WHERE institution_id = $1
       AND is_active = TRUE
       AND ($2 = ANY(events) OR events = '{}' OR 'custom' = ANY(events))`,
    [input.institutionId, input.event]
  );

  let enqueued = 0;
  for (const row of result.rows) {
    const envelopeId = crypto.randomUUID();
    const body = JSON.stringify({
      id: envelopeId,
      event: input.event,
      institutionId: input.institutionId,
      createdAt: new Date().toISOString(),
      payload: input.payload,
    });
    const signature = signWebhookPayload(row.secret, body);

    await pool.query(
      `INSERT INTO webhook_deliveries (endpoint_id, event, payload, attempt)
       VALUES ($1, $2, $3::jsonb, 1)`,
      [row.id, input.event, JSON.stringify(input.payload)]
    );

    await taskQueue.add(
      "webhook-deliver",
      {
        endpointId: row.id,
        url: row.url,
        envelope: {
          ...JSON.parse(body),
          signature,
        },
      },
      {
        attempts: 5,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: { age: 60 * 60 * 24 },
        removeOnFail: { age: 60 * 60 * 24 * 7 },
      }
    );
    enqueued++;
  }
  return enqueued;
}
