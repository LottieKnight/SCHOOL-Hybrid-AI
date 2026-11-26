"use client";

import { useEffect, useState } from "react";
import { API_BASE } from "@/lib/apiBase";
import { useSession } from "@/components/SessionProvider";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

type ReferralStats = {
  count: number;
  creditsEarned: number;
  bonusPerReferral: number;
};

type ReferralCode = {
  code: string;
  shareUrl: string;
};

export function ReferralDashboard() {
  const { session } = useSession();
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [code, setCode] = useState<ReferralCode | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) return;

    const fetchData = async () => {
      try {
        const [statsRes, codeRes] = await Promise.all([
          fetch(`${API_BASE}/referrals/stats`, { credentials: "include" }),
          fetch(`${API_BASE}/referrals/my-code`, { credentials: "include" }),
        ]);

        if (statsRes.ok) setStats(await statsRes.json());
        if (codeRes.ok) setCode(await codeRes.json());
      } catch (error) {
        console.error("Failed to fetch referral data", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [session]);

  const copyToClipboard = () => {
    if (code?.shareUrl) {
      navigator.clipboard.writeText(code.shareUrl);
      alert("Link copied to clipboard!");
    }
  };

  const shareWhatsApp = () => {
    if (code?.shareUrl) {
      const text = `Join me on SCHOOL! Use my link to get a 25 credit welcome bonus: ${code.shareUrl}`;
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
    }
  };

  if (loading) return <div>Loading impact...</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Student Impact</CardTitle>
      </CardHeader>
      <CardBody>
        <div style={{ display: "grid", gap: "20px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div style={{ textAlign: "center", padding: "16px", background: "var(--surface-2)", borderRadius: "12px" }}>
              <div style={{ fontSize: "24px", fontWeight: "bold", color: "var(--gold)" }}>{stats?.count || 0}</div>
              <div style={{ fontSize: "12px", color: "var(--text-3)" }}>Classmates Joined</div>
            </div>
            <div style={{ textAlign: "center", padding: "16px", background: "var(--surface-2)", borderRadius: "12px" }}>
              <div style={{ fontSize: "24px", fontWeight: "bold", color: "var(--green)" }}>{stats?.creditsEarned || 0}</div>
              <div style={{ fontSize: "12px", color: "var(--text-3)" }}>Credits Earned</div>
            </div>
          </div>

          <div style={{ display: "grid", gap: "8px" }}>
            <div style={{ fontSize: "14px", fontWeight: "500" }}>Share your referral link</div>
            <div style={{ display: "flex", gap: "8px", background: "var(--surface-3)", padding: "10px", borderRadius: "8px", fontSize: "12px", fontFamily: "var(--font-mono)", overflow: "hidden", textOverflow: "ellipsis" }}>
              {code?.shareUrl}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "4px" }}>
              <Button variant="ghost" size="sm" onClick={copyToClipboard}>
                Copy Link
              </Button>
              <Button variant="gold" size="sm" onClick={shareWhatsApp} style={{ backgroundColor: "#25D366", color: "white", border: "none" }}>
                WhatsApp
              </Button>
            </div>
          </div>
          <p style={{ fontSize: "11px", color: "var(--text-4)", textAlign: "center", margin: 0 }}>
            Earn {stats?.bonusPerReferral || 50} credits for every friend who joins. They get 25 credits too!
          </p>
        </div>
      </CardBody>
    </Card>
  );
}
