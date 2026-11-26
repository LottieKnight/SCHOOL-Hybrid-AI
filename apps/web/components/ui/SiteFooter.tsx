import Link from "next/link";

export function SiteFooter() {
  return (
    <footer
      style={{
        borderTop: "1px solid var(--border)",
        padding: "20px 24px",
        display: "flex",
        flexWrap: "wrap",
        gap: "8px 20px",
        alignItems: "center",
        justifyContent: "space-between",
        marginTop: "auto",
      }}
    >
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-3)", letterSpacing: "0.06em", lineHeight: "1.5" }}>
        © {new Date().getFullYear()} DITSHEGO VENTURES (Pty) Ltd t/a SCHOOL · Reg. 2026/349873/07
      </span>
      <nav style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px" }}>
        {([
          { label: "Privacy", href: "/legal/privacy" },
          { label: "Terms", href: "/legal/terms" },
          { label: "Cookies", href: "/legal/cookies" },
          { label: "AUP", href: "/legal/aup" },
          { label: "PAIA", href: "/legal/paia" },
          { label: "Instagram", href: "https://www.instagram.com/school_academic_platform?igsh=MXZwa2JzNXBteDlpcA%3D%3D&utm_source=qr" },
          { label: "Contact", href: "mailto:privacy@ditshego-ventures.co.za" },
          { label: "Ditshego Ventures", href: "https://ditshego-ventures.co.za" },
        ] as const).map(({ label, href }) => (
          <Link
            key={href}
            href={href}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              color: "var(--text-3)",
              letterSpacing: "0.04em",
              display: "inline-flex",
              alignItems: "center",
              minHeight: "44px",
              padding: "0 6px",
            }}
          >
            {label}
          </Link>
        ))}
      </nav>
    </footer>
  );
}
