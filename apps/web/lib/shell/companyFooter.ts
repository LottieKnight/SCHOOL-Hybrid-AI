export const COMPANY_LEGAL_NAME = "DITSHEGO VENTURES (Pty) Ltd t/a SCHOOL";
export const COMPANY_REGISTRATION = "2026/349873/07";

export const COMPANY_LINKS = [
  { label: "Privacy", href: "/legal/privacy" },
  { label: "Terms", href: "/legal/terms" },
  { label: "Cookies", href: "/legal/cookies" },
  { label: "AUP", href: "/legal/aup" },
  { label: "PAIA", href: "/legal/paia" },
  { label: "Instagram", href: "https://www.instagram.com/school_academic_platform?igsh=MXZwa2JzNXBteDlpcA%3D%3D&utm_source=qr" },
  { label: "Contact", href: "mailto:privacy@ditshego-ventures.co.za" },
  { label: "Ditshego Ventures", href: "https://ditshego-ventures.co.za" },
] as const;

/**
 * The full company footer belongs on public marketing pages.
 * App screens keep the registration and legal links in the More drawer and Settings
 * so the shell can use the full viewport.
 */
export function shouldShowCompanyFooter(pathname: string | null | undefined): boolean {
  const path = (pathname || "/").split("?")[0].split("#")[0] || "/";
  if (path === "/") return true;
  if (path === "/features" || path.startsWith("/features/")) return true;
  return false;
}

export function companyRegistrationLine(year = new Date().getFullYear()): string {
  return `© ${year} ${COMPANY_LEGAL_NAME} · Reg. ${COMPANY_REGISTRATION}`;
}
