"use client";

import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";

type LoadsheddingStatus = {
  stage: number;
  nextEvent: string;
  isOutageNow: boolean;
};

export function LoadsheddingTracker() {
  const [status, setStatus] = useState<LoadsheddingStatus | null>(null);

  useEffect(() => {
    // Simulated EskomSePush data for demo purposes
    // In production, this would fetch from a proxy API to ESP
    setTimeout(() => {
      setStatus({
        stage: 2,
        nextEvent: "16:00 - 18:30",
        isOutageNow: false,
      });
    }, 1500);
  }, []);

  if (!status) return null;

  return (
    <Card style={{ borderLeft: `4px solid ${status.isOutageNow ? "var(--red)" : "var(--amber)"}` }}>
      <CardHeader>
        <CardTitle style={{ fontSize: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
          🔌 Loadshedding: Stage {status.stage}
        </CardTitle>
      </CardHeader>
      <CardBody>
        <div style={{ fontSize: "13px" }}>
          {status.isOutageNow ? (
            <div style={{ color: "var(--red)", fontWeight: "bold" }}>Outage Active until {status.nextEvent.split("-")[1]}</div>
          ) : (
            <div>Next scheduled: <span style={{ color: "var(--amber)" }}>{status.nextEvent}</span></div>
          )}
          <p style={{ fontSize: "11px", color: "var(--text-4)", marginTop: "8px", marginBottom: 0 }}>
            Make sure to download your study materials for offline use!
          </p>
        </div>
      </CardBody>
    </Card>
  );
}
