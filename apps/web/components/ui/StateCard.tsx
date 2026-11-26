import type { ReactNode } from "react";

type StateCardProps = {
  icon?: ReactNode;
  title: string;
  description: string;
  children?: ReactNode;
  tone?: "default" | "warn" | "danger" | "success";
};

export function StateCard({ icon = "S", title, description, children, tone = "default" }: StateCardProps) {
  return (
    <section className={`state-card state-card--${tone}`}>
      <div className="state-card__icon" aria-hidden="true">
        {icon}
      </div>
      <div className="state-card__title">{title}</div>
      <div className="state-card__description">{description}</div>
      {children ? <div className="state-card__actions">{children}</div> : null}
    </section>
  );
}
