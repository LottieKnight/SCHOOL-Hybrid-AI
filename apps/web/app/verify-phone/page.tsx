"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { RouteHeader } from "@/components/ui/RouteHeader";
import { StateCard } from "@/components/ui/StateCard";
import { useSession } from "@/components/SessionProvider";

function VerifyPhoneContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session, refresh } = useSession();
  const [phone, setPhone] = useState("+27");
  const [otp, setOtp] = useState("");
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [resendCooldown]);

  const nextPath = useMemo(() => {
    const value = searchParams.get("next");
    return value && value.startsWith("/") ? value : "/dashboard";
  }, [searchParams]);

  const handleSend = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/verify-phone", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phone }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; phone?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Unable to send the verification code.");
      }
      setPhone(payload.phone || phone);
      setSent(true);
      setResendCooldown(60);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Unable to send the verification code.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerify = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/confirm-phone", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phone, otp }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Unable to verify the code.");
      }
      await refresh();
      router.push(nextPath);
      router.refresh();
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : "Unable to verify the code.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="animate-fade-up"
      style={{
        maxWidth: "640px",
        margin: "0 auto",
        display: "grid",
        gap: "24px",
      }}
    >
      <RouteHeader
        eyebrow="Phone Verification"
        title="Verify your phone"
        description="Phone verification is required for marketplace listings and tutor marketplace access. It is not required for the AI Tutor or resource library."
      />

      <section
        className="glass"
        style={{
          display: "grid",
          gap: "18px",
          padding: "28px",
        }}
      >
        {session?.user?.isPhoneVerified ? (
          <StateCard
            tone="success"
            title="Phone already verified"
            description="Your account is already cleared for tutor marketplace access."
          >
            <Button variant="outline" onClick={() => router.push(nextPath)}>
              Continue
            </Button>
          </StateCard>
        ) : (
          <>
            <div style={{ display: "grid", gap: "8px" }}>
              <label htmlFor="verify-phone-number">Phone number</label>
              <input
                id="verify-phone-number"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="+27 82 123 4567"
              />
            </div>

            {!sent ? (
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <Button variant="gold" onClick={handleSend} disabled={submitting || phone.trim().length < 8}>
                  {submitting ? "Sending..." : "Send verification code"}
                </Button>
              </div>
            ) : (
              <>
                <div style={{ display: "grid", gap: "8px" }}>
                  <label htmlFor="verify-phone-otp">Verification code</label>
                  <input
                    id="verify-phone-otp"
                    value={otp}
                    onChange={(event) => setOtp(event.target.value)}
                    placeholder="6-digit code"
                    inputMode="numeric"
                  />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <Button variant="ghost" onClick={() => setSent(false)} disabled={submitting}>
                      Change number
                    </Button>
                    <Button variant="ghost" onClick={handleSend} disabled={submitting || resendCooldown > 0}>
                      {submitting ? "Sending..." : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
                    </Button>
                  </div>
                  <Button variant="gold" onClick={handleVerify} disabled={submitting || otp.trim().length < 4}>
                    {submitting ? "Verifying..." : "Verify"}
                  </Button>
                </div>
              </>
            )}
          </>
        )}

        {error ? <div className="assistant-error">{error}</div> : null}
      </section>
    </div>
  );
}

export default function VerifyPhonePage() {
  return (
    <Suspense fallback={<StateCard title="Loading phone verification" description="Preparing the verification flow." />}>
      <VerifyPhoneContent />
    </Suspense>
  );
}
