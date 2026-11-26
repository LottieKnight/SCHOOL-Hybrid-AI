// apps/api/src/lib/rbac/roles.ts
//
// Hierarchical Role-Based Access Control (RBAC).
//
// Roles are hierarchical: each role inherits all permissions of the roles it
// extends. A user's effective permission set is the union of:
//   1. Permissions implied by their `role`
//   2. Any explicit `permissions` granted on their users row (deny-by-default
//      granular overrides for enterprise usage)
//
// Role hierarchy (highest -> lowest):
//   superadmin > institution_admin > educator > parent > learner > guest

export const ROLE_HIERARCHY = [
  "superadmin",
  "institution_admin",
  "educator",
  "parent",
  "learner",
  "guest",
] as const;

export type Role = (typeof ROLE_HIERARCHY)[number];

export type Permission =
  | "auth:login"
  | "auth:logout"
  | "auth:sessions"
  | "profile:read"
  | "profile:write"
  | "learn:access"
  | "learn:content"
  | "learn:quiz"
  | "learn:progress"
  | "learn:ai_tutor"
  | "wallet:read"
  | "wallet:spend"
  | "commerce:shop"
  | "commerce:checkout"
  | "commerce:orders"
  | "social:read"
  | "social:write"
  | "messaging:read"
  | "messaging:write"
  | "analytics:own"
  | "analytics:institution"      // institution-level rollups (E2+)
  | "analytics:cohort"           // cohort/cross-class analytics (E3+)
  | "analytics:export"
  | "analytics:predictive"       // at-risk / predictive modeling (U2+)
  | "institution:read"           // view institution config
  | "institution:write"          // modify institution config / settings
  | "institution:manage_users"   // create/update/deactivate institution users
  | "institution:import_users"   // bulk CSV / SCIM import
  | "institution:billing"        // manage enterprise subscription
  | "institution:security"       // manage SSO, API keys, webhooks
  | "webhooks:manage"
  | "webhooks:write"
  | "api_keys:manage"
  | "content:create"             // create/edit institutional content
  | "content:publish"
  | "users:all"                  // global user management (superadmin)
  | "billing:all"                // global billing administration
  | "admin:all";                 // global platform administration

type PermissionMap = Record<Role, ReadonlySet<Permission>>;

/**
 * Permissions provided by each role. Role inheritance is applied in
 * `effectivePermissions` — a role also receives every permission of the
 * roles below it in the hierarchy.
 */
const BASE_PERMISSIONS: PermissionMap = {
  guest: new Set<Permission>(["auth:login"]),

  learner: new Set<Permission>([
    "auth:login",
    "auth:logout",
    "auth:sessions",
    "profile:read",
    "profile:write",
    "learn:access",
    "learn:content",
    "learn:quiz",
    "learn:progress",
    "learn:ai_tutor",
    "wallet:read",
    "wallet:spend",
    "commerce:shop",
    "commerce:checkout",
    "commerce:orders",
    "social:read",
    "social:write",
    "messaging:read",
    "messaging:write",
    "analytics:own",
  ]),

  parent: new Set<Permission>([
    "auth:login",
    "auth:logout",
    "auth:sessions",
    "profile:read",
    "profile:write",
    "learn:access",
    "learn:content",
    "learn:progress",
    "wallet:read",
    "commerce:shop",
    "commerce:checkout",
    "commerce:orders",
    "social:read",
    "messaging:read",
    "analytics:own",
  ]),

  educator: new Set<Permission>([
    "auth:login",
    "auth:logout",
    "auth:sessions",
    "profile:read",
    "profile:write",
    "learn:access",
    "learn:content",
    "learn:quiz",
    "learn:progress",
    "learn:ai_tutor",
    "wallet:read",
    "commerce:shop",
    "commerce:checkout",
    "commerce:orders",
    "social:read",
    "social:write",
    "messaging:read",
    "messaging:write",
    "analytics:own",
    "analytics:institution",
    "content:create",
    "content:publish",
    "institution:read",
    "institution:manage_users",
  ]),

  institution_admin: new Set<Permission>([
    "auth:login",
    "auth:logout",
    "auth:sessions",
    "profile:read",
    "profile:write",
    "learn:access",
    "learn:content",
    "learn:quiz",
    "learn:progress",
    "learn:ai_tutor",
    "wallet:read",
    "wallet:spend",
    "commerce:shop",
    "commerce:checkout",
    "commerce:orders",
    "social:read",
    "social:write",
    "messaging:read",
    "messaging:write",
    "analytics:own",
    "analytics:institution",
    "analytics:cohort",
    "analytics:export",
    "institution:read",
    "institution:write",
    "institution:manage_users",
    "institution:import_users",
    "institution:billing",
    "institution:security",
    "webhooks:manage",
    "webhooks:write",
    "api_keys:manage",
    "content:create",
    "content:publish",
  ]),

  superadmin: new Set<Permission>([
    "auth:login",
    "auth:logout",
    "auth:sessions",
    "profile:read",
    "profile:write",
    "learn:access",
    "learn:content",
    "learn:quiz",
    "learn:progress",
    "learn:ai_tutor",
    "wallet:read",
    "wallet:spend",
    "commerce:shop",
    "commerce:checkout",
    "commerce:orders",
    "social:read",
    "social:write",
    "messaging:read",
    "messaging:write",
    "analytics:own",
    "analytics:institution",
    "analytics:cohort",
    "analytics:export",
    "analytics:predictive",
    "institution:read",
    "institution:write",
    "institution:manage_users",
    "institution:import_users",
    "institution:billing",
    "institution:security",
    "webhooks:manage",
    "webhooks:write",
    "api_keys:manage",
    "content:create",
    "content:publish",
    "users:all",
    "billing:all",
    "admin:all",
  ]),
};

// Derive role inheritance: a role includes every permission of roles below it
// in the hierarchy (i.e. higher roles grant strictly more access).
const _derived: Record<Role, ReadonlySet<Permission>> = {} as Record<Role, ReadonlySet<Permission>>;

for (const role of ROLE_HIERARCHY) {
  const self = new Set<Permission>(BASE_PERMISSIONS[role]);
  // lower roles (further down the hierarchy) are subsets
  for (const other of ROLE_HIERARCHY) {
    if (other === role) continue;
    const myRank = ROLE_HIERARCHY.indexOf(role);
    const otherRank = ROLE_HIERARCHY.indexOf(other);
    // if `role` is higher rank (smaller index), it inherits the lower role's perms
    if (myRank < otherRank) {
      for (const p of BASE_PERMISSIONS[other]) self.add(p);
    }
  }
  _derived[role] = self;
}

export const ROLE_PERMISSIONS = _derived;

export function isValidRole(value: string): value is Role {
  return (ROLE_HIERARCHY as readonly string[]).includes(value);
}

/**
 * Return the effective permission set for a user given their role and any
 * explicit permission grants/denials stored on the user row.
 */
export function effectivePermissions(
  roleValue: string | null | undefined,
  explicitPermissions?: string[] | null
): Set<Permission> {
  const role = roleValue && isValidRole(roleValue) ? roleValue : "guest";
  const perms = new Set<Permission>(ROLE_PERMISSIONS[role]);

  if (explicitPermissions?.length) {
    for (const raw of explicitPermissions) {
      const isDeny = raw.startsWith("!");
      const name = (isDeny ? raw.slice(1) : raw) as Permission;
      if (isDeny) {
        perms.delete(name);
      } else {
        perms.add(name);
      }
    }
  }

  return perms;
}

export function hasPermission(
  principal: { role?: string | null; permissions?: string[] | null },
  permission: Permission
): boolean {
  return effectivePermissions(principal.role, principal.permissions).has(permission);
}
