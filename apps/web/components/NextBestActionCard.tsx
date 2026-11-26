"use client";

import Link from "next/link";

type CardAction = {
  label: string;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
};

type NextBestActionCardProps = {
  heading?: string;
  title: string;
  description: string;
  primaryAction: CardAction;
  secondaryAction?: CardAction;
  footnote?: string | null;
};

function ActionButton({ action }: { action: CardAction }) {
  if (action.href) {
    return (
      <Link className="button" href={action.href} aria-disabled={action.disabled ? "true" : undefined}>
        {action.label}
      </Link>
    );
  }

  return (
    <button className="button" type="button" onClick={action.onClick} disabled={action.disabled}>
      {action.label}
    </button>
  );
}

export function NextBestActionCard({
  heading = "Next best action",
  title,
  description,
  primaryAction,
  secondaryAction,
  footnote,
}: NextBestActionCardProps) {
  return (
    <div className="list-item">
      <div className="badge">{heading}</div>
      <strong>{title}</strong>
      <p className="subtitle">{description}</p>
      <div className="outline-actions">
        <ActionButton action={primaryAction} />
        {secondaryAction ? <ActionButton action={secondaryAction} /> : null}
      </div>
      {footnote ? <p className="badge">{footnote}</p> : null}
    </div>
  );
}

