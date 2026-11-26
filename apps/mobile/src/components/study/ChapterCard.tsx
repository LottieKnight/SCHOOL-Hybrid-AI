import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { ModuleChapter, buildChapterSummary } from "../../lib/api/learn";
import { colors, radius, spacing } from "../../theme/tokens";
import { GlassCard } from "../ui/GlassCard";

export function ChapterCard({
  moduleCode,
  chapter,
}: {
  moduleCode: string;
  chapter: ModuleChapter;
}) {
  return (
    <Pressable
      onPress={() => router.push(`/learn/${moduleCode.toLowerCase()}/chapter/${chapter.id}`)}
      accessibilityRole="button"
    >
      <GlassCard style={styles.card}>
        <View style={styles.topRow}>
          <Text style={styles.badge}>CH {chapter.id}</Text>
          <Text style={styles.duration}>{chapter.revisionPrompts.length || chapter.outcomes.length} cues</Text>
        </View>
        <Text style={styles.title}>{chapter.title}</Text>
        <Text style={styles.summary}>{buildChapterSummary(chapter)}</Text>
      </GlassCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  badge: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
  },
  duration: {
    color: colors.textSoft,
    fontSize: 11,
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  summary: {
    color: colors.textMuted,
    lineHeight: 19,
    fontSize: 13,
  },
});
