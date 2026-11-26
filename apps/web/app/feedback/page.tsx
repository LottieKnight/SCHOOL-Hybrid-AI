"use client";

import { useEffect, useState } from "react";
import { RouteHeader } from "@/components/ui/RouteHeader";
import { Card, CardBody } from "@/components/ui/Card";
import styles from "./page.module.css";

type Feature = {
  id: string;
  title: string;
  description: string;
  status: string;
  vote_count: number;
  user_voted: boolean;
};

export default function FeedbackPage() {
  const [features, setFeatures] = useState<Feature[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFeatures = () => {
    fetch("/api/feedback/features")
      .then(res => res.json())
      .then(d => {
        setFeatures(d.features ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchFeatures();
  }, []);

  const handleVote = (featureId: string) => {
    fetch("/api/feedback/features/vote", {
      method: "POST",
      body: JSON.stringify({ featureId }),
    }).then(res => res.json())
    .then(() => fetchFeatures());
  };

  return (
    <div className={styles.container}>
      <RouteHeader
        title="Product Roadmap"
        description="Vote on upcoming features and tell us what we should build next."
      />

      <div className={styles.grid}>
        {loading ? (
          <p className={styles.empty}>Loading roadmap...</p>
        ) : (
          features.map((f) => (
            <Card key={f.id} className={styles.card}>
              <CardBody className={styles.cardBody}>
                <div className={styles.voteSection}>
                  <button
                    className={styles.voteBtn}
                    data-active={f.user_voted}
                    onClick={() => handleVote(f.id)}
                  >
                    <span className={styles.arrow}>▲</span>
                    <span className={styles.count}>{f.vote_count}</span>
                  </button>
                </div>
                <div className={styles.content}>
                  <div className={styles.meta}>
                    <h3 className={styles.featureTitle}>{f.title}</h3>
                    <span className={styles.status} data-status={f.status}>{f.status.replace('_', ' ')}</span>
                  </div>
                  <p className={styles.featureDesc}>{f.description}</p>
                </div>
              </CardBody>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
