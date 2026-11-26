import "server-only";

import type { LessonGenerationPlan } from "@/lib/lessonGenerationPlan";

export type LessonGenerationJob = {
  id: string;
  queueKey: string;
  planStudyType: "school" | "university";
  targetId: string;
  targetType: "subject" | "module";
  label: string;
  storagePath: string;
  storagePattern?: string;
  status: "queued" | "processing" | "completed" | "failed";
  attempts: number;
  error: string | null;
  metadata: Record<string, string | number | boolean | null>;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  failedAt: string | null;
};

export type LessonGenerationQueueState = {
  version: 1;
  planSummary: string;
  storageRoot: string;
  jobs: LessonGenerationJob[];
};

export function materializeLessonGenerationQueue(
  plan: LessonGenerationPlan,
  existing: LessonGenerationQueueState | null | undefined
): LessonGenerationQueueState {
  const now = new Date().toISOString();
  const existingByKey = new Map((existing?.jobs ?? []).map((job) => [job.queueKey, job]));

  const jobs = plan.targets.map((target, index) => {
    const current = existingByKey.get(target.queueKey);
    return {
      id: current?.id ?? `${target.queueKey}:${index + 1}`,
      queueKey: target.queueKey,
      planStudyType: plan.studyType,
      targetId: target.id,
      targetType: target.targetType,
      label: target.label,
      storagePath: target.storagePath,
      storagePattern: target.storagePattern,
      status: current?.status ?? "queued",
      attempts: current?.attempts ?? 0,
      error: current?.error ?? null,
      metadata: target.metadata,
      createdAt: current?.createdAt ?? now,
      updatedAt: now,
      startedAt: current?.startedAt ?? null,
      completedAt: current?.completedAt ?? null,
      failedAt: current?.failedAt ?? null,
    } satisfies LessonGenerationJob;
  });

  return {
    version: 1,
    planSummary: plan.summary,
    storageRoot: plan.storageRoot,
    jobs,
  };
}
