import type { HTMLAttributes } from "react";

type BadgeVariant = "gold" | "green" | "red" | "amber" | "neutral";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
};

export function badgeClassName({
  variant = "neutral",
  className,
}: {
  variant?: BadgeVariant;
  className?: string;
}) {
  return ["ui-badge", `ui-badge--${variant}`, className].filter(Boolean).join(" ");
}

export function Badge({ variant = "neutral", className, ...props }: BadgeProps) {
  return <span className={badgeClassName({ variant, className })} {...props} />;
}