import { config } from "../config.js";

type AdminPrincipal = {
  role?: string | null;
  email?: string | null;
};

export function isAdminPrincipal(principal: AdminPrincipal) {
  const role = (principal.role ?? "").trim().toLowerCase();
  if (role === "admin") return true;

  const email = (principal.email ?? "").trim().toLowerCase();
  if (!email) return false;

  return config.adminEmails.includes(email);
}
