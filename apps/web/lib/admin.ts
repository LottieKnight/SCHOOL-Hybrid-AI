export function isAdminEmail(email?: string | null) {
  const e = (email ?? "").trim().toLowerCase();
  if (!e) return false;
  const admins = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(e);
}

export function isAdminSession(session: any) {
  const role = session?.user?.role ?? session?.role ?? null;
  if (typeof role === "string" && role.trim().toLowerCase() === "admin") {
    return true;
  }
  const email = session?.user?.email ?? session?.email ?? null;
  return isAdminEmail(typeof email === "string" ? email : null);
}
