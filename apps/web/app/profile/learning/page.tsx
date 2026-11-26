"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { GuestPrompt } from "@/components/ui/GuestPrompt";
import { RouteHeader } from "@/components/ui/RouteHeader";
import { useSession } from "@/components/SessionProvider";
import { StateCard } from "@/components/ui/StateCard";

type MemoryBand = "Needs Review" | "Developing" | "Confident";

type MemoryConcept = {
  concept_key: string;
  concept_label: string;
  module_code: string | null;
  module_label: string;
  qualitative_band: MemoryBand;
  is_new_concept: boolean;
  last_seen_at: string | null;
  last_practiced_at: string | null;
};

type MemoryProfileModule = {
  module_code: string | null;
  module_label: string;
  bands: {
    new_concepts: MemoryConcept[];
    needs_review: MemoryConcept[];
    developing: MemoryConcept[];
    confident: MemoryConcept[];
  };
};

type MemoryProfileResponse = {
  modules: MemoryProfileModule[];
};

const BAND_META: Record<MemoryBand, { variant: "red" | "amber" | "green"; label: string }> = {
  "Needs Review": { variant: "red", label: "Needs Review" },
  Developing: { variant: "amber", label: "Developing" },
  Confident: { variant: "green", label: "Confident" },
};

function formatDate(value: string | null) {
  if (!value) return "Recently added";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently added";
  return date.toLocaleDateString("en-ZA", { month: "short", day: "numeric", year: "numeric" });
}

export default function LearningJourneyPage() {
  const { authState, loading: sessionLoading } = useSession();
  const [profile, setProfile] = useState<MemoryProfileResponse>({ modules: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/memory/profile", {
        credentials: "include",
        cache: "no-store",
      });
      const data = (await response.json().catch(() => ({ modules: [] }))) as MemoryProfileResponse & { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Unable to load your learning memory.");
      }
      setProfile({ modules: Array.isArray(data.modules) ? data.modules : [] });
    } catch (fetchError) {
      setProfile({ modules: [] });
      setError(fetchError instanceof Error ? fetchError.message : "Unable to load your learning memory.");
    } finally {
      setLoading(false);
    }
  }, []);

  const totalConcepts = profile.modules.reduce(
    (sum, moduleEntry) =>
      sum +
      moduleEntry.bands.new_concepts.length +
      moduleEntry.bands.needs_review.length +
      moduleEntry.bands.developing.length +
      moduleEntry.bands.confident.length,
    0
  );

  useEffect(() => {
    if (sessionLoading || authState.isGuest) return;
    void loadProfile();
  }, [authState.isGuest, loadProfile, sessionLoading]);

  if (sessionLoading) {
    return <StateCard title="Loading your learning journey" description="Checking your account and study memory." />;
  }

  if (authState.isGuest) {
    return (
      <div className="learning-journey-page">
        <RouteHeader
          eyebrow="Learning Memory"
          title="Your Learning Journey"
          description="Sign in to see your saved concepts, review targets, and study memory."
        />
        <GuestPrompt reason="view your learning journey" />
      </div>
    );
  }

  const resetConcept = async (conceptKey: string, moduleCode: string | null) => {
    setBusyKey(`${moduleCode || "general"}:${conceptKey}`);
    setError(null);
    try {
      const response = await fetch("/api/memory/reset", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          concept_key: conceptKey,
          module_code: moduleCode,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Unable to reset this topic.");
      }
      await loadProfile();
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "Unable to reset this topic.");
    } finally {
      setBusyKey(null);
    }
  };

  const resetAll = async () => {
    if (typeof window !== "undefined") {
      const confirmed = window.confirm(
        "Start fresh? SCHOOL will stop personalising from your past memory signals, but it will keep your history for auditability."
      );
      if (!confirmed) return;
    }

    setBusyKey("all");
    setError(null);
    try {
      const response = await fetch("/api/memory/reset", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Unable to start fresh.");
      }
      await loadProfile();
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "Unable to start fresh.");
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="learning-journey-page">
      <RouteHeader
        eyebrow="Learning Memory"
        title="Your Learning Journey"
        description="SCHOOL uses your recent sessions and study behaviour to personalise support, surface review targets, and carry your learning context forward without showing punitive metrics."
      >
        <div className="learning-journey-actions">
          <Link className="button" href="/dashboard">
            Back to dashboard
          </Link>
          <Button variant="outline" onClick={resetAll} disabled={busyKey === "all"}>
            Start fresh
          </Button>
        </div>
      </RouteHeader>

      <section className="learning-journey-summary glass card animate-fade-up">
        <div>
          <strong>{totalConcepts}</strong>
          <span>tracked concepts</span>
        </div>
        <p className="subtitle">Resetting a topic removes it from personalisation, but keeps the historical event record.</p>
      </section>

      {error ? <div className="assistant-error">{error}</div> : null}

      {loading ? (
        <StateCard title="Loading your learning memory" description="We are collecting your latest concepts and review cues." />
      ) : profile.modules.length === 0 ? (
        <StateCard
          title="No learning memory yet"
          description="Start a study session or open a resource. SCHOOL will begin carrying concepts forward once you interact with the assistant and library."
        />
      ) : (
        <div className="learning-journey-modules">
          {profile.modules.map((moduleEntry) => (
            <Card key={moduleEntry.module_label} className="animate-fade-up">
              <CardHeader>
                <CardTitle>{moduleEntry.module_label}</CardTitle>
              </CardHeader>
              <CardBody>
                <div className="learning-journey-band-stack">
                  {moduleEntry.bands.new_concepts.length > 0 ? (
                    <section className="learning-journey-band">
                      <div className="learning-journey-band-header">
                        <Badge variant="gold">New Territory</Badge>
                        <span className="text-dim">First time exploring</span>
                      </div>
                      <div className="learning-journey-concepts">
                        {moduleEntry.bands.new_concepts.map((concept) => (
                          <div key={concept.concept_key} className="learning-journey-concept-row">
                            <div>
                              <strong>{concept.concept_label}</strong>
                              <p>Last seen {formatDate(concept.last_seen_at)}</p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => resetConcept(concept.concept_key, concept.module_code)}
                              disabled={busyKey === `${concept.module_code || "general"}:${concept.concept_key}`}
                            >
                              Reset this topic
                            </Button>
                          </div>
                        ))}
                      </div>
                    </section>
                  ) : null}

                  {(["Needs Review", "Developing", "Confident"] as MemoryBand[]).map((band) => {
                    const concepts =
                      band === "Needs Review"
                        ? moduleEntry.bands.needs_review
                        : band === "Developing"
                          ? moduleEntry.bands.developing
                          : moduleEntry.bands.confident;
                    if (concepts.length === 0) return null;

                    return (
                      <section key={band} className="learning-journey-band">
                        <div className="learning-journey-band-header">
                          <Badge variant={BAND_META[band].variant}>{BAND_META[band].label}</Badge>
                        </div>
                        <div className="learning-journey-concepts">
                          {concepts.map((concept) => (
                            <div key={concept.concept_key} className="learning-journey-concept-row">
                              <div>
                                <strong>{concept.concept_label}</strong>
                                <p>
                                  Last seen {formatDate(concept.last_seen_at)}
                                  {concept.last_practiced_at ? ` · Practised ${formatDate(concept.last_practiced_at)}` : ""}
                                </p>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => resetConcept(concept.concept_key, concept.module_code)}
                                disabled={busyKey === `${concept.module_code || "general"}:${concept.concept_key}`}
                              >
                                Reset this topic
                              </Button>
                            </div>
                          ))}
                        </div>
                      </section>
                    );
                  })}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
