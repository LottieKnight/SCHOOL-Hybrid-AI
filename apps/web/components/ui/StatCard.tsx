"use client";

import { motion } from "framer-motion";
import type { CSSProperties, ReactNode } from "react";

type StatCardProps = {
  icon: ReactNode;
  label: string;
  value: string | number;
  delta?: string;
  deltaType?: "up" | "warn" | "neutral";
  animationDelay?: number;
};

export function StatCard({
  icon,
  label,
  value,
  delta,
  deltaType = "neutral",
  animationDelay = 0,
}: StatCardProps) {
  const style = {
    animationDelay: `${animationDelay}ms`,
  } satisfies CSSProperties;

  return (
    <motion.article
      className="ui-stat-card animate-fade-up"
      style={style}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      transition={{ type: "spring", stiffness: 360, damping: 24 }}
    >
      <div className="ui-stat-card__line" aria-hidden="true" />
      <div className="ui-stat-card__head">
        <div className="ui-stat-card__icon" aria-hidden="true">
          {icon}
        </div>
        {delta ? <span className={`ui-stat-card__delta ui-stat-card__delta--${deltaType}`}>{delta}</span> : null}
      </div>
      <div className="ui-stat-card__label">{label}</div>
      <div className="ui-stat-card__value">{value}</div>
    </motion.article>
  );
}
