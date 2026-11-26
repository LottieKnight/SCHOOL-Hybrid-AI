"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useTranslations } from "next-intl";

type AppErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function AppError({ error, reset }: AppErrorProps) {
  const t = useTranslations("errors");

  useEffect(() => {
    console.error("Route error boundary captured:", error);
  }, [error]);

  return (
    <div className="glass card card-with-back">
      <Link className="button back-button" href="/" aria-label={t("backAriaLabel")}>
        {"<-"} {t("back")}
      </Link>
      <h2 className="title">{t("heading")}</h2>
      <p className="subtitle">{t("message")}</p>
      <button className="button" type="button" onClick={reset}>
        {t("retry")}
      </button>
    </div>
  );
}
