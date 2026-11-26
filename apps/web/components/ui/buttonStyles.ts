// Server-safe button class helper. Kept outside Button.tsx ("use client") so
// server components can compute button classes without pulling in a client
// reference — calling a client-module export from the server throws at runtime.

export type ButtonVariant = "gold" | "outline" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export function buttonClassName({
  variant = "outline",
  size = "md",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}) {
  return ["ui-button", `ui-button--${variant}`, `ui-button--${size}`, className]
    .filter(Boolean)
    .join(" ");
}
