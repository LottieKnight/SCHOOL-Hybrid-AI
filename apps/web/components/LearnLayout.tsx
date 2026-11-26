import { BackLink } from "@/components/BackLink";

type LearnLayoutProps = {
  title: string;
  subtitle?: string;
  backHref?: string;
  breadcrumbs?: { label: string; href?: string }[];
  actions?: React.ReactNode;
  children: React.ReactNode;
};

export function LearnLayout({ title, subtitle, backHref, actions, children }: LearnLayoutProps) {
  return (
    <div className="glass card card-with-back">
      {backHref ? <BackLink href={backHref} /> : null}
      <h1 className="title">{title}</h1>
      {subtitle ? <p className="subtitle">{subtitle}</p> : null}
      {actions ? <div className="outline-actions">{actions}</div> : null}
      <div className="spacer" />
      {children}
    </div>
  );
}
