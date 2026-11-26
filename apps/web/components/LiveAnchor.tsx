import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/pastPapers/db";
import styles from "../app/page.module.css";

function formatRelativeDate(date: Date, t: Awaited<ReturnType<typeof getTranslations>>): string {
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days === 0) return t("relativeToday");
  if (days === 1) return t("relativeYesterday");
  if (days < 7) return t("relativeDaysAgo", { days });
  return date.toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" });
}

export async function LiveAnchor() {
  const t = await getTranslations("home");

  let latestPaper: { createdAt: Date } | null = null;
  try {
latestPaper = (await db.findFirst("PastPaper", {
    orderBy: { createdAt: "desc" },
    select: ["createdAt"],
  })) as { createdAt: Date } | null;
  } catch {
    latestPaper = null;
  }

  return (
    <div className={`${styles.liveAnchorNote} ${styles.liveAnchorSignal}`}>
      <div className={styles.liveAnchorPulse}>
        <span className={styles.liveAnchorDot} aria-hidden="true" />
        {t("liveAnchorSignal")}
      </div>
      {latestPaper ? (
        <p style={{ margin: 0, color: "var(--text-1)", fontSize: "0.93rem" }}>
          {t("liveAnchorLastAdded", { relativeDate: formatRelativeDate(latestPaper.createdAt, t) })}
        </p>
      ) : (
        <p style={{ margin: 0, color: "var(--text-2)", fontSize: "0.93rem" }}>{t("liveAnchorUnavailable")}</p>
      )}
      <Link className={styles.secondaryButton} href="/past-papers" prefetch={false} style={{ justifySelf: "start" }}>
        {t("liveAnchorBrowsePapers")}
      </Link>
    </div>
  );
}

export function LiveAnchorSkeleton() {
  return (
    <div className={`${styles.liveAnchorNote} ${styles.liveAnchorSignal}`} aria-hidden="true">
      <div className={styles.liveAnchorPulse}>
        <span className={styles.liveAnchorDot} />
        <span className="eyebrow" style={{ opacity: 0.4 }}>Checking&hellip;</span>
      </div>
      <p className={styles.skeletonLine} style={{ width: "70%" }} />
      <p className={styles.skeletonLine} style={{ width: "45%" }} />
    </div>
  );
}