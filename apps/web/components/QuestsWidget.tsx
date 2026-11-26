"use client";

import { useEffect, useState } from "react";
import styles from "./QuestsWidget.module.css";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

type Quest = {
  id: string;
  title: string;
  description: string;
  target_value: number;
  current_value: number;
  reward_xp: number;
  is_claimed: boolean;
};

export function QuestsWidget() {
  const [quests, setQuests] = useState<Quest[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchQuests = () => {
    fetch("/api/gamification/quests")
      .then(res => res.json())
      .then(d => {
        setQuests(d.quests ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchQuests();
  }, []);

  const handleClaim = (questId: string) => {
    fetch("/api/gamification/quests", {
      method: "POST",
      body: JSON.stringify({ questId }),
    }).then(res => res.json())
    .then(() => fetchQuests());
  };

  if (loading) return <div className={styles.loading}>Generating quests...</div>;

  return (
    <Card className={styles.container}>
      <CardBody>
        <div className={styles.header}>
          <h3 className={styles.title}>Daily Quests</h3>
          <span className={styles.timer}>Resets in 12h</span>
        </div>

        <div className={styles.list}>
          {quests.map(q => {
            const progress = Math.min(100, (q.current_value / q.target_value) * 100);
            const isReady = q.current_value >= q.target_value && !q.is_claimed;
            
            return (
              <div key={q.id} className={styles.quest} data-claimed={q.is_claimed}>
                <div className={styles.questMain}>
                  <div className={styles.questInfo}>
                    <span className={styles.questTitle}>{q.title}</span>
                    <span className={styles.questDesc}>{q.description}</span>
                  </div>
                  <span className={styles.reward}>{q.reward_xp} XP</span>
                </div>
                
                <div className={styles.progressRow}>
                  <div className={styles.progressBar}>
                    <div className={styles.progressFill} style={{ width: `${progress}%` }} />
                  </div>
                  <span className={styles.progressText}>{q.current_value}/{q.target_value}</span>
                </div>

                {isReady && (
                  <Button variant="gold" size="sm" className={styles.claimBtn} onClick={() => handleClaim(q.id)}>
                    Claim Reward
                  </Button>
                )}
                {q.is_claimed && <span className={styles.claimedText}>Claimed ✅</span>}
              </div>
            );
          })}
        </div>
      </CardBody>
    </Card>
  );
}
