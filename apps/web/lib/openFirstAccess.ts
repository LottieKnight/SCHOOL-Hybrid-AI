/**
 * Routes a learner, teacher, or self-studier can open with no account.
 * `/admin` stays server-gated by `decideAdminPageAccess` and is never in this list.
 */
export const OPEN_FIRST_PATHS = ["/learn", "/past-papers", "/tutor", "/dashboard", "/settings"] as const;

export function isAdminPath(pathname: string) {
  const path = pathname.split("?")[0] || "/";
  return path === "/admin" || path.startsWith("/admin/");
}

export function isOpenFirstPath(pathname: string) {
  const path = pathname.split("?")[0] || "/";
  return OPEN_FIRST_PATHS.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

export function routeRequiresSignIn(pathname: string) {
  if (isAdminPath(pathname)) return true;
  if (isOpenFirstPath(pathname)) return false;
  return false;
}
