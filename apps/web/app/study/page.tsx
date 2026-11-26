import { Suspense } from "react";
import StudyChat from "@/components/study/StudyChat";

export const dynamic = "force-dynamic";

export default async function StudyPage() {
  return (
    <Suspense fallback={null}>
      <StudyChat />
    </Suspense>
  );
}
