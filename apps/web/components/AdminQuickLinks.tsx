import Link from "next/link";

const ADMIN_LINKS = [
  { href: "/admin", label: "Admin home" },
  { href: "/admin/generate", label: "Generate lessons" },
  { href: "/admin/content-mapping", label: "Content mapping" },
  { href: "/admin/resolve-subjects", label: "Resolve subjects" },
  { href: "/admin/content-index", label: "Content index" },
  { href: "/admin/learning-analytics", label: "Learning analytics" },
  { href: "/admin/impact", label: "Impact scorecard" },
  { href: "/admin/metrics", label: "Funnel metrics" },
  { href: "/admin/monetisation", label: "Monetisation" },
  { href: "/admin/wallet-health", label: "Wallet health" },
  { href: "/admin/marketplace", label: "Marketplace curation" },
  { href: "/admin/compute", label: "Compute economics" },
  { href: "/admin/messages", label: "Message moderation" },
  { href: "/admin/equipment/quotes", label: "Equipment quotes" },
  { href: "/admin/tutor-disputes", label: "Tutor disputes" },
  { href: "/admin/brand", label: "BrandOS" },
  { href: "/admin/users", label: "User management" },
  { href: "/admin/data-protection", label: "Data protection" },
  { href: "/admin/audit-log", label: "Audit log" },
  { href: "/admin/feature-flags", label: "Feature flags" },
  { href: "/admin/totp-setup", label: "TOTP setup" },
  { href: "/admin/diagnostics/email", label: "Email diagnostics" },
  { href: "/admin/diagnostics/past-papers", label: "Past papers diagnostics" },
];

export function AdminQuickLinks() {
  return (
    <div className="outline-actions">
      {ADMIN_LINKS.map((link) => (
        <Link key={link.href} className="button" href={link.href}>
          {link.label}
        </Link>
      ))}
    </div>
  );
}
