// apps/api/src/middleware/rbac.ts
//
// Role-Based Access Control (RBAC) middleware.
//
// This replaces the previous header-based implementation, which was insecure:
// any caller could set `x-user-role` to bypass role checks. Permissions are now
// resolved from the verified JWT principal (sub, role, institution_id) set by
// `requireAuth`, and from any explicit permission grants on the user row.
//
// Usage:
//   app.get('/route', { preHandler: requirePermission('learn:access') }, handler)
//
// Guard helpers:
//   can(principal, 'learn:content')      -> boolean
//   requirePermission('learn:content')   -> Fastify preHandler
//   requireRole('institution_admin')     -> Fastify preHandler (exact role match
//                                           OR a higher-privileged role)
import { FastifyPluginAsync } from "fastify";
import {
  Permission,
  Role,
  ROLE_HIERARCHY,
  hasPermission,
  isValidRole,
} from "../lib/rbac/roles.js";

export type RbacPrincipal = {
  sub: string;
  role?: string | null;
  institutionId?: string | null;
  permissions?: string[] | null;
};

/** Convenience boolean check for handlers. */
export function can(principal: RbacPrincipal | undefined | null, permission: Permission): boolean {
  if (!principal) return false;
  return hasPermission(
    { role: principal.role, permissions: principal.permissions },
    permission
  );
}

/** True if the principal's role is at or above the given role in the hierarchy. */
export function hasRole(principal: RbacPrincipal | undefined | null, required: Role): boolean {
  if (!principal?.role) return false;
  if (!isValidRole(principal.role)) return false;
  const rank = ROLE_HIERARCHY.indexOf(required);
  const principalRank = ROLE_HIERARCHY.indexOf(principal.role);
  // smaller index = higher privilege
  return principalRank <= rank;
}

/**
 * Reusable preHandler factory: granted only when the authenticated principal
 * holds the given permission.
 */
export function requirePermission(permission: Permission) {
  return async function permissionGuard(request: any, reply: any) {
    // Expects `requireAuth` to have run first (or be fastify req.user populated).
    if (!request.user) {
      reply.code(401).send({ error: "Unauthorized" });
      return;
    }
    const principal: RbacPrincipal = {
      sub: request.user.sub,
      role: request.user.role,
      institutionId: request.user.institutionId,
      permissions: request.user.permissions,
    };
    if (!hasPermission({ role: principal.role, permissions: principal.permissions }, permission)) {
      reply.code(403).send({ error: "Forbidden - insufficient permission", required: permission });
      return;
    }
  };
}

/**
 * Reusable preHandler factory: granted only when the authenticated principal's
 * role is at or above the required role.
 */
export function requireRole(required: Role) {
  return async function roleGuard(request: any, reply: any) {
    if (!request.user) {
      reply.code(401).send({ error: "Unauthorized" });
      return;
    }
    const principal: RbacPrincipal = {
      sub: request.user.sub,
      role: request.user.role,
      institutionId: request.user.institutionId,
      permissions: request.user.permissions,
    };
    if (!hasRole(principal, required)) {
      reply.code(403).send({ error: "Forbidden - insufficient role", required });
      return;
    }
  };
}

// Backwards-compatible global registration kept for `server.ts`. Because the
// previous implementation allowed all roles globally, this registers a no-op
// identity guard so no behaviour change is introduced for unguarded routes.
export const rbacMiddleware: FastifyPluginAsync = async (fastify) => {
  fastify.decorateRequest("can", function (this: any, permission: Permission) {
    return can(
      {
        sub: this.user?.sub,
        role: this.user?.role,
        institutionId: this.user?.institutionId,
        permissions: this.user?.permissions,
      },
      permission
    );
  });
};
