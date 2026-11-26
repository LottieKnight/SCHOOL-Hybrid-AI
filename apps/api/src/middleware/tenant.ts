/**
 * Tenant identification + isolation middleware.
 *
 * 1. Identifies the tenant from the request host (e.g. school.example.com)
 *    and attaches it to `request.tenant` plus the `x-tenant-id` header.
 * 2. When an authenticated caller belongs to an institution, records their
 *    `institutionId` on the request so downstream handlers / query builders can
 *    scope queries.
 *
 * NOTE: Query-level enforcement is achieved either at the application layer
 * (handlers using `request.institutionId`) or via Postgres Row-Level Security
 * (see migrations). This middleware centralises identification so both
 * strategies share a single source of truth.
 */
import { FastifyPluginAsync } from 'fastify';
import { pool } from '../db/pool.js';

export const tenantMiddleware: FastifyPluginAsync = async (fastify) => {
  fastify.decorateRequest('institutionId', null as string | null);

  fastify.addHook('onRequest', async (request) => {
    const host = request.headers.host ?? '';
    const subdomain = host.split('.')[0] || 'public';
    request.tenantId = subdomain;
    request.headers['x-tenant-id'] = subdomain;
  });

  fastify.addHook('preHandler', async (request) => {
    // Resolve institution scope from JWT or API-key principal when present.
    let institutionId: string | null = null;

    if ((request as any).apiKeyPrincipal?.institutionId) {
      institutionId = (request as any).apiKeyPrincipal.institutionId;
    } else if (request.user?.institutionId) {
      institutionId = request.user.institutionId;
    } else if (request.user?.sub && !request.user.institutionId) {
      // Fallback: look up the user's institution from the DB (e.g. tokens signed
      // before institution_id was included).
      try {
        const result = await pool.query<{ institution_id: string | null }>(
          'SELECT institution_id FROM users WHERE id = $1',
          [request.user.sub]
        );
        institutionId = result.rows[0]?.institution_id ?? null;
      } catch {
        institutionId = null;
      }
    }

    (request as any).institutionId = institutionId;
  });
};

declare module 'fastify' {
  interface FastifyRequest {
    tenantId: string;
    institutionId: string | null;
  }
}
