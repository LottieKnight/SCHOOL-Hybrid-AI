import Link from "next/link";
import { COMPANY_LINKS, companyRegistrationLine } from "@/lib/shell/companyFooter";

function LegalAnchor({ href, label }: { href: string; label: string }) {
  const external = href.startsWith("http") || href.startsWith("mailto:");
  if (external) {
    return (
      <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel={href.startsWith("http") ? "noopener noreferrer" : undefined}>
        {label}
      </a>
    );
  }
  return <Link href={href}>{label}</Link>;
}

export function AboutLegal({ variant = "page" }: { variant?: "page" | "drawer" }) {
  return (
    <section className={`about-legal about-legal--${variant}`} aria-label="About and legal">
      <p className="about-legal__kicker">About & legal</p>
      <p className="about-legal__reg">{companyRegistrationLine()}</p>
      <nav className="about-legal__links">
        {COMPANY_LINKS.map((link) => (
          <LegalAnchor key={link.href} href={link.href} label={link.label} />
        ))}
      </nav>
    </section>
  );
}
