"use client";

import { useState } from "react";
import Link from "next/link";
import styles from "./page.module.css";

export default function PoolPage() {
  const [notified, setNotified] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("pool_notify") === "1";
  });

  const handleNotify = () => {
    localStorage.setItem("pool_notify", "1");
    setNotified(true);
  };

  return (
    <div className="route-lock-dock">
      <div className="route-lock-frame glass card">
        <div className={styles.wrap}>
          <span className={styles.badge}>Coming soon</span>
          <h1>8-Ball Pool</h1>
          <p className="subtitle">
            A fully physics-accurate 8-ball pool table in your browser. Challenge classmates, practise trick shots, and earn credits.
            We're still polishing the physics engine.
          </p>

          <div className={styles.preview}>
            <svg viewBox="0 0 260 140" width="260" height="140" aria-hidden>
              {/* table felt */}
              <rect x="0" y="0" width="260" height="140" fill="rgba(5,90,30,0.6)" rx="8" />
              {/* cushions */}
              <rect x="6" y="6" width="248" height="128" fill="none" stroke="rgba(120,80,30,0.8)" strokeWidth="12" rx="6" />
              {/* pockets */}
              {[[14,14],[130,8],[246,14],[14,126],[130,132],[246,126]].map(([cx,cy], i) => (
                <circle key={i} cx={cx} cy={cy} r="9" fill="#111" />
              ))}
              {/* balls */}
              {[
                [80,70,"#f5f5f5"],[96,62,"#f59e0b"],[96,78,"#e8c15a"],
                [112,54,"#dc2626"],[112,70,"#111"],[112,86,"#10b981"],
                [128,46,"#e8c15a"],[128,62,"#f97316"],[128,78,"#0ea5e9"],
              ].map(([cx,cy,fill], i) => (
                <circle key={i} cx={cx as number} cy={cy as number} r="7" fill={fill as string} />
              ))}
              {/* cue ball */}
              <circle cx="190" cy="70" r="7" fill="white" stroke="rgba(0,0,0,0.1)" strokeWidth="1" />
              {/* cue stick */}
              <line x1="200" y1="70" x2="245" y2="58" stroke="rgba(180,140,60,0.9)" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </div>

          <div className={styles.actions}>
            {notified ? (
              <span style={{ fontSize: "0.85rem", color: "var(--muted)", padding: "8px 0" }}>
                ✓ You'll be notified when Pool launches
              </span>
            ) : (
              <button className="button" onClick={handleNotify}>Notify me when it's ready</button>
            )}
            <Link className="button" href="/community/games">← All games</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
