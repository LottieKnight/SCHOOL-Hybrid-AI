import { useQuery } from "@tanstack/react-query";
import { Text, View, StyleSheet } from "react-native";
import { Screen } from "../../src/components/ui/Screen";
import { GlassCard } from "../../src/components/ui/GlassCard";
import { Button } from "../../src/components/ui/Button";
import { ProgressRing } from "../../src/components/ui/ProgressRing";
import { colors, spacing } from "../../src/theme/tokens";
import { fetchModuleCatalog, getFeaturedModule } from "../../src/lib/api/learn";
import { OFFLINE_CACHE } from "../../src/lib/queryClient";
import { fetchXpSummary } from "../../src/lib/api/xp";
import { XpStrip } from "../../src/components/gamification/XpStrip";
import { router } from "expo-router";

export default function HomeScreen() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["module-catalog"],
    queryFn: fetchModuleCatalog,
    ...OFFLINE_CACHE,
  });

  const {
    data: xpSummary,
    isLoading: isXpLoading,
    isError: isXpError,
  } = useQuery({
    queryKey: ["xp-summary"],
    queryFn: fetchXpSummary,
    staleTime: 60_000,
  });

  const featured = data ? getFeaturedModule(data.modules) : null;

  return (
    <Screen scroll>
      <View style={styles.hero}>
        <Text style={styles.kicker}>TODAY</Text>
        <Text style={styles.title}>Keep momentum without the desktop friction.</Text>
      </View>

      <XpStrip summary={xpSummary} isLoading={isXpLoading} isError={isXpError} />

      <GlassCard>
        {isLoading ? (
          <Text style={styles.cardCopy}>Loading live modules...</Text>
        ) : isError ? (
          <Text style={styles.cardCopy}>Could not load the live catalog just now.</Text>
        ) : featured ? (
          <>
            <View style={styles.row}>
              <View style={{ flex: 1, gap: 8 }}>
                <Text style={styles.cardTitle}>{featured.moduleCode}</Text>
                <Text style={styles.cardCopy}>{featured.moduleName}</Text>
                <Text style={styles.meta}>
                  {featured.programme ?? "Study module"} · {featured.semester ?? "Live content"}
                </Text>
              </View>
              <ProgressRing progress={featured.confidence} label="live" />
            </View>
            <View style={styles.availabilityBadge}>
              <Text style={styles.availabilityText}>{featured.lessonAvailability.label}</Text>
            </View>
            <Button onPress={() => router.push(`/learn/${featured.moduleCode.toLowerCase()}`)}>Continue learning</Button>
          </>
        ) : (
          <Text style={styles.cardCopy}>No live modules found yet.</Text>
        )}
      </GlassCard>

      <GlassCard>
        <Text style={styles.cardTitle}>Quick actions</Text>
        <Text style={styles.cardCopy}>Open your learn hub, review chapters, or jump into practice when you are ready.</Text>
      </GlassCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  kicker: {
    color: colors.gold,
    fontWeight: "800",
    letterSpacing: 2,
    fontSize: 12,
  },
  title: {
    color: colors.text,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "800",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  cardTitle: {
    color: colors.text,
    fontWeight: "700",
    fontSize: 17,
  },
  cardCopy: {
    color: colors.textMuted,
    lineHeight: 21,
    fontSize: 14,
  },
  meta: {
    color: colors.textSoft,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  availabilityBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,215,0,0.12)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,215,0,0.32)",
    marginBottom: spacing.md,
  },
  availabilityText: {
    color: colors.goldStrong,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
});
