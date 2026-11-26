import { ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "../../theme/tokens";
import type { QuizHeatmapDay } from "../../lib/api/quiz";

type QuizHeatmapGridProps = {
  weeks: QuizHeatmapDay[][];
  streak: number;
};

export function QuizHeatmapGrid({ weeks, streak }: QuizHeatmapGridProps) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>CONSISTENCY</Text>
          <Text style={styles.title}>12-week heatmap</Text>
        </View>
        <View style={styles.streakPill}>
          <Text style={styles.streakLabel}>STREAK</Text>
          <Text style={styles.streakValue}>{streak}d</Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.grid}>
          {weeks.map((week, weekIndex) => (
            <View key={`${weekIndex}`} style={styles.weekColumn}>
              {week.map((day, dayIndex) => (
                <HeatmapCell key={day.date} day={day} dayIndex={dayIndex} />
              ))}
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.legendRow}>
        <Text style={styles.legendText}>Less</Text>
        <View style={[styles.legendCell, { backgroundColor: colors.surface2 }]} />
        <View style={[styles.legendCell, { backgroundColor: colors.amber }]} />
        <View style={[styles.legendCell, { backgroundColor: colors.gold }]} />
        <View style={[styles.legendCell, { backgroundColor: colors.green }]} />
        <Text style={styles.legendText}>More</Text>
      </View>
    </View>
  );
}

function HeatmapCell({
  day,
  dayIndex,
}: {
  day: QuizHeatmapDay;
  dayIndex: number;
}) {
  const backgroundColor = getScoreColor(day.score);
  const opacity = day.score === null ? 0.38 : 0.45 + Math.min(0.55, day.score * 0.55);

  return (
    <View
      accessibilityLabel={`${day.date}${day.score === null ? ": no quiz" : `: ${Math.round(day.score * 100)}%`}`}
      style={[
        styles.cell,
        {
          backgroundColor,
          opacity,
          marginTop: dayIndex === 0 ? 0 : 0,
        },
      ]}
    />
  );
}

function getScoreColor(score: number | null) {
  if (score === null) return colors.surface2;
  if (score >= 0.85) return colors.green;
  if (score >= 0.65) return colors.gold;
  return colors.amber;
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  kicker: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
  },
  streakPill: {
    alignItems: "flex-end",
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: "rgba(255,215,0,0.12)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,215,0,0.18)",
  },
  streakLabel: {
    color: colors.gold,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.1,
  },
  streakValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
  },
  scroll: {
    paddingVertical: spacing.xs,
  },
  grid: {
    flexDirection: "row",
    gap: 6,
  },
  weekColumn: {
    gap: 6,
  },
  cell: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  legendText: {
    color: colors.textMuted,
    fontSize: 11,
  },
  legendCell: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
});
