import type { ReactNode } from "react";
import { SchoolLogo } from "@/components/ui/SchoolLogo";

type RouteHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: ReactNode;
  size?: number;
  className?: string;
};

export function RouteHeader({ eyebrow, title, description, children, size = 82, className }: RouteHeaderProps) {
  return (
    <section className={["route-header", className].filter(Boolean).join(" ")}>
      <div className="route-header__brand">
        <SchoolLogo size={size} />
        <div className="route-header__copy">
          {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
          <h1 className="route-header__title">{title}</h1>
          {description ? <p className="route-header__description">{description}</p> : null}
        </div>
      </div>
      {children ? <div className="route-header__actions">{children}</div> : null}
    </section>
  );
}
