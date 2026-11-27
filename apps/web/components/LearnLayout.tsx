import Link from "next/link";
import { BackLink } from "@/components/BackLink";
import styles from "./LearnLayout.module.css";

type LearnLayoutProps = {
  title: string;
  subtitle?: string;
  backHref?: string;
  breadcrumbs?: { label: string; href?: string }[];
  actions?: React.ReactNode;
  children: React.ReactNode;
};

function formatCrumb(label: string) {
  if (label === "foundation") return "Foundation";
  if (label === "intermediate") return "Intermediate";
  if (label === "senior") return "Senior";
  if (label === "fet") return "FET";
  return label;
}

export function LearnLayout({ title, subtitle, backHref, breadcrumbs, actions, children }: LearnLayoutProps) {
  return (
    <div className={styles.page}>
      {breadcrumbs?.length ? (
        <nav className={styles.crumbs} aria-label="Breadcrumb">
          <ol>
            {breadcrumbs.map((crumb, index) => {
              const last = index === breadcrumbs.length - 1;
              return (
                <li key={`${crumb.label}-${index}`}>
                  {crumb.href && !last ? <Link href={crumb.href}>{formatCrumb(crumb.label)}</Link> : <span>{formatCrumb(crumb.label)}</span>}
                </li>
              );
            })}
          </ol>
        </nav>
      ) : null}
      {backHref ? <BackLink href={backHref} /> : null}
      <header className={styles.header}>
        <h1 className={styles.title}>{title}</h1>
        {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
        {actions ? <div className={styles.actions}>{actions}</div> : null}
      </header>
      {children}
    </div>
  );
}
