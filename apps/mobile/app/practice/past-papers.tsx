import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../../src/components/ui/Screen";
import { GlassCard } from "../../src/components/ui/GlassCard";
import { Button } from "../../src/components/ui/Button";
import { colors, radius, spacing } from "../../src/theme/tokens";
import { fetchPastPaperFilters, fetchPastPaperList, type PastPaperListItem } from "../../src/lib/api/pastPapers";
import { OFFLINE_CACHE } from "../../src/lib/queryClient";

const PAGE_SIZE = 18;

function formatGrade(grade: number | null) {
  if (grade === null) return "University";
  if (grade === 0) return "Grade R";
  return `Grade ${grade}`;
}

function FilterChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.chipPressed]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function PaperCard({ paper }: { paper: PastPaperListItem }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(`/practice/past-papers/${paper.id}`)}
      style={({ pressed }) => [styles.cardButton, pressed && styles.cardPressed]}
    >
      <GlassCard style={styles.paperCard}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.subject}>{paper.subject}</Text>
            <Text style={styles.meta}>{formatGrade(paper.grade)} · {paper.year ?? "—"} · {paper.session}</Text>
          </View>
          <View style={styles.memoBadge}>
            <Ionicons name={paper.hasMemo ? "checkmark-circle" : "time-outline"} size={14} color={paper.hasMemo ? colors.green : colors.textSoft} />
            <Text style={[styles.memoText, paper.hasMemo && styles.memoTextLive]}>
              {paper.hasMemo ? "Memo" : "Pending"}
            </Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaPill}>
            <Text style={styles.metaPillText}>Paper {paper.paperNumber}</Text>
          </View>
          <View style={styles.metaPill}>
            <Text style={styles.metaPillText}>{paper.language}</Text>
          </View>
          {paper.moduleCode ? (
            <View style={styles.metaPill}>
              <Text style={styles.metaPillText}>{paper.moduleCode}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.ctaRow}>
          <Text style={styles.cta}>Open paper →</Text>
        </View>
      </GlassCard>
    </Pressable>
  );
}

export default function PastPapersBrowserScreen() {
  const [grade, setGrade] = useState<number | undefined>(undefined);
  const [subject, setSubject] = useState<string | undefined>(undefined);
  const [year, setYear] = useState<number | undefined>(undefined);
  const [page, setPage] = useState(1);

  const filtersQuery = useQuery({
    queryKey: ["past-papers-filters"],
    queryFn: fetchPastPaperFilters,
    ...OFFLINE_CACHE,
  });

  const listQuery = useQuery({
    queryKey: ["past-papers-list", grade ?? null, subject ?? null, year ?? null, page],
    queryFn: () => fetchPastPaperList({ grade, subject, year, page, limit: PAGE_SIZE }),
  });

  const totalPages = useMemo(() => Math.max(1, Math.ceil((listQuery.data?.total ?? 0) / PAGE_SIZE)), [listQuery.data?.total]);

  const subjectOptions = filtersQuery.data?.subjects ?? [];
  const gradeOptions = filtersQuery.data?.grades ?? [];
  const yearOptions = filtersQuery.data?.years ?? [];

  const clearFilters = () => {
    setGrade(undefined);
    setSubject(undefined);
    setYear(undefined);
    setPage(1);
  };

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Text style={styles.kicker}>PRACTICE</Text>
        <Text style={styles.title}>Past papers</Text>
        <Text style={styles.subtitle}>Filter by grade, subject, and year. Open a paper in the built-in viewer.</Text>
      </View>

      <GlassCard>
        <View style={styles.filterHeader}>
          <Text style={styles.sectionTitle}>Filters</Text>
          <Button variant="ghost" onPress={clearFilters} style={styles.clearButton}>
            Clear
          </Button>
        </View>

        <Text style={styles.filterLabel}>Grade</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          <FilterChip label="All" selected={grade === undefined} onPress={() => { setGrade(undefined); setPage(1); }} />
          {gradeOptions.map((option) => (
            <FilterChip
              key={option}
              label={formatGrade(option)}
              selected={grade === option}
              onPress={() => { setGrade(option); setPage(1); }}
            />
          ))}
        </ScrollView>

        <Text style={styles.filterLabel}>Subject</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          <FilterChip label="All" selected={subject === undefined} onPress={() => { setSubject(undefined); setPage(1); }} />
          {subjectOptions.map((option) => (
            <FilterChip
              key={option}
              label={option}
              selected={subject === option}
              onPress={() => { setSubject(option); setPage(1); }}
            />
          ))}
        </ScrollView>

        <Text style={styles.filterLabel}>Year</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          <FilterChip label="All" selected={year === undefined} onPress={() => { setYear(undefined); setPage(1); }} />
          {yearOptions.map((option) => (
            <FilterChip
              key={option}
              label={String(option)}
              selected={year === option}
              onPress={() => { setYear(option); setPage(1); }}
            />
          ))}
        </ScrollView>
      </GlassCard>

      <GlassCard>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Available papers</Text>
          <Text style={styles.sectionHint}>
            {listQuery.data ? `${listQuery.data.total.toLocaleString()} papers` : "Loading..."}
          </Text>
        </View>

        {listQuery.isLoading ? (
          <Text style={styles.emptyState}>Loading papers...</Text>
        ) : listQuery.isError ? (
          <Text style={styles.emptyState}>Could not load past papers right now.</Text>
        ) : (listQuery.data?.items ?? []).length > 0 ? (
          <View style={styles.list}>
            {listQuery.data?.items.map((paper) => <PaperCard key={paper.id} paper={paper} />)}
          </View>
        ) : (
          <Text style={styles.emptyState}>No papers match these filters.</Text>
        )}
      </GlassCard>

      <View style={styles.pagination}>
        <Button
          variant="ghost"
          disabled={page <= 1}
          onPress={() => setPage((current) => Math.max(1, current - 1))}
          style={styles.pageButton}
        >
          Previous
        </Button>
        <Text style={styles.pageInfo}>
          Page {page} of {totalPages}
        </Text>
        <Button
          variant="ghost"
          disabled={page >= totalPages}
          onPress={() => setPage((current) => Math.min(totalPages, current + 1))}
          style={styles.pageButton}
        >
          Next
        </Button>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.xs,
    paddingVertical: spacing.xl,
  },
  kicker: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.8,
  },
  title: {
    color: colors.text,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "800",
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  filterHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  sectionHint: {
    color: colors.textSoft,
    fontSize: 12,
  },
  clearButton: {
    minHeight: 36,
    paddingHorizontal: 14,
  },
  filterLabel: {
    color: colors.textSoft,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    textTransform: "uppercase",
  },
  chipRow: {
    gap: spacing.xs,
    paddingRight: spacing.sm,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  chipSelected: {
    backgroundColor: "rgba(255,215,0,0.14)",
    borderColor: "rgba(255,215,0,0.4)",
  },
  chipPressed: {
    opacity: 0.9,
  },
  chipText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
  },
  chipTextSelected: {
    color: colors.goldStrong,
  },
  list: {
    gap: spacing.sm,
  },
  cardButton: {
    borderRadius: radius.lg,
  },
  cardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  paperCard: {
    marginBottom: 0,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  subject: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 22,
  },
  meta: {
    color: colors.textSoft,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  memoBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  memoText: {
    color: colors.textSoft,
    fontSize: 11,
    fontWeight: "700",
  },
  memoTextLive: {
    color: colors.green,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  metaPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  metaPillText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
  },
  ctaRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  cta: {
    color: colors.goldStrong,
    fontSize: 13,
    fontWeight: "800",
  },
  pagination: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  pageButton: {
    flex: 1,
  },
  pageInfo: {
    color: colors.textSoft,
    fontSize: 12,
    fontWeight: "700",
  },
  emptyState: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
});
