import { assemblePresenceMoments, type HomepageMoment } from "@/lib/homepage/presenceAssembly";
import styles from "@/app/page.module.css";

const TYPE_LABEL: Record<HomepageMoment["type"], string> = {
  community: "Community",
  academic: "Study",
  leaderboard: "Leaderboard",
  milestone: "Milestone",
};

export async function HomepagePresenceStrip() {
  const moments = await assemblePresenceMoments();
  if (moments.length === 0) return null;

  return (
    <div className={styles.presenceStrip} aria-label="Live campus activity">
      <span className={styles.presencePulse} aria-hidden="true" />
      <span className={styles.presenceLabel}>Live</span>
      <div className={styles.presenceItems} role="list">
        {moments.map((m, i) => (
          <div key={i} className={styles.presenceItem} data-type={m.type} role="listitem">
            <span className={styles.presenceType}>{TYPE_LABEL[m.type]}</span>
            <span className={styles.presenceText}>{m.text}</span>
            {m.subtext && <span className={styles.presenceSubtext}>{m.subtext}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
