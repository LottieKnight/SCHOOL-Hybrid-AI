export type EvidenceSource = {
  label: string;
  type: string;
  href?: string;
};

export type RecoveryResult = {
  originalPercent: number | null;
  retryPercent: number | null;
  deltaPercent: number | null;
  originalScore?: number | null;
  originalMax?: number | null;
  retryScore?: number | null;
  retryMax?: number | null;
  focusConcept?: string | null;
};

export type SessionSummaryData = {
  title: string;
  kind: string;
  subject?: string | null;
  completedAt?: string | null;
  result?: RecoveryResult | null;
  evidence: EvidenceSource[];
  takeaways: string[];
  nextAction: string;
};
