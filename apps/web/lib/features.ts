// Feature flags — safe, env-driven, default OFF for risky/regulated features.
// B5: the "Observational Silence" research study collects telemetry from users
// (incl. minors with guardian consent) and is DRAFT pending NWU REC + POPIA approval.
// It MUST stay disabled until that clearance is confirmed. Do not default this to true.

export const RESEARCH_STUDY_ENABLED =
  process.env.NEXT_PUBLIC_RESEARCH_STUDY_ENABLED === "true";

export function isResearchStudyEnabled(): boolean {
  return RESEARCH_STUDY_ENABLED;
}
