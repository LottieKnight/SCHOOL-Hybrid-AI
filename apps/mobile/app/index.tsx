import { useEffect, useRef, useState } from "react";
import { Redirect } from "expo-router";
import { useAuthStore } from "../src/store/authStore";
import { useCelebrationStore } from "../src/store/celebrationStore";
import { fetchCommunityStreak } from "../src/lib/api/community";
import { AppSplash } from "../src/components/AppSplash";

export default function Index() {
  const isHydrated = useAuthStore((state) => state.isHydrated);
  const token = useAuthStore((state) => state.token);
  const triggerCelebration = useCelebrationStore((state) => state.trigger);
  const [splashDone, setSplashDone] = useState(false);
  const streakCelebrated = useRef(false);

  // App-open streak celebration (#40): fire once per open for signed-in
  // users with an active community streak above the milestone threshold.
  useEffect(() => {
    if (!splashDone || !token || streakCelebrated.current) return;
    streakCelebrated.current = true;
    void (async () => {
      try {
        const streak = await fetchCommunityStreak();
        if (streak.current > 3) {
          triggerCelebration({
            kind: "streak",
            title: "On fire!",
            message: `${streak.current}-day community streak. Keep showing up.`,
          });
        }
      } catch {
        /* treat a failed streak fetch as no celebration */
      }
    })();
  }, [splashDone, token, triggerCelebration]);

  if (!isHydrated || !splashDone) {
    return <AppSplash onComplete={() => setSplashDone(true)} />;
  }

  return <Redirect href={token ? "/(tabs)" : "/(auth)/welcome"} />;
}