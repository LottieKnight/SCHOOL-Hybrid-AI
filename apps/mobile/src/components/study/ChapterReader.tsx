import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "../../theme/tokens";
import { GlassCard } from "../ui/GlassCard";

export function ChapterReader({
  chapterNumber,
  title,
  summary,
  sections,
  onPrev,
  onNext,
  onBack,
}: {
  chapterNumber: string;
  title: string;
  summary: string;
  sections: { heading: string; body: string; note?: string }[];
  onPrev?: () => void;
  onNext?: () => void;
  onBack?: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.wrap} showsVerticalScrollIndicator={false}>
      {onBack ? (
        <Pressable onPress={onBack} style={styles.backBtn} accessibilityRole="button">
          <Text style={styles.backChevron}>‹</Text>
          <Text style={styles.backLabel}>Back</Text>
        </Pressable>
      ) : null}

      <GlassCard style={styles.hero}>
        <Text style={styles.kicker}>CHAPTER {chapterNumber}</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.summary}>{summary}</Text>
      </GlassCard>

      {sections.map((section) => (
        <GlassCard key={section.heading} style={styles.section}>
          <Text style={styles.sectionHeading}>{section.heading}</Text>
          <Text style={styles.sectionBody}>{section.body}</Text>
          {section.note ? <Text style={styles.note}>{section.note}</Text> : null}
        </GlassCard>
      ))}

      <View style={styles.navRow}>
        <Pressable
          onPress={onPrev}
          disabled={!onPrev}
          style={[styles.navBtn, !onPrev && styles.navDisabled]}
        >
          <Text style={styles.navText}>← Prev</Text>
        </Pressable>
        <Pressable
          onPress={onNext}
          disabled={!onNext}
          style={[styles.navBtn, styles.navNext, !onNext && styles.navDisabled]}
        >
          <Text style={[styles.navText, !onNext && styles.navTextDisabled]}>Next →</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: 120,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: spacing.xs,
    marginBottom: -spacing.xs,
  },
  backChevron: {
    color: colors.gold,
    fontSize: 22,
    lineHeight: 22,
    fontWeight: "300",
  },
  backLabel: {
    color: colors.gold,
    fontSize: 15,
    fontWeight: "500",
  },
  hero: {
    borderRadius: radius.xl,
  },
  kicker: {
    color: colors.gold,
    fontWeight: "800",
    fontSize: 12,
    letterSpacing: 1,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "800",
    lineHeight: 30,
  },
  summary: {
    color: colors.textMuted,
    lineHeight: 21,
    fontSize: 14,
  },
  section: {
    borderRadius: radius.lg,
  },
  sectionHeading: {
    color: colors.text,
    fontWeight: "700",
    fontSize: 16,
  },
  sectionBody: {
    color: colors.textMuted,
    lineHeight: 21,
    fontSize: 14,
  },
  note: {
    color: colors.goldStrong,
    lineHeight: 20,
    fontSize: 12,
  },
  navRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  navBtn: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: "rgba(255,255,255,0.04)",
    alignItems: "center",
  },
  navNext: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  navDisabled: {
    opacity: 0.3,
  },
  navText: {
    color: colors.backgroundDeep,
    fontWeight: "600",
    fontSize: 14,
  },
  navTextDisabled: {
    color: colors.textMuted,
  },
});
