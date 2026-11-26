"use client";

import { useEffect, useState } from "react";
import styles from "./MentorMatchCard.module.css";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

type Mentor = {
  id: string;
  name: string;
  xp: number;
  role: string;
};

export function MentorMatchCard() {
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/community/mentor-match")
      .then(res => res.json())
      .then(d => {
        setMentors(d.mentors ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return null;
  if (mentors.length === 0) return null;

  return (
    <Card className={styles.container}>
      <CardBody>
        <h3 className={styles.title}>Suggested Connections</h3>
        <p className={styles.subtitle}>Peer mentors who can help you with your current modules.</p>
        
        <div className={styles.list}>
          {mentors.map(m => (
            <div key={m.id} className={styles.mentor}>
              <div className={styles.avatar}>{m.name.slice(0, 1)}</div>
              <div className={styles.meta}>
                <span className={styles.name}>{m.name}</span>
                <span className={styles.xp}>{m.xp.toLocaleString()} XP · {m.role}</span>
              </div>
              <Button variant="outline" size="sm">Connect</Button>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}
