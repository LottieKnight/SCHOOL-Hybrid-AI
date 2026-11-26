import { StyleSheet, Text, View } from "react-native";
import { GlassCard } from "../ui/GlassCard";
import { colors, radius, spacing } from "../../theme/tokens";
import type { XpSummary } from "../../lib/api/xp";

export function XpStrip({
  summary,
  isLoading,
  isError,
}: {
  summary?: XpSummary | null;
  isLoading?: boolean;
  isError?: boolean;
}) {
  if (isLoading) {
    return (
      <GlassCard>
        <Text style={styles.kicker}>XP MOMENTUM</Text>
        <Text style={styles.loading}>Loading your recent progress...</Text>
      </GlassCard>
    );
  }

  if (isError || !summary) {
    return (
      <GlassCard>
        <Text style={styles.kicker}>XP MOMENTUM</Text>
        <Text style={styles.loading}>XP data is unavailable right now.</Text>
      </GlassCard>
    );
  }

  const progressPercent = summary.required > 0 ? Math.min(100, Math.max(0, (summary.progress / summary.required) * 100)) : 100;
  const remainingXp = Math.max(0, summary.required - summary.progress);

  return (
    <GlassCard>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.kicker}>XP MOMENTUM</Text>
          <Text style={styles.title}>Keep the streak moving.</Text>
        </View>
        <View style={styles.levelPill}>
          <Text style={styles.levelLabel}>LEVEL</Text>
          <Text style={styles.levelValue}>{summary.level}</Text>
        </View>
      </View>

      <View style={styles.progressMeta}>
        <Text style={styles.progressText}>{summary.totalXp} XP total</Text>
        <Text style={styles.progressText}>{remainingXp} XP to level {summary.level + 1}</Text>
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
      </View>

      <View style={styles.eventHeader}>
        <Text style={styles.sectionLabel}>Recent gains</Text>
        <Text style={styles.sectionHint}>Latest XP sources</Text>
      </View>

      {summary.recentEvents.length > 0 ? (
        <View style={styles.eventGrid}>
          {summary.recentEvents.map((event) => (
            <View key={`${event.label}-${event.xp}`} style={styles.eventChip}>
              <Text style={styles.eventLabel} numberOfLines={1}>
                {event.label}
              </Text>
              <Text style={styles.eventXp}>+{event.xp}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.emptyState}>Complete a quiz, claim a quest, or play a game to start building XP.</Text>
      )}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  kicker: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.8,
  },
  loading: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  headerText: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "700",
  },
  levelPill: {
    minWidth: 72,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radius.full,
    backgroundColor: "rgba(255,215,0,0.12)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,215,0,0.32)",
    alignItems: "center",
    justifyContent: "center",
  },
  levelLabel: {
    color: colors.goldStrong,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.1,
  },
  levelValue: {
    color: colors.text,
    fontSize: 22,
    lineHeight: 26,
    fontWeight: "800",
  },
  progressMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  progressText: {
    color: colors.textSoft,
    fontSize: 12,
    fontWeight: "600",
  },
  progressTrack: {
    height: 10,
    borderRadius: radius.full,
    backgroundColor: colors.surface2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: radius.full,
    backgroundColor: colors.gold,
  },
  eventHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginTop: spacing.xs,
  },
  sectionLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  sectionHint: {
    color: colors.textSoft,
    fontSize: 11,
    fontWeight: "600",
  },
  eventGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  eventChip: {
    minWidth: "48%",
    flexGrow: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    gap: 2,
  },
  eventLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  eventXp: {
    color: colors.goldStrong,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  emptyState: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
});
