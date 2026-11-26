import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { fetchModuleDetail, type ModuleChapter } from "../../../src/lib/api/learn";
import { OFFLINE_CACHE } from "../../../src/lib/queryClient";
import { Screen } from "../../../src/components/ui/Screen";
import { GlassCard } from "../../../src/components/ui/GlassCard";
import { Button } from "../../../src/components/ui/Button";
import { colors, spacing } from "../../../src/theme/tokens";
import { ChapterCard } from "../../../src/components/study/ChapterCard";

export default function ModuleOverviewScreen() {
  const params = useLocalSearchParams<{ moduleCode?: string }>();
  const moduleCode = params.moduleCode ?? "";

  const { data, isLoading, isError } = useQuery({
    queryKey: ["module", moduleCode],
    queryFn: () => fetchModuleDetail(moduleCode),
    enabled: Boolean(moduleCode),
    ...OFFLINE_CACHE,
  });

  return (
    <Screen scroll>
      {isLoading ? (
        <GlassCard>
          <Text style={styles.copy}>Loading live module...</Text>
        </GlassCard>
      ) : isError ? (
        <GlassCard>
          <Text style={styles.copy}>Could not load this module right now.</Text>
          <Button variant="ghost" onPress={() => router.back()}>
            Go back
          </Button>
        </GlassCard>
      ) : data ? (
        <>
          <View style={styles.hero}>
            <Text style={styles.kicker}>{data.moduleCode}</Text>
            <Text style={styles.title}>{data.moduleName}</Text>
            <Text style={styles.copy}>{data.institution ?? "Live module"}</Text>
            <Text style={styles.copy}>{data.semester ?? "Open live content from the web app."}</Text>
          </View>

          <Button
            onPress={() => router.push(`/learn/${data.moduleCode.toLowerCase()}/flashcards`)}
            style={styles.flashcardsButton}
          >
            Flashcards
          </Button>

          <GlassCard>
            <Text style={styles.cardTitle}>Study units</Text>
            <Text style={styles.cardCopy}>{data.studyUnitCount} units · {data.chapterCount} chapters</Text>
            <View style={styles.pillRow}>
              {data.studyUnits.slice(0, 4).map((unit: string) => (
                <Text key={unit} style={styles.pill}>{unit}</Text>
              ))}
            </View>
          </GlassCard>

          <View style={{ gap: spacing.md }}>
            {data.chapters.map((chapter: ModuleChapter) => (
              <ChapterCard key={chapter.id} moduleCode={data.moduleCode} chapter={chapter} />
            ))}
          </View>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  flashcardsButton: {
    marginBottom: spacing.md,
  },
  kicker: {
    color: colors.gold,
    fontWeight: "800",
    letterSpacing: 1.5,
    fontSize: 12,
  },
  title: {
    color: colors.text,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "800",
  },
  copy: {
    color: colors.textMuted,
    lineHeight: 21,
    fontSize: 14,
  },
  cardTitle: {
    color: colors.text,
    fontWeight: "700",
    fontSize: 17,
  },
  cardCopy: {
    color: colors.textMuted,
    lineHeight: 21,
    marginBottom: spacing.sm,
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  pill: {
    color: colors.text,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
});
