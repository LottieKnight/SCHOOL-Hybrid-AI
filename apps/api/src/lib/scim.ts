// apps/api/src/lib/scim.ts
//
// SCIM 2.0 (RFC 7643 / RFC 7644) Service Provider implementation.
//
// Institutional directories (Azure AD, Okta, Google Workspace) provision and
// de-provision SCHOOL users over the standard /scim/v2 API, authenticated with
// a per-institution SCIM API key (scope `scim:provisioning`). This module
// provides the SCIM resource model (Schemas, ServiceProviderConfig, Users,
// Groups), the mapping between SCIM resources and SCHOOL's user model, and the
// database operations for deterministic (externalId-keyed) provisioning.
//
// Role derivation: a user's SCHOOL role is upgraded from the default `learner`
// when they belong to a group whose display name implies administrator/educator
// membership (e.g. "Administrators", "Educators", "Staff").

import { pool } from "../db/pool.js";
import { createUser, findUserByExternalId } from "../db/users.js";
import { randomUUID } from "node:crypto";

// SCIM schemas
export const SCIM_USER_SCHEMA = "urn:ietf:params:scim:schemas:core:2.0:User";
export const SCIM_GROUP_SCHEMA = "urn:ietf:params:scim:schemas:core:2.0:Group";
export const SCIM_ENTERPRISE = "urn:ietf:params:scim:schemas:extension:enterprise:2.0:User";
export const SCIM_RESOURCE = "urn:ietf:params:scim:schemas:core:2.0:ResourceType";
export const SCIM_SEARCH = "urn:ietf:params:scim:api:messages:2.0:SearchRequest";
export const SCIM_LIST = "urn:ietf:params:scim:api:messages:2.0:ListResponse";
export const SCIM_ERROR = "urn:ietf:params:scim:api:messages:2.0:Error";
export const SCIM_PATCHOP = "urn:ietf:params:scim:api:messages:2.0:PatchOp";

export type ScimUserResource = {
  schemas: string[];
  id: string;
  externalId?: string;
  userName?: string;
  name?: { givenName?: string; familyName?: string };
  emails?: { value?: string; primary?: boolean }[];
  active?: boolean;
  groups?: { value: string; display: string }[];
  meta?: { resourceType: string; created: string; lastModified: string };
};

export type ScimGroupResource = {
  schemas: string[];
  id: string;
  externalId?: string;
  displayName?: string;
  members?: { value?: string; display?: string }[];
  meta?: { resourceType: string };
};

export function scimUserToSchool(input: ScimUserResource): {
  email: string;
  firstName: string;
  lastName: string;
  externalId: string;
} {
  const email = input.userName || input.emails?.find((e) => e.primary)?.value || input.emails?.[0]?.value || "";
  return {
    email: String(email).trim().toLowerCase(),
    firstName: input.name?.givenName || String(email.split("@")[0] || "SCIM"),
    lastName: input.name?.familyName || "",
    externalId: input.externalId || input.id || randomUUID(),
  };
}

export function schoolToScimUser(user: {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  external_id: string | null;
  role: string;
  institution_id: string | null;
}): ScimUserResource {
  const now = new Date().toISOString();
  return {
    schemas: [SCIM_USER_SCHEMA],
    id: user.external_id ?? user.id,
    externalId: user.external_id ?? user.id,
    userName: user.email,
    name: { givenName: user.first_name, familyName: user.last_name },
    emails: [{ value: user.email, primary: true }],
    active: true,
    meta: { resourceType: "User", created: now, lastModified: now },
  };
}

export function scimUserToSchoolGroups(input: ScimUserResource): { value: string; display: string }[] {
  return input.groups ?? [];
}

// ---------------- User provisioning ----------------

/** Find-or-create a user from a SCIM resource, keyed on externalId. */
export async function provisionUser(
  institutionId: string,
  resource: ScimUserResource
): Promise<{ user: any; created: boolean }> {
  const mapped = scimUserToSchool(resource);
  if (!mapped.email) throw scimError(400, "userName/emails is required");

  let user = await findUserByExternalId(institutionId, mapped.externalId);
  let created = false;
  if (!user) {
    const role = await roleForGroups(institutionId, scimUserToSchoolGroups(resource));
    user = await createUser(mapped.email, randomUUID(), mapped.firstName, mapped.lastName, "", role, null, mapped.externalId);
    await pool.query(
      `UPDATE users SET institution_id = $2, is_email_verified = TRUE, external_id = $3
       WHERE id = $1`,
      [user.id, institutionId, mapped.externalId]
    );
    created = true;
  } else {
    // upsert identity fields in place (idempotent replace semantics via PUT)
    const role = await roleForGroups(institutionId, scimUserToSchoolGroups(resource));
    await pool.query(
      `UPDATE users SET first_name = $2, last_name = $3, role = $4, is_email_verified = TRUE
       WHERE id = $1`,
      [user.id, mapped.firstName, mapped.lastName, role]
    );
  }
  // persist group membership
  await syncUserGroups(institutionId, user!.id, scimUserToSchoolGroups(resource));
  await logScimEvent(institutionId, created ? "createUser" : "replaceUser", "User", mapped.externalId, user!.id, resource);
  return { user: user!, created };
}

/** Delete a SCIM user (soft-delete matching SCHOOL conventions). */
export async function deprovisionUser(
  institutionId: string,
  externalId: string
): Promise<boolean> {
  const user = await findUserByExternalId(institutionId, externalId);
  if (!user) return false;
  await pool.query(
    `UPDATE users SET role = 'guest', external_id = NULL, institution_id = NULL,
            email = 'scim-' || external_id || '-' || id::text || '@deleted.school.ac.za'
     WHERE id = $1`,
    [user.id]
  );
  await logScimEvent(institutionId, "deleteUser", "User", externalId, user.id, {});
  return true;
}

// ---------------- Group + role handling ----------------

async function roleForGroups(institutionId: string, groups: { value: string; display: string }[]): Promise<string> {
  const names = groups.map((g) => g.display.toLowerCase());
  if (names.some((n) => /admin|staff/.test(n))) return "institution_admin";
  if (names.some((n) => /educator|teacher/.test(n))) return "educator";
  if (names.some((n) => /parent|guardian/.test(n))) return "parent";
  return "learner";
}

/** Insert a SCIM group (idempotent on institution_id+external_id). */
export async function upsertScimGroup(institutionId: string, externalId: string, displayName: string): Promise<string> {
  const result = await pool.query(
    `INSERT INTO scim_groups (institution_id, external_id, display_name)
     VALUES ($1, $2, $3)
     ON CONFLICT (institution_id, external_id)
     DO UPDATE SET display_name = EXCLUDED.display_name
     RETURNING id::text`,
    [institutionId, externalId, displayName]
  );
  return result.rows[0].id;
}

async function syncUserGroups(
  institutionId: string,
  userId: string,
  groups: { value: string; display: string }[]
): Promise<void> {
  await pool.query("DELETE FROM scim_group_members WHERE user_id = $1", [userId]);
  for (const g of groups) {
    const groupId = await upsertScimGroup(institutionId, g.value, g.display);
    await pool.query(
      `INSERT INTO scim_group_members (group_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [groupId, userId]
    );
  }
}

/** Resolve a SCIM group (by id or externalId) to a SCHOOL group row. */
export async function getScimGroup(institutionId: string, externalId: string) {
  const result = await pool.query(
    `SELECT id::text, external_id, display_name, created_at
     FROM scim_groups WHERE institution_id = $1 AND external_id = $2`,
    [institutionId, externalId]
  );
  return result.rows[0] ?? null;
}

export async function listScimGroups(institutionId: string) {
  const result = await pool.query(
    `SELECT id::text, external_id, display_name, created_at FROM scim_groups WHERE institution_id = $1`,
    [institutionId]
  );
  return result.rows;
}

export async function groupMembers(institutionId: string, groupId: string) {
  const result = await pool.query(
    `SELECT u.id::text AS value, u.first_name || ' ' || u.last_name AS display
     FROM scim_group_members m
     JOIN scim_groups g ON g.id = m.group_id
     JOIN users u ON u.id = m.user_id
     WHERE g.institution_id = $1 AND g.id = $2`,
    [institutionId, groupId]
  );
  return result.rows;
}

// ---------------- Audit / events ----------------

export function logScimEvent(
  institutionId: string,
  operation: string,
  resourceType: string,
  externalId: string | null,
  userId: string | null,
  payload: unknown
): Promise<unknown> {
  return pool
    .query(
      `INSERT INTO scim_events (institution_id, operation, resource_type, external_id, user_id, payload)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
      [institutionId, operation, resourceType, externalId, userId, JSON.stringify(payload)]
    )
    .catch(() => null);
}

// ---------------- Standard SCIM errors ----------------

export class ScimError extends Error {
  status: number;
  scimType?: string;
  constructor(status: number, detail: string, scimType?: string) {
    super(detail);
    this.status = status;
    this.scimType = scimType;
  }
}

export function scimError(status: number, detail: string, scimType?: string): ScimError {
  return new ScimError(status, detail, scimType);
}