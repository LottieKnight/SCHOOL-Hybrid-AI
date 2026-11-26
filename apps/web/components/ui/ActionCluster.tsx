import type { HTMLAttributes } from "react";

export function ActionCluster({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={["action-cluster", className].filter(Boolean).join(" ")} {...props}>
      {children}
    </div>
  );
}
