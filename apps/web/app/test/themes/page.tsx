"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { SchoolLogo } from "@/components/ui/SchoolLogo";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { UNIVERSITY_BRANDS, applyBrandTheme, getContrastRatio, passesWcagAa, type UniversityBrandId } from "@/lib/brand-utils";

const BRAND_IDS = ["NWU", "UCT", "UJ", "WITS", "UP"] as const satisfies UniversityBrandId[];
const BASE_UI = "#07101F";

export default function ThemeTestPage() {
  const [activeBrandId, setActiveBrandId] = useState<UniversityBrandId>("NWU");
  const activeBrand = UNIVERSITY_BRANDS[activeBrandId];

  useEffect(() => {
    applyBrandTheme(activeBrand);
  }, [activeBrand]);

  const audit = useMemo(() => {
    const ratio = getContrastRatio(activeBrand.primary, BASE_UI);
    return {
      ratio,
      pass: passesWcagAa(activeBrand.primary, BASE_UI),
    };
  }, [activeBrand]);

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "var(--space-5)",
        background:
          "radial-gradient(circle at top left, color-mix(in srgb, var(--brand-primary) 22%, transparent) 0%, transparent 42%), radial-gradient(circle at bottom right, color-mix(in srgb, var(--brand-secondary) 18%, transparent) 0%, transparent 38%), linear-gradient(180deg, #07101F 0%, #040C18 100%)",
      }}
    >
      <div style={{ maxWidth: "1180px", margin: "0 auto", display: "grid", gap: "var(--space-5)" }}>
        <section style={{ display: "grid", gap: "var(--space-4)", justifyItems: "center", textAlign: "center" }}>
          <SchoolLogo size={104} />
          <div>
            <div className="eyebrow">Internal Theme Review</div>
            <h1 style={{ fontSize: "clamp(2.8rem, 6vw, 5rem)", color: "var(--brand-primary)" }}>SCHOOL</h1>
            <p style={{ color: "var(--text-2)", maxWidth: "760px" }}>
              University skin switching, liquid-glass surfaces, tactile buttons, and WCAG contrast auditing in one route.
            </p>
          </div>
        </section>

        <section style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", justifyContent: "center" }}>
          {BRAND_IDS.map((brandId) => {
            const brand = UNIVERSITY_BRANDS[brandId];
            const active = brandId === activeBrandId;
            return (
              <button
                key={brandId}
                onClick={() => setActiveBrandId(brandId)}
                className={active ? "ui-button ui-button--gold ui-button--sm" : "ui-button ui-button--outline ui-button--sm"}
                style={
                  active
                    ? undefined
                    : {
                        borderColor: "color-mix(in srgb, var(--brand-primary) 24%, rgba(255,255,255,0.14))",
                      }
                }
              >
                {brand.id}
              </button>
            );
          })}
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "var(--space-4)" }}>
          <Card>
            <CardHeader>
              <CardTitle>Logo + Brand Presence</CardTitle>
            </CardHeader>
            <CardBody style={{ display: "grid", gap: "var(--space-3)", alignItems: "start" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                <SchoolLogo size={84} />
                <div>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: "2rem", color: "var(--brand-primary)" }}>SCHOOL</div>
                  <div style={{ color: "var(--text-2)" }}>{activeBrand.id} institutional skin active</div>
                </div>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                <Badge variant="gold">{activeBrand.primary}</Badge>
                <Badge variant="neutral">{activeBrand.secondary}</Badge>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Button Physics</CardTitle>
            </CardHeader>
            <CardBody style={{ display: "flex", flexWrap: "wrap", gap: "0.875rem", alignItems: "center" }}>
              <Button variant="gold">Primary Action</Button>
              <Button variant="outline">Secondary Action</Button>
              <Button variant="ghost">Ghost Action</Button>
            </CardBody>
          </Card>

          <motion.section whileHover={{ scale: 1.02 }} transition={{ type: "spring", stiffness: 360, damping: 24 }}>
            <Card>
              <CardHeader>
                <CardTitle>Liquid Glass Surface</CardTitle>
              </CardHeader>
              <CardBody style={{ display: "grid", gap: "var(--space-3)" }}>
                <p style={{ color: "var(--text-2)" }}>
                  This card previews the glass treatment, border softness, and brand glow behavior for {activeBrand.id}.
                </p>
                <div
                  style={{
                    borderRadius: "1.25rem",
                    padding: "var(--space-4)",
                    background: "linear-gradient(135deg, color-mix(in srgb, var(--brand-primary) 18%, transparent), color-mix(in srgb, var(--brand-secondary) 15%, transparent))",
                    border: "1px solid rgba(255,255,255,0.12)",
                  }}
                >
                  <strong style={{ color: "var(--brand-primary)" }}>Prestige, not clutter.</strong>
                </div>
              </CardBody>
            </Card>
          </motion.section>
        </section>
      </div>

      <div
        style={{
          position: "fixed",
          right: "24px",
          bottom: "24px",
          borderRadius: "1rem",
          padding: "1rem 1.1rem",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          background: audit.pass ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)",
          border: audit.pass ? "1px solid rgba(16,185,129,0.3)" : "1px solid rgba(239,68,68,0.3)",
          boxShadow: "0 14px 28px rgba(0,0,0,0.22)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span
            style={{
              width: "0.7rem",
              height: "0.7rem",
              borderRadius: "999px",
              background: audit.pass ? "#10B981" : "#EF4444",
              boxShadow: audit.pass ? "0 0 16px rgba(16,185,129,0.45)" : "0 0 16px rgba(239,68,68,0.45)",
            }}
          />
          <div>
            <div style={{ fontSize: "0.72rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--text-2)" }}>
              WCAG AA Audit
            </div>
            <div style={{ fontFamily: "var(--font-mono)", color: "var(--text-1)" }}>
              {audit.ratio.toFixed(2)}:1 {audit.pass ? "PASS" : "FAIL"}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
