import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { ModuleSummary, buildModuleSubtitle } from "../../lib/api/learn";
import { colors, radius, spacing } from "../../theme/tokens";
import { GlassCard } from "../ui/GlassCard";
import { ProgressRing } from "../ui/ProgressRing";

export function ModuleCard({ module }: { module: ModuleSummary }) {
  return (
    <Pressable onPress={() => router.push(`/learn/${module.moduleCode.toLowerCase()}`)} accessibilityRole="button">
      <GlassCard style={styles.card}>
        <View style={styles.row}>
          <View style={{ flex: 1, gap: 8 }}>
            <Text style={styles.code}>{module.moduleCode}</Text>
            <Text style={styles.title}>{module.moduleName}</Text>
            <Text style={styles.subtitle}>{buildModuleSubtitle(module)}</Text>
          </View>
          <ProgressRing progress={module.confidence} label="live" />
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.meta}>{module.institution ?? "SCHOOL"}</Text>
          <Text style={styles.meta}>{module.chapterCount} chapters</Text>
        </View>
        <View style={styles.badgeRow}>
          <Text style={styles.availability}>{module.lessonAvailability.label}</Text>
        </View>
      </GlassCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  code: {
    color: colors.gold,
    fontWeight: "800",
    letterSpacing: 1.4,
    fontSize: 12,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  meta: {
    color: colors.textSoft,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  badgeRow: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: "rgba(255,215,0,0.12)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,215,0,0.32)",
  },
  availability: {
    color: colors.goldStrong,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
});
