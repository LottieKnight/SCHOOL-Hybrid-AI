import Link from "next/link";
import { COMPANY_LINKS, companyRegistrationLine } from "@/lib/shell/companyFooter";

export function SiteFooter() {
  return (
    <footer
      className="site-footer"
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
        {companyRegistrationLine()}
      </span>
      <nav style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px" }}>
        {COMPANY_LINKS.map(({ label, href }) => {
          const external = href.startsWith("http") || href.startsWith("mailto:");
          const style = {
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            color: "var(--text-3)",
            letterSpacing: "0.04em",
            display: "inline-flex",
            alignItems: "center",
            minHeight: "44px",
            padding: "0 6px",
          } as const;
          if (external) {
            return (
              <a
                key={href}
                href={href}
                style={style}
                target={href.startsWith("http") ? "_blank" : undefined}
                rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
              >
                {label}
              </a>
            );
          }
          return (
            <Link key={href} href={href} style={style}>
              {label}
            </Link>
          );
        })}
      </nav>
    </footer>
  );
}
