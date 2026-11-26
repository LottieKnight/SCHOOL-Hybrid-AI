import type { HTMLAttributes, ReactNode } from "react";

type SectionCardProps = HTMLAttributes<HTMLDivElement> & {
  title?: string;
  description?: string;
  actions?: ReactNode;
};

export function SectionCard({ title, description, actions, className, children, ...props }: SectionCardProps) {
  return (
    <section className={["section-card", className].filter(Boolean).join(" ")} {...props}>
      {title || description || actions ? (
        <div className="section-card__header">
          <div className="section-card__copy">
            {title ? <h2 className="section-card__title">{title}</h2> : null}
            {description ? <p className="section-card__description">{description}</p> : null}
          </div>
          {actions ? <div className="section-card__actions">{actions}</div> : null}
        </div>
      ) : null}
      <div className="section-card__body">{children}</div>
    </section>
  );
}
