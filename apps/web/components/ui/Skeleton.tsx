import { type HTMLAttributes } from "react";

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`skeleton-shimmer ${className || ""}`}
      style={{
        backgroundColor: "rgba(255, 255, 255, 0.04)",
        borderRadius: "var(--r-md)",
        ...props.style,
      }}
      {...props}
    />
  );
}
