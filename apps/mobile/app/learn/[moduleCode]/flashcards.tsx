import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { FlashcardDeck } from "../../../src/components/study/FlashcardDeck";
import { Button } from "../../../src/components/ui/Button";
import { GlassCard } from "../../../src/components/ui/GlassCard";
import { Screen } from "../../../src/components/ui/Screen";
import { colors, radius, spacing } from "../../../src/theme/tokens";
import { fetchModuleDetail, generateFlashcards, type ModuleChapter } from "../../../src/lib/api/learn";
import { useCelebrationStore } from "../../../src/store/celebrationStore";

export default function FlashcardsScreen() {
  const params = useLocalSearchParams<{ moduleCode?: string; chapterId?: string }>();
  const moduleCode = typeof params.moduleCode === "string" ? params.moduleCode : "";
  const initialChapterId = typeof params.chapterId === "string" ? params.chapterId : "";
  const [selectedChapterId, setSelectedChapterId] = useState(initialChapterId);
  const triggerCelebration = useCelebrationStore((state) => state.trigger);

  useEffect(() => {
    setSelectedChapterId(initialChapterId);
  }, [initialChapterId, moduleCode]);

  const moduleQuery = useQuery({
    queryKey: ["module", moduleCode],
    queryFn: () => fetchModuleDetail(moduleCode),
    enabled: Boolean(moduleCode),
  });

  const flashcardsQuery = useQuery({
    queryKey: ["flashcards", moduleCode, selectedChapterId],
    queryFn: () =>
      generateFlashcards({
        moduleCode,
        chapterId: selectedChapterId || undefined,
        count: 10,
      }),
    enabled: Boolean(moduleCode),
  });

  const chapterOptions = useMemo(() => moduleQuery.data?.chapters ?? [], [moduleQuery.data?.chapters]);
  const cards = flashcardsQuery.data ?? [];

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Button variant="ghost" onPress={() => router.back()} style={styles.backButton}>
          Back
        </Button>
        <View style={styles.headerCopy}>
          <Text style={styles.kicker}>FLASHCARDS</Text>
          <Text style={styles.title}>{(moduleQuery.data?.moduleName ?? moduleCode) || "Module"}</Text>
          <Text style={styles.subtitle}>
            Tap to flip. Swipe left for more practice, swipe right when you know it.
          </Text>
        </View>
      </View>

      <GlassCard style={styles.metaCard}>
        <Text style={styles.metaLabel}>Chapter filter</Text>
        <View style={styles.chapterRow}>
          <ChapterChip
            label="All chapters"
            active={selectedChapterId === ""}
            onPress={() => setSelectedChapterId("")}
          />
          {chapterOptions.map((chapter: ModuleChapter) => (
            <ChapterChip
              key={chapter.id}
              label={`CH ${chapter.id}`}
              active={selectedChapterId === chapter.id}
              onPress={() => setSelectedChapterId(chapter.id)}
            />
          ))}
        </View>
      </GlassCard>

      {flashcardsQuery.isLoading ? (
        <GlassCard style={styles.stateCard}>
          <Text style={styles.stateText}>Generating flashcards...</Text>
        </GlassCard>
      ) : flashcardsQuery.isError ? (
        <GlassCard style={styles.stateCard}>
          <Text style={styles.stateText}>Could not load flashcards right now.</Text>
          <Button onPress={() => void flashcardsQuery.refetch()} style={styles.retryButton}>
            Try again
          </Button>
        </GlassCard>
      ) : (
        <FlashcardDeck
          cards={cards}
          onExit={() => router.back()}
          onFinished={({ gotIt, needMorePractice }) =>
            triggerCelebration({
              kind: "flashcards",
              title: "Deck complete",
              message: `${gotIt} cards mastered, ${needMorePractice} marked for review.`,
            })
          }
        />
      )}
    </Screen>
  );
}

function ChapterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  backButton: {
    alignSelf: "flex-start",
  },
  headerCopy: {
    gap: spacing.xs,
  },
  kicker: {
    color: colors.gold,
    fontSize: 11,
    letterSpacing: 1.4,
    fontWeight: "800",
  },
  title: {
    color: colors.text,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "800",
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  metaCard: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  metaLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  chapterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: "rgba(255,255,255,0.04)",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipActive: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  chipLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "700",
  },
  chipLabelActive: {
    color: colors.backgroundDeep,
  },
  stateCard: {
    gap: spacing.sm,
  },
  stateText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  retryButton: {
    alignSelf: "flex-start",
  },
});
