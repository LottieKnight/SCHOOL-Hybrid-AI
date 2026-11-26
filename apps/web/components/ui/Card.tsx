"use client";

import { motion } from "framer-motion";
import type { HTMLAttributes } from "react";

type CardProps = HTMLAttributes<HTMLDivElement>;
type CardActionProps = HTMLAttributes<HTMLDivElement>;
type CardTitleProps = HTMLAttributes<HTMLHeadingElement> & {
  as?: "h2" | "h3" | "h4" | "h5";
};

export function Card({ className, ...props }: CardProps) {
  return (
    <motion.section
      whileHover={{ scale: 1.01 }}
      transition={{ type: "spring", stiffness: 280, damping: 26 }}
      className={["ui-card", className].filter(Boolean).join(" ")}
      {...(props as any)}
    />
  );
}

export function CardHeader({ className, ...props }: CardProps) {
  return <div className={["ui-card-header", className].filter(Boolean).join(" ")} {...props} />;
}

export function CardTitle({ as = "h3", className, ...props }: CardTitleProps) {
  const Tag = as;
  return <Tag className={["ui-card-title", className].filter(Boolean).join(" ")} {...props} />;
}

export function CardAction({ className, ...props }: CardActionProps) {
  return <div className={["ui-card-action", className].filter(Boolean).join(" ")} {...props} />;
}

export function CardBody({ className, ...props }: CardProps) {
  return <div className={["ui-card-body", className].filter(Boolean).join(" ")} {...props} />;
}
